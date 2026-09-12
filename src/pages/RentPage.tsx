import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { RentRecord, UserProfile } from '../types';
import { api, DEFAULT_SETTINGS } from '../lib/api';
import {
  Home,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  ExternalLink,
  CreditCard,
  User,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const MONTHLY_RENT = 2000;

export const RentPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Mark rent modal
  const [modalTenant, setModalTenant] = useState<UserProfile | null>(null);
  const [modalMethod, setModalMethod] = useState<'UPI' | 'Cash' | 'Bank Transfer'>('UPI');
  const [modalNotes, setModalNotes] = useState('');

  const fetchRent = async () => {
    setLoading(true);
    try {
      const data = await api.getRent(currentUser?.id);
      setRentRecords(data);
    } catch (err) {
      console.error('Error fetching rent:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRent();
  }, [currentUser]);

  const tenants = useMemo(() => {
    return allUsers.filter((u) => u.role === 'tenant');
  }, [allUsers]);

  // Generate list of months for the selected year
  const monthsOfYear = useMemo(() => {
    const list: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      list.push(monthStr);
    }
    return list;
  }, [selectedYear]);

  // Helper to find record for a tenant & month
  const getRecord = (userId: string, month: string): RentRecord | undefined => {
    return rentRecords.find((r) => r.user_id === userId && r.month === month);
  };

  // Up to which month tenant has submitted rent
  const tenantPaidUpTo = useMemo(() => {
    if (!currentUser || currentUser.role === 'owner') return null;

    const myPaidRecords = rentRecords
      .filter((r) => r.user_id === currentUser.id && r.is_paid === 1)
      .sort((a, b) => b.month.localeCompare(a.month));

    if (myPaidRecords.length === 0) return 'No rent recorded yet';
    const latest = myPaidRecords[0].month;
    const [y, m] = latest.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1);
    return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentUser, rentRecords]);

  // Current month payment status for current tenant
  const isCurrentMonthPaid = useMemo(() => {
    if (!currentUser) return false;
    const curMonthStr = new Date().toISOString().substring(0, 7);
    const rec = getRecord(currentUser.id, curMonthStr);
    return rec?.is_paid === 1;
  }, [currentUser, rentRecords]);

  // Toggle or mark rent (Owner only)
  const handleToggleRent = async (tenant: UserProfile, month: string) => {
    if (currentUser?.role !== 'owner') return;

    const existing = getRecord(tenant.id, month);
    const willBePaid = existing?.is_paid === 1 ? 0 : 1;

    if (willBePaid === 1) {
      // open modal to select method
      setSelectedMonth(month);
      setModalTenant(tenant);
      setModalNotes('');
    } else {
      // Directly mark pending
      await api.updateRent(
        {
          user_id: tenant.id,
          month,
          amount: MONTHLY_RENT,
          is_paid: 0,
          payment_method: 'UPI'
        },
        currentUser.id
      );
      fetchRent();
    }
  };

  const confirmMarkPaid = async () => {
    if (!modalTenant || !currentUser) return;
    await api.updateRent(
      {
        user_id: modalTenant.id,
        month: selectedMonth,
        amount: MONTHLY_RENT,
        is_paid: 1,
        payment_method: modalMethod,
        notes: modalNotes
      },
      currentUser.id
    );
    setModalTenant(null);
    fetchRent();
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(DEFAULT_SETTINGS.owner_upi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const isOwner = currentUser?.role === 'owner';

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-indigo-600/15 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <Home className="w-3.5 h-3.5" />
              <span>Apartment Rent Tracker</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Monthly Room Rent</h1>
            <p className="text-indigo-100 text-xs sm:text-sm mt-0.5">
              Standard flat share: <span className="font-bold text-white">₹{MONTHLY_RENT}</span> / month per roommate
            </p>
          </div>

          {/* Submission Status Highlight Card for Tenants */}
          {!isOwner && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
              <span className="text-[11px] text-indigo-100 uppercase tracking-wider font-semibold block">
                Rent Submitted Up To:
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <span className="text-base sm:text-lg font-black">{tenantPaidUpTo}</span>
              </div>
              <p className="text-[11px] text-indigo-200 mt-1">
                {isCurrentMonthPaid
                  ? '✅ Current month is fully settled'
                  : '⚠️ Current month payment is pending verification'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tenant View: Fast Payment Info & Personal Ledger */}
      {!isOwner && (
        <div className="space-y-6">
          {/* Quick UPI Card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Make Rent Payment</h2>
            <p className="text-xs text-slate-500 mb-4">
              Transfer directly to the apartment caretaker via UPI. Once transferred, the owner will tick it verified here.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Owner UPI ID</span>
                  <span className="text-sm font-extrabold text-slate-800">{DEFAULT_SETTINGS.owner_upi}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={copyUpi}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUpi ? 'Copied!' : 'Copy UPI'}</span>
                </button>
                <a
                  href={`upi://pay?pa=${DEFAULT_SETTINGS.owner_upi}&pn=ApartmentOwner&am=${MONTHLY_RENT}&cu=INR`}
                  className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pay ₹{MONTHLY_RENT}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Personal Rent History Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-4">Your Rent History ({selectedYear})</h2>

            <div className="divide-y divide-slate-100">
              {monthsOfYear.map((month) => {
                const rec = getRecord(currentUser?.id || '', month);
                const isPaid = rec?.is_paid === 1;
                const dateObj = new Date(month + '-01');
                const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                return (
                  <div key={month} className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">{monthName}</span>
                      <span className="text-xs text-slate-400">
                        {isPaid && rec?.paid_date ? `Paid on ${rec.paid_date} via ${rec.payment_method || 'UPI'}` : 'Amount: ₹' + MONTHLY_RENT}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isPaid ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Paid</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Pending</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Owner View: Grid to Tick Rent for All Tenants */}
      {isOwner && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Owner Verification Grid</h2>
              <p className="text-xs text-slate-400">Tap any roommate's badge to toggle Paid / Pending status</p>
            </div>

            {/* Year Selector */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-extrabold text-slate-800">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {monthsOfYear.map((month) => {
              const dateObj = new Date(month + '-01');
              const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

              return (
                <div key={month} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold text-sm text-slate-800">{monthName}</span>
                    <span className="text-xs text-slate-500 font-medium">Rent: ₹{MONTHLY_RENT}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {tenants.map((t) => {
                      const rec = getRecord(t.id, month);
                      const isPaid = rec?.is_paid === 1;

                      return (
                        <button
                          key={t.id}
                          onClick={() => handleToggleRent(t, month)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isPaid
                              ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100/70 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-800 truncate block">{t.name}</span>
                            {isPaid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>
                          <span
                            className={`text-[11px] font-extrabold ${
                              isPaid ? 'text-emerald-700' : 'text-amber-600'
                            }`}
                          >
                            {isPaid ? 'PAID' : 'PENDING'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Owner Confirmation Modal */}
      {modalTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Confirm Rent Payment</h3>
            <p className="text-xs text-slate-500 mt-1">
              Mark rent of <span className="font-bold text-slate-900">₹{MONTHLY_RENT}</span> as PAID for{' '}
              <span className="font-bold text-slate-900">{modalTenant.name}</span> ({selectedMonth})
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'Cash', 'Bank Transfer'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setModalMethod(method)}
                      className={`py-2 text-xs font-bold rounded-lg border transition-colors ${
                        modalMethod === method
                          ? 'bg-brand-50 border-brand-500 text-brand-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Transaction Ref / Notes (Optional)</label>
                <input
                  type="text"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="e.g. GPay UPI Ref 928392"
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                onClick={() => setModalTenant(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkPaid}
                className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-colors"
              >
                Mark as Paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
