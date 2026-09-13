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

export const TiffinsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const isOwner = currentUser?.role === 'owner';

  // Selected month for viewing (YYYY-MM)
  const currentMonthInitial = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthInitial);

  // Date selection for owner counter
  const todayStr = new Date().toISOString().split('T')[0];
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
    setSelectedMonth(d.toISOString().substring(0, 7));
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
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
    if (newDateStr.substring(0, 7) !== selectedMonth) {
      setSelectedMonth(newDateStr.substring(0, 7));
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
    const monthTitle = new Date(selectedMonth + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header & Month Selector */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Tiffins</h1>
            <p className="text-xs text-slate-500 mt-0.5">Your daily meal log</p>
          </div>

          <div className="flex items-center space-x-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-1">{monthTitle}</span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month Summary Card for Tenant */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm mb-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Meals Taken ({monthTitle})
            </span>
            <span className="text-2xl font-black text-brand-700 block mt-0.5">
              {tenantMonthStats.count} <span className="text-xs font-medium text-slate-400">tiffins</span>
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Cost
            </span>
            <span className="text-2xl font-black text-slate-900 block mt-0.5">
              ₹{tenantMonthStats.amount}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">₹{TIFFIN_PRICE} / meal</span>
          </div>
        </div>

        {/* Tiffin Records Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Lunch</th>
                  <th className="py-3 px-3">Dinner</th>
                  <th className="py-3 px-4 text-right">Daily</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                    <tr key={dateStr} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {dateFormatted}
                      </td>

                      {/* Lunch Column */}
                      <td className="py-3 px-3">
                        {isLunchMarked ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                            <span>Marked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-400 bg-slate-100">
                            Not Marked
                          </span>
                        )}
                      </td>

                      {/* Dinner Column */}
                      <td className="py-3 px-3">
                        {isDinnerMarked ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                            <span>Marked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-slate-400 bg-slate-100">
                            Not Marked
                          </span>
                        )}
                      </td>

                      {/* Daily Total Column */}
                      <td className="py-3 px-4 text-right">
                        {dayMeals > 0 ? (
                          <span className="font-extrabold text-slate-900">
                            {dayMeals} <span className="text-[10px] text-slate-500 font-medium">(₹{dayMeals * TIFFIN_PRICE})</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">—</span>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Tiffin Counter</h1>
          <p className="text-xs text-slate-500 mt-0.5">Mark daily meals for flatmates</p>
        </div>
        <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-xl border border-brand-200">
          ₹{TIFFIN_PRICE} / meal
        </span>
      </div>

      {/* Date & Meal Slot Control */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Date Selector */}
          <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
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
              className="font-bold text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
            />

            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
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
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Today
            </button>
          </div>

          {/* Meal Toggle (Lunch vs Dinner) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setSelectedMeal('lunch')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'lunch'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Lunch</span>
            </button>
            <button
              onClick={() => setSelectedMeal('dinner')}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'dinner'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Dinner</span>
            </button>
          </div>
        </div>

        {/* Lock Banner */}
        {isLocked && (
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2 text-slate-500 text-xs">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Record locked (24 hours elapsed)</span>
          </div>
        )}
      </div>

      {/* Main Meal Ticking Board */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800">4 Roommates</h2>
            <p className="text-xs text-slate-400">Tap to mark who took tiffin</p>
          </div>
          {!isLocked && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAllTenants(1)}
                className="text-xs font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                All
              </button>
              <button
                onClick={() => setAllTenants(0)}
                className="text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
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
                    ? 'opacity-80 cursor-not-allowed bg-slate-50 border-slate-200'
                    : isTicked
                    ? 'bg-brand-50/70 border-brand-300 ring-1 ring-brand-400 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                      isTicked
                        ? 'bg-brand-600 text-white'
                        : 'border-2 border-slate-300 bg-white'
                    }`}
                  >
                    {isTicked ? <CheckCircle2 className="w-4 h-4 fill-brand-600 text-white" /> : null}
                  </div>

                  <div>
                    <span className={`text-sm font-bold block ${isTicked ? 'text-brand-900' : 'text-slate-800'}`}>
                      {tenant.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isTicked ? 'Meal Marked' : 'Not taken'}
                    </span>
                  </div>
                </div>

                <span className={`text-xs font-bold ${isTicked ? 'text-brand-700' : 'text-slate-400'}`}>
                  {isTicked ? `₹${TIFFIN_PRICE}` : '₹0'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extras Counter */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Extra Meals</h2>
          <p className="text-xs text-slate-400">Guests / extra tiffins (₹{TIFFIN_PRICE} each)</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            disabled={isLocked || (currentRecord.extras || 0) <= 0}
            onClick={() => changeExtras(-1)}
            className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>

          <span className="text-base font-extrabold text-slate-900 w-6 text-center">
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
      <div className="px-2 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Slot Total: {totalMealsThisSlot} tiffins</span>
        <span className="font-bold text-slate-700">₹{totalMealsThisSlot * TIFFIN_PRICE}</span>
      </div>
    </div>
  );
};
