import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { RentRecord, UserProfile } from '../types';
import { api } from '../lib/api';
import {
  Home,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const MONTHLY_RENT = 2000;

export const RentPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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

  const isOwner = currentUser?.role === 'owner';
  const tenants = useMemo(() => allUsers.filter((u) => u.role === 'tenant'), [allUsers]);

  // Months for selected year
  const monthsOfYear = useMemo(() => {
    const list: string[] = [];
    for (let m = 12; m >= 1; m--) {
      const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      list.push(monthStr);
    }
    return list;
  }, [selectedYear]);

  const getRecord = (userId: string, month: string): RentRecord | undefined => {
    return rentRecords.find((r) => r.user_id === userId && r.month === month);
  };

  // Toggle rent (Owner only)
  const handleToggleRent = async (tenant: UserProfile, month: string) => {
    if (!isOwner || !currentUser) return;

    const existing = getRecord(tenant.id, month);
    const willBePaid = existing?.is_paid === 1 ? 0 : 1;

    await api.updateRent(
      {
        user_id: tenant.id,
        month,
        amount: MONTHLY_RENT,
        is_paid: willBePaid,
        payment_method: 'UPI',
        paid_date: willBePaid === 1 ? new Date().toISOString().split('T')[0] : undefined
      },
      currentUser.id
    );
    fetchRent();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Rent Log</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">₹{MONTHLY_RENT} / month flat share</p>
        </div>

        <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Previous Year"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear((y) => y + 1)}
            className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Next Year"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TENANT LOG VIEW */}
      {!isOwner && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Your Rent Records ({selectedYear})</h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {monthsOfYear.map((month) => {
              const rec = getRecord(currentUser?.id || '', month);
              const isPaid = rec?.is_paid === 1;
              const dateObj = new Date(month + '-01');
              const monthName = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

              return (
                <div key={month} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200 block">{monthName}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {isPaid && rec?.paid_date ? `Paid on ${rec.paid_date}` : `Rent: ₹${MONTHLY_RENT}`}
                    </span>
                  </div>

                  <div>
                    {isPaid ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Paid</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-bold">
                        <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OWNER LOG VIEW */}
      {isOwner && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Owner Verification Log</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Tap any roommate to toggle Paid / Pending status</p>
          </div>

          <div className="space-y-3">
            {monthsOfYear.map((month) => {
              const dateObj = new Date(month + '-01');
              const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

              return (
                <div key={month} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">{monthName}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">₹{MONTHLY_RENT}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {tenants.map((t) => {
                      const rec = getRecord(t.id, month);
                      const isPaid = rec?.is_paid === 1;

                      return (
                        <button
                          key={t.id}
                          onClick={() => handleToggleRent(t, month)}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            isPaid
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold truncate block">{t.name}</span>
                            {isPaid ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            )}
                          </div>
                          <span className={`text-[10px] font-bold block mt-0.5 ${isPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
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
    </div>
  );
};
