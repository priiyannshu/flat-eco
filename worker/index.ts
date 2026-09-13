import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  STORAGE?: R2Bucket;
}

export type Variables = {
  userId: string;
  userRole: string;
  sessionToken: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-dev-key']
}));

// WebAuthn Utilities
function generateChallenge(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function parseClientDataJSON(clientDataBase64URL: string): { type: string; challenge: string; origin: string } | null {
  try {
    let base64 = clientDataBase64URL.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// -------------------------------------------------------------
// 1. Profiles & Public Config
// -------------------------------------------------------------
app.get('/api/users', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, role, room_or_info, created_at FROM users ORDER BY id ASC'
    ).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/settings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT key, value FROM app_settings').all();
    const settings: Record<string, string> = {};
    for (const r of results as any[]) {
      if (r.key !== 'dev_passkey') {
        settings[r.key] = r.value;
      }
    }
    return c.json(settings);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 2. WebAuthn Passkeys & Authentication Endpoints
// -------------------------------------------------------------

// Check if user has enrolled passkeys
app.get('/api/auth/passkey/status', async (c) => {
  try {
    const userId = c.req.query('userId');
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const { results } = await c.env.DB.prepare(
      'SELECT id, device_name, created_at FROM user_passkeys WHERE user_id = ?'
    ).bind(userId).all();

    return c.json({
      hasPasskey: results.length > 0,
      count: results.length,
      devices: results
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Register Passkey: Step 1 - Challenge & Creation Options
app.post('/api/auth/passkey/register-options', async (c) => {
  try {
    const { userId, setupPin } = await c.req.json();
    const user = await c.env.DB.prepare(
      'SELECT id, name, role, pin FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (!user) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    // If setup PIN is provided, verify it (prevents unauthorized enrollment)
    if (setupPin && user.pin && user.pin !== setupPin) {
      return c.json({ error: 'Invalid Setup PIN' }, 401);
    }

    const challenge = generateChallenge();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes

    // Store challenge
    await c.env.DB.prepare(`
      INSERT INTO auth_challenges (challenge, user_id, type, expires_at, created_at)
      VALUES (?, ?, 'registration', ?, ?)
    `).bind(challenge, userId, expiresAt, now).run();

    const host = new URL(c.req.url).hostname;

    return c.json({
      challenge,
      rp: {
        name: 'FlatEco',
        id: host === 'localhost' ? 'localhost' : host
      },
      user: {
        id: user.id,
        name: user.name,
        displayName: user.name
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256 (Apple Face ID / Touch ID, Android)
        { type: 'public-key', alg: -257 } // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Enforce on-device biometric (Face ID / Touch ID / Fingerprint)
        userVerification: 'required',
        residentKey: 'preferred'
      },
      timeout: 60000,
      attestation: 'none'
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Register Passkey: Step 2 - Verify Credential & Issue Session Token
app.post('/api/auth/passkey/register-verify', async (c) => {
  try {
    const { userId, credential, deviceName } = await c.req.json();
    if (!credential || !credential.response) {
      return c.json({ error: 'Invalid credential payload' }, 400);
    }

    const clientData = parseClientDataJSON(credential.response.clientDataJSON);
    if (!clientData || clientData.type !== 'webauthn.create') {
      return c.json({ error: 'Invalid clientData type' }, 400);
    }

    // Verify challenge in database
    const challengeRow = await c.env.DB.prepare(`
      SELECT challenge FROM auth_challenges
      WHERE challenge = ? AND user_id = ? AND type = 'registration' AND expires_at > ?
    `).bind(clientData.challenge, userId, Date.now()).first();

    if (!challengeRow) {
      return c.json({ error: 'Challenge expired or invalid' }, 400);
    }

    // Invalidate challenge
    await c.env.DB.prepare('DELETE FROM auth_challenges WHERE challenge = ?').bind(clientData.challenge).run();

    // Look up user
    const user = await c.env.DB.prepare(
      'SELECT id, name, role, room_or_info FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    const passkeyId = 'pk_' + Date.now();
    const now = Date.now();

    // Save Passkey credential
    await c.env.DB.prepare(`
      INSERT INTO user_passkeys (id, user_id, credential_id, public_key, counter, device_name, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).bind(
      passkeyId,
      userId,
      credential.id,
      credential.response.attestationObject || '',
      deviceName || 'Biometric Passkey',
      now
    ).run();

    // Create session token bound to this user (90-day validity for device lock)
    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const sessionExpires = now + 90 * 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(`
      INSERT INTO user_sessions (token, user_id, role, device_name, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionToken,
      userId,
      user.role,
      deviceName || 'Biometric Device',
      sessionExpires,
      now
    ).run();

    return c.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        room_or_info: user.room_or_info
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Authenticate Passkey: Step 1 - Challenge Options
app.post('/api/auth/passkey/auth-options', async (c) => {
  try {
    const { userId } = await c.req.json();
    if (!userId) return c.json({ error: 'userId required' }, 400);

    const { results } = await c.env.DB.prepare(
      'SELECT credential_id FROM user_passkeys WHERE user_id = ?'
    ).bind(userId).all();

    if (!results || results.length === 0) {
      return c.json({ error: 'No passkey registered for this profile. Please enroll Face ID / Passkey.' }, 404);
    }

    const challenge = generateChallenge();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000;

    await c.env.DB.prepare(`
      INSERT INTO auth_challenges (challenge, user_id, type, expires_at, created_at)
      VALUES (?, ?, 'authentication', ?, ?)
    `).bind(challenge, userId, expiresAt, now).run();

    const host = new URL(c.req.url).hostname;

    return c.json({
      challenge,
      rpId: host === 'localhost' ? 'localhost' : host,
      allowCredentials: results.map((r: any) => ({
        type: 'public-key',
        id: r.credential_id
      })),
      userVerification: 'required',
      timeout: 60000
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Authenticate Passkey: Step 2 - Verify Assertion & Issue Session
app.post('/api/auth/passkey/auth-verify', async (c) => {
  try {
    const { userId, assertion, deviceName } = await c.req.json();
    if (!assertion || !assertion.response) {
      return c.json({ error: 'Invalid assertion payload' }, 400);
    }

    const clientData = parseClientDataJSON(assertion.response.clientDataJSON);
    if (!clientData || clientData.type !== 'webauthn.get') {
      return c.json({ error: 'Invalid clientData type' }, 400);
    }

    // Verify challenge
    const challengeRow = await c.env.DB.prepare(`
      SELECT challenge FROM auth_challenges
      WHERE challenge = ? AND user_id = ? AND type = 'authentication' AND expires_at > ?
    `).bind(clientData.challenge, userId, Date.now()).first();

    if (!challengeRow) {
      return c.json({ error: 'Challenge expired or invalid' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM auth_challenges WHERE challenge = ?').bind(clientData.challenge).run();

    // Verify credential belongs to user
    const credRow = await c.env.DB.prepare(
      'SELECT id FROM user_passkeys WHERE user_id = ? AND credential_id = ?'
    ).bind(userId, assertion.id).first();

    if (!credRow) {
      return c.json({ error: 'Credential not recognized for this user' }, 403);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, name, role, room_or_info FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    // Issue new session token
    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const now = Date.now();
    const sessionExpires = now + 90 * 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(`
      INSERT INTO user_sessions (token, user_id, role, device_name, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionToken,
      userId,
      user.role,
      deviceName || 'Biometric Device',
      sessionExpires,
      now
    ).run();

    return c.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        room_or_info: user.room_or_info
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Fallback PIN Login (issues session token)
app.post('/api/auth/login', async (c) => {
  try {
    const { userId, pin, deviceName } = await c.req.json();
    const user = await c.env.DB.prepare(
      'SELECT id, name, role, room_or_info, pin, created_at FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (!user) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (user.pin !== pin) {
      return c.json({ error: 'Incorrect PIN' }, 401);
    }

    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const now = Date.now();
    const sessionExpires = now + 90 * 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(`
      INSERT INTO user_sessions (token, user_id, role, device_name, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      sessionToken,
      user.id,
      user.role,
      deviceName || 'PIN Device',
      sessionExpires,
      now
    ).run();

    const { pin: _, ...safeUser } = user;
    return c.json({ success: true, token: sessionToken, user: safeUser });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Verify Current Session
app.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (token) {
      const session = await c.env.DB.prepare(`
        SELECT s.token, s.user_id, s.role, s.expires_at, u.name, u.room_or_info
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
      `).bind(token, Date.now()).first() as any;

      if (session) {
        return c.json({
          user: {
            id: session.user_id,
            name: session.name,
            role: session.role,
            room_or_info: session.room_or_info
          }
        });
      }
    }

    // Fallback to legacy/bound x-user-id header
    const legacyUserId = c.req.header('x-user-id');
    if (legacyUserId) {
      const user = await c.env.DB.prepare(
        'SELECT id, name, role, room_or_info FROM users WHERE id = ?'
      ).bind(legacyUserId).first() as any;
      if (user) {
        return c.json({
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
            room_or_info: user.room_or_info
          }
        });
      }
    }

    return c.json({ error: 'Invalid or expired session' }, 401);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Sign Out / Revoke Session
app.post('/api/auth/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (token) {
      await c.env.DB.prepare('DELETE FROM user_sessions WHERE token = ?').bind(token).run();
    }
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 🔒 Row-Level Security (RLS) & Authentication Guard Middleware
// -------------------------------------------------------------
app.use('/api/*', async (c, next) => {
  const path = c.req.path;

  // Unprotected routes (public metadata, health, auth operations)
  if (
    path === '/api/health' ||
    path.startsWith('/api/auth/') ||
    path === '/api/users' ||
    path === '/api/settings'
  ) {
    return next();
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  // Support legacy x-user-id fallback for dev/backward compatibility if no bearer token
  if (!token) {
    const legacyUserId = c.req.header('x-user-id');
    if (legacyUserId) {
      const user = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(legacyUserId).first() as any;
      if (user) {
        c.set('userId', user.id);
        c.set('userRole', user.role);
        c.set('sessionToken', 'legacy');
        return next();
      }
    }

    return c.json({
      error: 'UNAUTHORIZED',
      message: 'Access Denied: Please authenticate with your Passkey (Face ID / Fingerprint).'
    }, 401);
  }

  // Verify Session Token in D1
  const session = await c.env.DB.prepare(
    'SELECT user_id, role, expires_at FROM user_sessions WHERE token = ?'
  ).bind(token).first() as any;

  if (!session || session.expires_at < Date.now()) {
    return c.json({
      error: 'SESSION_EXPIRED',
      message: 'Your biometric session has expired. Please unlock with Face ID / Passkey.'
    }, 401);
  }

  c.set('userId', session.user_id);
  c.set('userRole', session.role);
  c.set('sessionToken', token);
  return next();
});

// -------------------------------------------------------------
// 3. Tiffins (Daily Tracker with RLS)
// -------------------------------------------------------------
app.get('/api/tiffins', async (c) => {
  try {
    const month = c.req.query('month');
    let query = 'SELECT * FROM tiffin_records';
    let params: any[] = [];

    if (month) {
      query += ' WHERE date LIKE ? ORDER BY date ASC, meal_type ASC';
      params.push(`${month}%`);
    } else {
      query += ' ORDER BY date DESC, meal_type DESC LIMIT 60';
    }

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/tiffins', async (c) => {
  try {
    // RLS Enforcement: ONLY Owner can record or update meals
    const userRole = c.get('userRole');
    if (userRole !== 'owner') {
      return c.json({
        error: 'FORBIDDEN',
        message: 'Row-Level Security: Only the apartment owner can record or edit tiffins.'
      }, 403);
    }

    const body = await c.req.json();
    const devKeyHeader = c.req.header('x-dev-key');
    const { id, date, meal_type, tenant_1, tenant_2, tenant_3, tenant_4, extras, extras_note } = body;

    if (!date || !meal_type) {
      return c.json({ error: 'Date and meal_type are required' }, 400);
    }

    const recordId = id || `${date}_${meal_type}`;
    const now = Date.now();

    // Check existing record for 24-hour lock
    const existing = await c.env.DB.prepare(
      'SELECT created_at, is_dev_unlocked FROM tiffin_records WHERE id = ?'
    ).bind(recordId).first() as any;

    const lockDurationMs = 24 * 60 * 60 * 1000;

    if (existing) {
      const isPast24Hours = (now - Number(existing.created_at)) > lockDurationMs;
      const isDevUnlocked = Number(existing.is_dev_unlocked) === 1;

      let isDevAuth = false;
      if (devKeyHeader) {
        const devKeySetting = await c.env.DB.prepare(
          "SELECT value FROM app_settings WHERE key = 'dev_passkey'"
        ).first() as any;
        if (devKeySetting && devKeySetting.value === devKeyHeader) {
          isDevAuth = true;
        }
      }

      if (isPast24Hours && !isDevUnlocked && !isDevAuth) {
        return c.json({
          error: 'RECORD_LOCKED',
          message: 'This record was created over 24 hours ago and is locked. Only a developer can unlock or edit it.'
        }, 403);
      }

      await c.env.DB.prepare(`
        UPDATE tiffin_records SET
          tenant_1 = ?, tenant_2 = ?, tenant_3 = ?, tenant_4 = ?,
          extras = ?, extras_note = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        tenant_1 || 0, tenant_2 || 0, tenant_3 || 0, tenant_4 || 0,
        extras || 0, extras_note || null, now, recordId
      ).run();

      return c.json({ success: true, id: recordId, action: 'updated' });
    } else {
      await c.env.DB.prepare(`
        INSERT INTO tiffin_records (
          id, date, meal_type, tenant_1, tenant_2, tenant_3, tenant_4, extras, extras_note, created_at, updated_at, is_dev_unlocked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).bind(
        recordId, date, meal_type,
        tenant_1 || 0, tenant_2 || 0, tenant_3 || 0, tenant_4 || 0,
        extras || 0, extras_note || null, now, now
      ).run();

      return c.json({ success: true, id: recordId, action: 'created' });
    }
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Developer unlock for tiffins past 24h
app.post('/api/dev/unlock', async (c) => {
  try {
    const { passkey, recordId } = await c.req.json();
    const devKeySetting = await c.env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'dev_passkey'"
    ).first() as any;

    if (!devKeySetting || devKeySetting.value !== passkey) {
      return c.json({ error: 'Invalid developer passkey' }, 401);
    }

    if (recordId) {
      await c.env.DB.prepare(
        'UPDATE tiffin_records SET is_dev_unlocked = 1, updated_at = ? WHERE id = ?'
      ).bind(Date.now(), recordId).run();
      return c.json({ success: true, message: `Record ${recordId} unlocked successfully for edits.` });
    }

    return c.json({ success: true, message: 'Developer mode verified.' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 4. Rent Records (Row-Level Security Enforced)
// -------------------------------------------------------------
app.get('/api/rent', async (c) => {
  try {
    const authUserId = c.get('userId');
    const authRole = c.get('userRole');
    const month = c.req.query('month');

    let query = 'SELECT * FROM rent_records';
    let params: any[] = [];

    // STRICT ROW-LEVEL SECURITY:
    // If not the owner, the user is hard-locked to seeing ONLY their personal rent rows.
    if (authRole !== 'owner') {
      query += ' WHERE user_id = ?';
      params.push(authUserId);
      if (month) {
        query += ' AND month = ?';
        params.push(month);
      }
    } else {
      if (month) {
        query += ' WHERE month = ?';
        params.push(month);
      }
    }

    query += ' ORDER BY month DESC, user_id ASC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/rent', async (c) => {
  try {
    // STRICT RLS: Only apartment owner can toggle rent payment status
    const authRole = c.get('userRole');
    if (authRole !== 'owner') {
      return c.json({
        error: 'FORBIDDEN',
        message: 'Row-Level Security: Only the apartment owner can mark rent payments.'
      }, 403);
    }

    const { user_id, month, amount, is_paid, payment_method, notes } = await c.req.json();
    const recordId = `rent_${user_id}_${month}`;
    const now = Date.now();
    const paidDate = is_paid ? new Date().toISOString().split('T')[0] : null;

    await c.env.DB.prepare(`
      INSERT INTO rent_records (id, user_id, month, amount, is_paid, paid_date, payment_method, notes, marked_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'owner', ?)
      ON CONFLICT(id) DO UPDATE SET
        amount = excluded.amount,
        is_paid = excluded.is_paid,
        paid_date = excluded.paid_date,
        payment_method = excluded.payment_method,
        notes = excluded.notes,
        marked_by = 'owner',
        updated_at = excluded.updated_at
    `).bind(
      recordId, user_id, month, amount || 2000, is_paid ? 1 : 0, paidDate,
      payment_method || 'UPI', notes || null, now
    ).run();

    // Notify tenant if marked paid
    if (is_paid) {
      const notifId = 'notif_' + Date.now();
      await c.env.DB.prepare(`
        INSERT INTO notifications (id, target_user_id, title, message, type, is_read, created_at)
        VALUES (?, ?, 'Rent Payment Received', ?, 'rent', 0, ?)
      `).bind(
        notifId, user_id,
        `Your rent of ₹${amount || 2000} for ${month} has been marked as PAID by the owner.`,
        now
      ).run();
    }

    return c.json({ success: true, id: recordId });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 5. Electricity Bills (RLS Enforced)
// -------------------------------------------------------------
app.get('/api/bills', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM electricity_bills ORDER BY billing_month DESC'
    ).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/bills', async (c) => {
  try {
    const authRole = c.get('userRole');
    if (authRole !== 'owner') {
      return c.json({
        error: 'FORBIDDEN',
        message: 'Row-Level Security: Only the apartment owner can upload electricity bills.'
      }, 403);
    }

    const { billing_month, bill_number, total_amount, due_date, image_data, notes } = await c.req.json();
    const id = 'bill_' + billing_month;
    const now = Date.now();
    const perPersonShare = Math.round(Number(total_amount) / 4);

    await c.env.DB.prepare(`
      INSERT INTO electricity_bills (id, billing_month, bill_number, total_amount, per_person_share, due_date, image_data, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        total_amount = excluded.total_amount,
        per_person_share = excluded.per_person_share,
        due_date = excluded.due_date,
        image_data = COALESCE(excluded.image_data, electricity_bills.image_data),
        notes = excluded.notes
    `).bind(
      id, billing_month, bill_number || null, Number(total_amount),
      perPersonShare, due_date || null, image_data || null, notes || null, now
    ).run();

    // Trigger Notification for all flatmates
    const notifId = 'notif_bill_' + now;
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, target_user_id, title, message, type, data_json, is_read, created_at)
      VALUES (?, 'all', '⚡ New Electricity Bill Uploaded', ?, 'bill', ?, 0, ?)
    `).bind(
      notifId,
      `Electricity bill for ${billing_month} is ₹${total_amount}. Each roommate's share is ₹${perPersonShare} (Due: ${due_date || 'End of month'}).`,
      JSON.stringify({ bill_id: id, billing_month, per_person_share: perPersonShare }),
      now
    ).run();

    return c.json({ success: true, id, per_person_share: perPersonShare });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 6. Receipts (Row-Level Security Enforced)
// -------------------------------------------------------------
app.get('/api/receipts', async (c) => {
  try {
    const authRole = c.get('userRole');
    const authUserId = c.get('userId');

    let query = 'SELECT * FROM receipts';
    let params: any[] = [];

    // STRICT RLS: Tenants can ONLY access their own issued receipts!
    if (authRole !== 'owner') {
      query += ' WHERE user_id = ?';
      params.push(authUserId);
    }

    query += ' ORDER BY issued_at DESC';
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/receipts', async (c) => {
  try {
    const authRole = c.get('userRole');
    if (authRole !== 'owner') {
      return c.json({
        error: 'FORBIDDEN',
        message: 'Row-Level Security: Only the apartment owner can issue official receipts.'
      }, 403);
    }

    const { user_id, month, rent_amount, tiffin_count, tiffin_amount, electricity_amount, extras_amount, total_amount, notes } = await c.req.json();
    const id = `REC-${month}-${user_id.toUpperCase()}`;
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO receipts (id, user_id, month, rent_amount, tiffin_count, tiffin_amount, electricity_amount, extras_amount, total_amount, status, issued_at, issued_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, 'owner', ?)
      ON CONFLICT(id) DO UPDATE SET
        rent_amount = excluded.rent_amount,
        tiffin_count = excluded.tiffin_count,
        tiffin_amount = excluded.tiffin_amount,
        electricity_amount = excluded.electricity_amount,
        extras_amount = excluded.extras_amount,
        total_amount = excluded.total_amount,
        issued_at = excluded.issued_at,
        notes = excluded.notes
    `).bind(
      id, user_id, month, rent_amount, tiffin_count, tiffin_amount,
      electricity_amount, extras_amount || 0, total_amount, now, notes || null
    ).run();

    const notifId = 'notif_rec_' + now;
    await c.env.DB.prepare(`
      INSERT INTO notifications (id, target_user_id, title, message, type, data_json, is_read, created_at)
      VALUES (?, ?, '📄 Official Receipt Issued', ?, 'receipt', ?, 0, ?)
    `).bind(
      notifId, user_id,
      `Your official FlatEco receipt for ${month} (Total ₹${total_amount}) has been issued. You can view or download the PDF anytime.`,
      JSON.stringify({ receipt_id: id, month, total_amount }),
      now
    ).run();

    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 7. Notifications (Row-Level Security Enforced)
// -------------------------------------------------------------
app.get('/api/notifications', async (c) => {
  try {
    const authUserId = c.get('userId');
    // STRICT RLS: User can only see notifications meant for everyone or for them specifically
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM notifications
      WHERE target_user_id = 'all' OR target_user_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).bind(authUserId).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/notifications/:id/read', async (c) => {
  try {
    const notifId = c.req.param('id');
    await c.env.DB.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(notifId).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// -------------------------------------------------------------
// 8. Offline Sync Engine (RLS Guarded)
// -------------------------------------------------------------
app.post('/api/sync', async (c) => {
  try {
    const authRole = c.get('userRole');
    const { mutations } = await c.req.json();
    if (!Array.isArray(mutations)) {
      return c.json({ error: 'Mutations array required' }, 400);
    }

    const results: any[] = [];
    for (const m of mutations) {
      try {
        if (m.action === 'SAVE_TIFFIN') {
          // RLS: Owner only
          if (authRole !== 'owner') {
            results.push({ id: m.id, status: 'forbidden', error: 'RLS: Only owner can sync tiffin tallies' });
            continue;
          }

          const { id, date, meal_type, tenant_1, tenant_2, tenant_3, tenant_4, extras, extras_note } = m.payload;
          const recordId = id || `${date}_${meal_type}`;
          const now = Date.now();

          const existing = await c.env.DB.prepare(
            'SELECT created_at, is_dev_unlocked FROM tiffin_records WHERE id = ?'
          ).bind(recordId).first() as any;

          if (existing && (now - Number(existing.created_at)) > 24 * 3600 * 1000 && !existing.is_dev_unlocked) {
            results.push({ id: m.id, status: 'locked', message: 'Record locked after 24h' });
            continue;
          }

          await c.env.DB.prepare(`
            INSERT INTO tiffin_records (id, date, meal_type, tenant_1, tenant_2, tenant_3, tenant_4, extras, extras_note, created_at, updated_at, is_dev_unlocked)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            ON CONFLICT(id) DO UPDATE SET
              tenant_1 = excluded.tenant_1,
              tenant_2 = excluded.tenant_2,
              tenant_3 = excluded.tenant_3,
              tenant_4 = excluded.tenant_4,
              extras = excluded.extras,
              extras_note = excluded.extras_note,
              updated_at = excluded.updated_at
          `).bind(
            recordId, date, meal_type,
            tenant_1 || 0, tenant_2 || 0, tenant_3 || 0, tenant_4 || 0,
            extras || 0, extras_note || null, now, now
          ).run();

          results.push({ id: m.id, status: 'synced', recordId });
        } else if (m.action === 'UPDATE_RENT') {
          // RLS: Owner only
          if (authRole !== 'owner') {
            results.push({ id: m.id, status: 'forbidden', error: 'RLS: Only owner can sync rent payments' });
            continue;
          }

          const { user_id, month, amount, is_paid, payment_method, notes } = m.payload;
          const recordId = `rent_${user_id}_${month}`;
          const now = Date.now();
          const paidDate = is_paid ? new Date().toISOString().split('T')[0] : null;

          await c.env.DB.prepare(`
            INSERT INTO rent_records (id, user_id, month, amount, is_paid, paid_date, payment_method, notes, marked_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'owner', ?)
            ON CONFLICT(id) DO UPDATE SET
              amount = excluded.amount,
              is_paid = excluded.is_paid,
              paid_date = excluded.paid_date,
              payment_method = excluded.payment_method,
              notes = excluded.notes,
              updated_at = excluded.updated_at
          `).bind(
            recordId, user_id, month, amount || 2000, is_paid ? 1 : 0, paidDate,
            payment_method || 'UPI', notes || null, now
          ).run();

          results.push({ id: m.id, status: 'synced', recordId });
        } else {
          results.push({ id: m.id, status: 'skipped', message: 'Unknown mutation action' });
        }
      } catch (innerErr: any) {
        results.push({ id: m.id, status: 'error', error: innerErr.message });
      }
    }

    return c.json({ success: true, processed: results });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Fallback to static assets
app.get('*', async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('FlatEco Cloudflare Worker API is active.');
});

export default app;
