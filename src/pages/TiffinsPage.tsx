import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { TiffinRecord, MealType } from '../types';
import { api } from '../lib/api';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Check,
  Minus,
  Plus,
  Lock,
  Sun,
  Moon,
  UtensilsCrossed,
  Calendar
} from 'lucide-react';

const TIFFIN_PRICE = 60;
const LOCK_HOURS = 24;

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalMonthString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

interface TiffinsPageProps {
  onTabChange?: (tab: string) => void;
}

export const TiffinsPage: React.FC<TiffinsPageProps> = ({ onTabChange }) => {
  const { currentUser, allUsers } = useAuth();
  const isOwner = currentUser?.role === 'owner';

  // Selected month for viewing (YYYY-MM)
  const currentMonthInitial = getLocalMonthString();
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthInitial);

  // Date selection for owner counter
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');

  const [records, setRecords] = useState<TiffinRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all records for the selected month
  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getTiffins(selectedMonth);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load tiffins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth]);

  // Month navigation
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(getLocalMonthString(d));
  };

  // --- TENANT VIEW COMPUTATIONS ---
  const tKey = (currentUser?.id || 'tenant_1') as 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4';

  const tenantMonthStats = useMemo(() => {
    let count = 0;
    for (const r of records) {
      count += (r[tKey] || 0);
    }
    return {
      count,
      amount: count * TIFFIN_PRICE
    };
  }, [records, tKey]);

  // Days list for tenant table (descending order from today or month end)
  const daysInMonth = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const maxDay = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    const days: string[] = [];
    for (let d = maxDay; d >= 1; d--) {
      const dayStr = String(d).padStart(2, '0');
      days.push(`${yearStr}-${monthStr}-${dayStr}`);
    }
    return days;
  }, [selectedMonth]);

  // --- OWNER COUNTER COMPUTATIONS & HANDLERS ---
  const recordId = `${selectedDate}_${selectedMeal}`;
  const currentRecord = useMemo(() => {
    return records.find((r) => r.id === recordId) || {
      id: recordId,
      date: selectedDate,
      meal_type: selectedMeal,
      tenant_1: 0,
      tenant_2: 0,
      tenant_3: 0,
      tenant_4: 0,
      extras: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      is_dev_unlocked: 0
    };
  }, [records, recordId, selectedDate, selectedMeal]);

  const isLocked = useMemo(() => {
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return false;
    const ageInMs = Date.now() - existing.created_at;
    return ageInMs > LOCK_HOURS * 60 * 60 * 1000;
  }, [records, recordId]);

  const tenantUsers = useMemo(() => {
    return [
      { key: 'tenant_1' as const, label: allUsers.find((u) => u.id === 'tenant_1')?.name || 'Priyanshu', id: 'tenant_1' },
      { key: 'tenant_2' as const, label: allUsers.find((u) => u.id === 'tenant_2')?.name || 'Sushil', id: 'tenant_2' },
      { key: 'tenant_3' as const, label: allUsers.find((u) => u.id === 'tenant_3')?.name || 'Varsh', id: 'tenant_3' },
      { key: 'tenant_4' as const, label: allUsers.find((u) => u.id === 'tenant_4')?.name || 'Sunny', id: 'tenant_4' }
    ];
  }, [allUsers]);

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d + days);
    const newDateStr = getLocalDateString(dateObj);
    setSelectedDate(newDateStr);
    const newMonth = getLocalMonthString(dateObj);
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const updateRecord = async (updates: Partial<TiffinRecord>) => {
    if (isLocked) return;

    const updated: TiffinRecord = {
      ...currentRecord,
      ...updates,
      updated_at: Date.now(),
      created_at: currentRecord.created_at || Date.now()
    };

    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    await api.saveTiffin(updated);
  };

  const toggleTenant = (key: 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4') => {
    const currentVal = currentRecord[key] || 0;
    updateRecord({ [key]: currentVal === 1 ? 0 : 1 });
  };

  const setAllTenants = (val: number) => {
    updateRecord({
      tenant_1: val,
      tenant_2: val,
      tenant_3: val,
      tenant_4: val
    });
  };

  const changeExtras = (delta: number) => {
    const nextVal = Math.max(0, (currentRecord.extras || 0) + delta);
    updateRecord({ extras: nextVal });
  };

  const totalMealsThisSlot =
    (currentRecord.tenant_1 || 0) +
    (currentRecord.tenant_2 || 0) +
    (currentRecord.tenant_3 || 0) +
    (currentRecord.tenant_4 || 0) +
    (currentRecord.extras || 0);

  // ==========================================
  // 1. TENANT VIEW: TABLE OF MARKED TIFFINS
  // ==========================================
  if (!isOwner) {
    const [yStr, mStr] = selectedMonth.split('-');
    const monthTitle = new Date(Number(yStr), Number(mStr) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header & Month Selector */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Tiffins</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your daily meal log</p>
          </div>

          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-1">{monthTitle}</span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month Summary Card for Tenant */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm mb-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Meals Taken ({monthTitle})
            </span>
            <span className="text-2xl font-black text-brand-700 dark:text-brand-400 block mt-0.5">
              {tenantMonthStats.count} <span className="text-xs font-medium text-slate-400 dark:text-slate-500">tiffins</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Total Cost
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white block mt-0.5">
              ₹{tenantMonthStats.amount}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">₹{TIFFIN_PRICE} / meal</span>
          </div>
        </div>

        {/* Tiffin Records Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Lunch</th>
                  <th className="py-3 px-3">Dinner</th>
                  <th className="py-3 px-4 text-right">Daily</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {daysInMonth.map((dateStr) => {
                  const lunchRec = records.find((r) => r.date === dateStr && r.meal_type === 'lunch');
                  const dinnerRec = records.find((r) => r.date === dateStr && r.meal_type === 'dinner');

                  const isLunchMarked = lunchRec ? lunchRec[tKey] === 1 : false;
                  const isDinnerMarked = dinnerRec ? dinnerRec[tKey] === 1 : false;
                  const dayMeals = (isLunchMarked ? 1 : 0) + (isDinnerMarked ? 1 : 0);

                  const dateFormatted = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short'
                  });

                  return (
                    <tr key={dateStr} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {dateFormatted}
                      </td>

                      {/* Lunch Column */}
                      <td className="py-3 px-3">
                        {isLunchMarked ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                            <span>Marked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800">
                            Not Marked
                          </span>
                        )}
                      </td>

                      {/* Dinner Column */}
                      <td className="py-3 px-3">
                        {isDinnerMarked ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                            <span>Marked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800">
                            Not Marked
                          </span>
                        )}
                      </td>

                      {/* Daily Total Column */}
                      <td className="py-3 px-4 text-right">
                        {dayMeals > 0 ? (
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {dayMeals} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">(₹{dayMeals * TIFFIN_PRICE})</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. OWNER VIEW: MEAL TICKING BOARD
  // ==========================================
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Owner Top Tabs: Daily Counter vs Tiffin Log */}
      <div className="flex p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl mb-5 border border-slate-200 dark:border-slate-700/60 shadow-xs">
        <button
          className="flex-1 py-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm"
        >
          Daily Tiffin Counter
        </button>
        <button
          onClick={() => onTabChange?.('tiffin-log')}
          className="flex-1 py-2 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Tiffin Log (Bird's Eye)
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Tiffin Counter</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mark daily meals for flatmates</p>
        </div>
        <span className="text-xs font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-950/50 px-2.5 py-1 rounded-xl border border-brand-200 dark:border-brand-800">
          ₹{TIFFIN_PRICE} / meal
        </span>
      </div>

      {/* Date & Meal Slot Control */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 mb-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Date Selector */}
          <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                if (e.target.value.substring(0, 7) !== selectedMonth) {
                  setSelectedMonth(e.target.value.substring(0, 7));
                }
              }}
              className="font-bold text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />

            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setSelectedDate(todayStr);
                setSelectedMonth(todayStr.substring(0, 7));
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                selectedDate === todayStr
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Today
            </button>
          </div>

          {/* Meal Toggle (Lunch vs Dinner) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setSelectedMeal('lunch')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'lunch'
                  ? 'bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Lunch</span>
            </button>
            <button
              onClick={() => setSelectedMeal('dinner')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'dinner'
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Dinner</span>
            </button>
          </div>
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-xs">
            <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>Record locked (24 hours elapsed)</span>
          </div>
        )}
      </div>

      {/* Main Meal Ticking Board */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">4 Roommates</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Tap to mark who took tiffin</p>
          </div>
          {!isLocked && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAllTenants(1)}
                className="text-xs font-semibold bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/40 px-2.5 py-1 rounded-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => setAllTenants(0)}
                className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1 rounded-lg transition-colors"
              >
                None
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {tenantUsers.map((tenant) => {
            const isTicked = currentRecord[tenant.key] === 1;

            return (
              <button
                key={tenant.key}
                disabled={isLocked}
                onClick={() => toggleTenant(tenant.key)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                  isLocked
                    ? 'opacity-80 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    : isTicked
                    ? 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700 ring-1 ring-brand-400 dark:ring-brand-500 shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                      isTicked
                        ? 'bg-brand-600 text-white'
                        : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                    }`}
                  >
                    {isTicked ? <CheckCircle2 className="w-4 h-4 fill-brand-600 text-white" /> : null}
                  </div>

                  <div>
                    <span className={`text-sm font-bold block ${isTicked ? 'text-brand-900 dark:text-brand-200' : 'text-slate-800 dark:text-slate-200'}`}>
                      {tenant.label}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {isTicked ? 'Meal Marked' : 'Not taken'}
                    </span>
                  </div>
                </div>

                <span className={`text-xs font-bold ${isTicked ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {isTicked ? `₹${TIFFIN_PRICE}` : '₹0'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extras Counter */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Extra Meals</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Guests / extra tiffins (₹{TIFFIN_PRICE} each)</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            disabled={isLocked || (currentRecord.extras || 0) <= 0}
            onClick={() => changeExtras(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="text-base font-extrabold text-slate-900 dark:text-white w-6 text-center">
            {currentRecord.extras || 0}
          </span>

          <button
            disabled={isLocked}
            onClick={() => changeExtras(1)}
            className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Slot Total */}
      <div className="px-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
        <span>Slot Total: {totalMealsThisSlot} tiffins</span>
        <span className="font-bold text-slate-700 dark:text-slate-300">₹{totalMealsThisSlot * TIFFIN_PRICE}</span>
      </div>
    </div>
  );
};
