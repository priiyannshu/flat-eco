import { Hono } from 'hono';
import { cors } from 'hono/cors';

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  STORAGE?: R2Bucket; // Optional R2 bucket if user configures it later
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-dev-key']
}));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// -------------------------------------------------------------
// 1. Profiles & Settings
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

app.post('/api/auth/login', async (c) => {
  try {
    const { userId, pin } = await c.req.json();
    const user = await c.env.DB.prepare(
      'SELECT id, name, role, room_or_info, pin, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return c.json({ error: 'User profile not found' }, 404);
    }

    if (user.pin !== pin) {
      return c.json({ error: 'Incorrect PIN' }, 401);
    }

    const { pin: _, ...safeUser } = user as any;
    return c.json({ success: true, user: safeUser });
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
// 2. Tiffins (Daily Tracker with 24-Hour Locking)
// -------------------------------------------------------------
app.get('/api/tiffins', async (c) => {
  try {
    const month = c.req.query('month'); // YYYY-MM
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

    const lockDurationMs = 24 * 60 * 60 * 1000; // 24 hours

    if (existing) {
      const isPast24Hours = (now - Number(existing.created_at)) > lockDurationMs;
      const isDevUnlocked = Number(existing.is_dev_unlocked) === 1;

      // Verify dev passkey if locked
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

      // Update record
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
      // Insert new record
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
// 3. Rent Records
// -------------------------------------------------------------
app.get('/api/rent', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    const month = c.req.query('month');

    // Get current user role
    const currentUser = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    let query = 'SELECT * FROM rent_records';
    let params: any[] = [];

    if (currentUser?.role !== 'owner') {
      // Tenant can ONLY see their own rent history!
      query += ' WHERE user_id = ?';
      params.push(userId);
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
    const userId = c.req.header('x-user-id');
    const currentUser = await c.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (currentUser?.role !== 'owner') {
      return c.json({ error: 'Only apartment owner can mark rent payment status' }, 403);
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
// 4. Electricity Bills & Notifications
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
    const userId = c.req.header('x-user-id');
    const currentUser = await c.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (currentUser?.role !== 'owner') {
      return c.json({ error: 'Only owner can upload electricity bills' }, 403);
    }

    const { billing_month, bill_number, total_amount, due_date, image_data, notes } = await c.req.json();
    const id = 'bill_' + billing_month;
    const now = Date.now();
    const perPersonShare = Math.round(Number(total_amount) / 4); // Split equally among 4 tenants

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

    // Trigger Notification for all tenants!
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
// 5. In-App Receipts
// -------------------------------------------------------------
app.get('/api/receipts', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    const currentUser = await c.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    let query = 'SELECT * FROM receipts';
    let params: any[] = [];

    if (currentUser?.role !== 'owner') {
      query += ' WHERE user_id = ?';
      params.push(userId);
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
    const userId = c.req.header('x-user-id');
    const currentUser = await c.env.DB.prepare(
      'SELECT role FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (currentUser?.role !== 'owner') {
      return c.json({ error: 'Only owner can issue receipts' }, 403);
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

    // Send in-app notification to the tenant
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
// 6. Notifications
// -------------------------------------------------------------
app.get('/api/notifications', async (c) => {
  try {
    const userId = c.req.header('x-user-id');
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM notifications
      WHERE target_user_id = 'all' OR target_user_id = ?
      ORDER BY created_at DESC LIMIT 30
    `).bind(userId || '').all();
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
// 7. Offline Sync Engine (Processes Queue from IndexedDB)
// -------------------------------------------------------------
app.post('/api/sync', async (c) => {
  try {
    const { mutations } = await c.req.json();
    if (!Array.isArray(mutations)) {
      return c.json({ error: 'Mutations array required' }, 400);
    }

    const results: any[] = [];
    for (const m of mutations) {
      try {
        if (m.action === 'SAVE_TIFFIN') {
          const { id, date, meal_type, tenant_1, tenant_2, tenant_3, tenant_4, extras, extras_note } = m.payload;
          const recordId = id || `${date}_${meal_type}`;
          const now = Date.now();

          // Check lock
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
