import { localDB } from './idb';
import {
  UserProfile,
  TiffinRecord,
  RentRecord,
  ElectricityBill,
  ReceiptRecord,
  AppNotification,
  AppSettings
} from '../types';

// Default mock profiles for instant out-of-the-box usage
export const DEFAULT_PROFILES: UserProfile[] = [
  { id: 'owner', name: 'Apartment Owner', role: 'owner', room_or_info: 'Owner / Caretaker', pin: '1234', created_at: Date.now() },
  { id: 'tenant_1', name: 'Priyanshu', role: 'tenant', room_or_info: 'Tenant', pin: '1234', created_at: Date.now() },
  { id: 'tenant_2', name: 'Sushil', role: 'tenant', room_or_info: 'Tenant', pin: '1234', created_at: Date.now() },
  { id: 'tenant_3', name: 'Varsh', role: 'tenant', room_or_info: 'Tenant', pin: '1234', created_at: Date.now() },
  { id: 'tenant_4', name: 'Sunny', role: 'tenant', room_or_info: 'Tenant', pin: '1234', created_at: Date.now() },
];

export const DEFAULT_SETTINGS: AppSettings = {
  tiffin_price: 60,
  monthly_rent: 2000,
  lock_duration_hours: 24,
  flat_name: 'Bachelor Apartment 402',
  owner_upi: 'owner@okhdfcbank',
};

class ApiClient {
  private sessionToken: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('flat_eco_token') : null;

  setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (token) {
      localStorage.setItem('flat_eco_token', token);
    } else {
      localStorage.removeItem('flat_eco_token');
    }
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }

  private getHeaders(userId?: string, devKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }
    if (userId) headers['x-user-id'] = userId;
    if (devKey) headers['x-dev-key'] = devKey;
    return headers;
  }

  // --- Users & Auth ---
  async getUsers(): Promise<UserProfile[]> {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            await localDB.putMany('users', data);
            return data;
          }
        }
      }
    } catch {
      // offline fallback
    }

    const localUsers = await localDB.getAll<UserProfile>('users');
    if (localUsers.length > 0) return localUsers;

    // Seed defaults into localDB
    await localDB.putMany('users', DEFAULT_PROFILES);
    return DEFAULT_PROFILES;
  }

  async checkSession(): Promise<{ user?: UserProfile } | null> {
    if (!this.sessionToken) return null;
    try {
      const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // network issue
    }
    return null;
  }

  async getPasskeyStatus(userId: string): Promise<{ hasPasskey: boolean; count: number; devices?: any[] }> {
    try {
      const res = await fetch(`/api/auth/passkey/status?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return { hasPasskey: false, count: 0 };
  }

  async getPasskeyRegisterOptions(userId: string, setupPin?: string): Promise<any> {
    const res = await fetch('/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, setupPin })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize passkey registration');
    return data;
  }

  async verifyPasskeyRegister(userId: string, credential: any, deviceName?: string): Promise<{ success: boolean; token?: string; user?: UserProfile; error?: string }> {
    const res = await fetch('/api/auth/passkey/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, credential, deviceName })
    });
    const data = await res.json();
    if (data.token) {
      this.setSessionToken(data.token);
    }
    return data;
  }

  async getPasskeyAuthOptions(userId: string): Promise<any> {
    const res = await fetch('/api/auth/passkey/auth-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initialize passkey authentication');
    return data;
  }

  async verifyPasskeyAuth(userId: string, assertion: any, deviceName?: string): Promise<{ success: boolean; token?: string; user?: UserProfile; error?: string }> {
    const res = await fetch('/api/auth/passkey/auth-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, assertion, deviceName })
    });
    const data = await res.json();
    if (data.token) {
      this.setSessionToken(data.token);
    }
    return data;
  }

  async logoutServer(): Promise<void> {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: this.getHeaders() });
    } catch {}
    this.setSessionToken(null);
  }

  async login(userId: string, pin: string, deviceName?: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ userId, pin, deviceName })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            this.setSessionToken(data.token);
          }
          return data;
        } else {
          const err = await res.json();
          return { success: false, error: err.error || 'Login failed' };
        }
      }
    } catch {
      // offline fallback
    }

    // Offline PIN verification from local storage
    const users = await this.getUsers();
    const match = users.find(u => u.id === userId);
    if (!match) return { success: false, error: 'User not found' };
    if (match.pin && match.pin !== pin) return { success: false, error: 'Incorrect PIN' };
    return { success: true, user: match };
  }

  // --- Tiffins ---
  async getTiffins(month?: string): Promise<TiffinRecord[]> {
    try {
      if (navigator.onLine) {
        const url = month ? `/api/tiffins?month=${month}` : '/api/tiffins';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            await localDB.putMany('tiffins', data);
            return data;
          }
        }
      }
    } catch {
      // offline
    }

    const all = await localDB.getAll<TiffinRecord>('tiffins');
    if (month) {
      return all.filter(t => t.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
    }
    return all.sort((a, b) => b.date.localeCompare(a.date));
  }

  async saveTiffin(record: TiffinRecord, devKey?: string): Promise<{ success: boolean; error?: string; isLocked?: boolean }> {
    // 1. Immediately save to local IndexedDB for offline resilience
    await localDB.put('tiffins', record);

    // 2. Try network sync
    if (navigator.onLine) {
      try {
        const res = await fetch('/api/tiffins', {
          method: 'POST',
          headers: this.getHeaders(undefined, devKey),
          body: JSON.stringify(record)
        });

        if (res.status === 403) {
          const data = await res.json();
          return { success: false, error: data.message || 'Record locked after 24 hours', isLocked: true };
        }

        if (res.ok) {
          return { success: true };
        }
      } catch (err: any) {
        console.warn('Network error saving tiffin, queued offline', err);
      }
    }

    // 3. Queue mutation for later sync if offline
    await localDB.addMutation('SAVE_TIFFIN', record);
    return { success: true };
  }

  // --- Rent ---
  async getRent(userId?: string, month?: string): Promise<RentRecord[]> {
    try {
      if (navigator.onLine) {
        const url = month ? `/api/rent?month=${month}` : '/api/rent';
        const res = await fetch(url, { headers: this.getHeaders(userId) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            await localDB.putMany('rent', data);
            return data;
          }
        }
      }
    } catch {
      // offline
    }

    let all = await localDB.getAll<RentRecord>('rent');
    if (userId && userId !== 'owner') {
      all = all.filter(r => r.user_id === userId);
    }
    if (month) {
      all = all.filter(r => r.month === month);
    }
    return all;
  }

  async updateRent(record: Partial<RentRecord> & { user_id: string; month: string }, currentUserId: string): Promise<boolean> {
    const fullRecord: RentRecord = {
      id: `rent_${record.user_id}_${record.month}`,
      user_id: record.user_id,
      month: record.month,
      amount: record.amount ?? 2000,
      is_paid: record.is_paid ?? 0,
      paid_date: record.is_paid ? (record.paid_date || new Date().toISOString().split('T')[0]) : undefined,
      payment_method: record.payment_method || 'UPI',
      notes: record.notes,
      marked_by: 'owner',
      updated_at: Date.now()
    };

    await localDB.put('rent', fullRecord);

    if (navigator.onLine) {
      try {
        const res = await fetch('/api/rent', {
          method: 'POST',
          headers: this.getHeaders(currentUserId),
          body: JSON.stringify(fullRecord)
        });
        if (res.ok) return true;
      } catch {
        // queue offline
      }
    }

    await localDB.addMutation('UPDATE_RENT', fullRecord);
    return true;
  }

  // --- Electricity Bills ---
  async getBills(): Promise<ElectricityBill[]> {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/bills');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            await localDB.putMany('bills', data);
            return data;
          }
        }
      }
    } catch {
      // offline
    }
    return await localDB.getAll<ElectricityBill>('bills');
  }

  async uploadBill(bill: Partial<ElectricityBill> & { billing_month: string; total_amount: number }, currentUserId: string): Promise<boolean> {
    const perPerson = Math.round(bill.total_amount / 4);
    const fullBill: ElectricityBill = {
      id: 'bill_' + bill.billing_month,
      billing_month: bill.billing_month,
      bill_number: bill.bill_number,
      total_amount: bill.total_amount,
      per_person_share: perPerson,
      due_date: bill.due_date,
      image_data: bill.image_data,
      status: 'active',
      notes: bill.notes,
      created_at: Date.now()
    };

    await localDB.put('bills', fullBill);

    // Create local notification for tenants
    await localDB.put('notifications', {
      id: 'notif_bill_' + Date.now(),
      target_user_id: 'all',
      title: '⚡ New Electricity Bill Uploaded',
      message: `Electricity bill for ${bill.billing_month} is ₹${bill.total_amount}. Each share: ₹${perPerson}`,
      type: 'bill',
      is_read: 0,
      created_at: Date.now()
    });

    if (navigator.onLine) {
      try {
        const res = await fetch('/api/bills', {
          method: 'POST',
          headers: this.getHeaders(currentUserId),
          body: JSON.stringify(fullBill)
        });
        if (res.ok) return true;
      } catch {
        // queue offline
      }
    }

    await localDB.addMutation('UPLOAD_BILL', fullBill);
    return true;
  }

  // --- Receipts ---
  async getReceipts(userId?: string): Promise<ReceiptRecord[]> {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/receipts', { headers: this.getHeaders(userId) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            await localDB.putMany('receipts', data);
            return data;
          }
        }
      }
    } catch {
      // offline
    }

    let all = await localDB.getAll<ReceiptRecord>('receipts');
    if (userId && userId !== 'owner') {
      all = all.filter(r => r.user_id === userId);
    }
    return all.sort((a, b) => b.issued_at - a.issued_at);
  }

  async issueReceipt(receipt: ReceiptRecord, currentUserId: string): Promise<boolean> {
    await localDB.put('receipts', receipt);

    // Create notification locally
    await localDB.put('notifications', {
      id: 'notif_rec_' + Date.now(),
      target_user_id: receipt.user_id,
      title: '📄 Official Receipt Issued',
      message: `Receipt for ${receipt.month} (Total ₹${receipt.total_amount}) has been issued.`,
      type: 'receipt',
      is_read: 0,
      created_at: Date.now()
    });

    if (navigator.onLine) {
      try {
        const res = await fetch('/api/receipts', {
          method: 'POST',
          headers: this.getHeaders(currentUserId),
          body: JSON.stringify(receipt)
        });
        if (res.ok) return true;
      } catch {
        // queue
      }
    }

    await localDB.addMutation('CREATE_RECEIPT', receipt);
    return true;
  }

  // --- Notifications ---
  async getNotifications(userId: string): Promise<AppNotification[]> {
    try {
      if (navigator.onLine) {
        const res = await fetch(`/api/notifications?user_id=${userId}`, { headers: this.getHeaders(userId) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            await localDB.putMany('notifications', data);
            return data;
          }
        }
      }
    } catch {
      // offline
    }

    const all = await localDB.getAll<AppNotification>('notifications');
    return all.filter(n => n.target_user_id === 'all' || n.target_user_id === userId)
              .sort((a, b) => b.created_at - a.created_at);
  }

  async markNotificationRead(id: string): Promise<void> {
    const notif = await localDB.get<AppNotification>('notifications', id);
    if (notif) {
      notif.is_read = 1;
      await localDB.put('notifications', notif);
    }
    if (navigator.onLine) {
      try {
        await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      } catch {
        // ignore
      }
    }
  }

  // --- Developer Unlock ---
  async devUnlock(passkey: string, recordId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (navigator.onLine) {
        const res = await fetch('/api/dev/unlock', {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ passkey, recordId })
        });
        const data = await res.json();
        return data;
      }
    } catch {
      // offline fallback
    }

    // Offline dev key check
    if (passkey === 'flatdev2026') {
      if (recordId) {
        const rec = await localDB.get<TiffinRecord>('tiffins', recordId);
        if (rec) {
          rec.is_dev_unlocked = 1;
          await localDB.put('tiffins', rec);
        }
      }
      return { success: true, message: 'Developer mode verified.' };
    }
    return { success: false, error: 'Invalid developer passkey' };
  }

  // --- Full Offline Mutation Sync Flush ---
  async flushOfflineQueue(): Promise<{ total: number; synced: number }> {
    const pending = await localDB.getPendingMutations();
    if (pending.length === 0) return { total: 0, synced: 0 };
    if (!navigator.onLine) return { total: pending.length, synced: 0 };

    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ mutations: pending })
      });

      if (res.ok) {
        const data = await res.json();
        for (const item of (data.processed || [])) {
          if (item.status === 'synced' || item.status === 'locked') {
            await localDB.removeMutation(item.id);
          }
        }
        return { total: pending.length, synced: data.processed?.length || 0 };
      }
    } catch (err) {
      console.warn('Sync flush error:', err);
    }

    return { total: pending.length, synced: 0 };
  }
}

export const api = new ApiClient();
