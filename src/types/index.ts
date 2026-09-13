export type UserRole = 'owner' | 'tenant';

export interface UserProfile {
  id: string; // 'owner' | 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4'
  name: string;
  role: UserRole;
  room_or_info?: string;
  pin: string;
  created_at: number;
}

export type MealType = 'lunch' | 'dinner' | 'single';

export interface TiffinRecord {
  id: string; // YYYY-MM-DD_meal_type
  date: string; // YYYY-MM-DD
  meal_type: MealType;
  tenant_1: number; // 0 or 1
  tenant_2: number;
  tenant_3: number;
  tenant_4: number;
  extras: number;
  extras_note?: string;
  created_at: number; // ms timestamp
  updated_at: number;
  is_dev_unlocked?: number; // 1 if unlocked past 24h by dev
}

export interface RentRecord {
  id: string; // rent_tenant_1_YYYY-MM
  user_id: string;
  month: string; // YYYY-MM
  amount: number; // Rs 2000 default
  is_paid: number; // 0 or 1
  paid_date?: string;
  payment_method?: string; // UPI, Cash, Bank Transfer
  notes?: string;
  marked_by?: string;
  updated_at: number;
}

export interface ElectricityBill {
  id: string;
  billing_month: string; // YYYY-MM
  bill_number?: string;
  total_amount: number;
  per_person_share: number;
  due_date?: string;
  image_data?: string; // Base64 data URL
  status: 'active' | 'archived';
  notes?: string;
  created_at: number;
}

export interface AppNotification {
  id: string;
  target_user_id: string; // 'all' or specific user_id
  title: string;
  message: string;
  type: 'bill' | 'rent' | 'lock' | 'system';
  data_json?: string;
  is_read: number;
  created_at: number;
}

export interface AppSettings {
  tiffin_price: number; // 60
  monthly_rent: number; // 2000
  lock_duration_hours: number; // 24
  flat_name: string;
  owner_upi: string;
  dev_passkey?: string;
}

export interface OfflineMutation {
  id: string;
  action: 'SAVE_TIFFIN' | 'UPDATE_RENT' | 'UPLOAD_BILL' | 'DEV_UNLOCK';
  payload: any;
  created_at: number;
  status: 'pending' | 'syncing' | 'failed';
  retries: number;
}
