import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { TiffinRecord, MealType } from '../types';
import { api } from '../lib/api';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
  Minus,
  Lock,
  Sun,
  Moon
} from 'lucide-react';

const TIFFIN_PRICE = 60;
const LOCK_HOURS = 24;

export const TiffinsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');
  const [records, setRecords] = useState<TiffinRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const currentMonthStr = selectedDate.substring(0, 7);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await api.getTiffins(currentMonthStr);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load tiffins:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [currentMonthStr]);

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

  // 24-Hour lock check
  const isLocked = useMemo(() => {
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return false;
    const ageInMs = Date.now() - existing.created_at;
    return ageInMs > LOCK_HOURS * 60 * 60 * 1000;
  }, [records, recordId]);

  const tenantUsers = useMemo(() => {
    return [
      { key: 'tenant_1' as const, label: allUsers.find((u) => u.id === 'tenant_1')?.name || 'Tenant 1', id: 'tenant_1' },
      { key: 'tenant_2' as const, label: allUsers.find((u) => u.id === 'tenant_2')?.name || 'Tenant 2', id: 'tenant_2' },
      { key: 'tenant_3' as const, label: allUsers.find((u) => u.id === 'tenant_3')?.name || 'Tenant 3', id: 'tenant_3' },
      { key: 'tenant_4' as const, label: allUsers.find((u) => u.id === 'tenant_4')?.name || 'Tenant 4', id: 'tenant_4' }
    ];
  }, [allUsers]);

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
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
              onChange={(e) => setSelectedDate(e.target.value)}
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
              onClick={() => setSelectedDate(todayStr)}
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
            <p className="text-xs text-slate-400">₹{TIFFIN_PRICE} per meal</p>
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
            const isMyProfile = currentUser?.id === tenant.id;

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
                      {tenant.label} {isMyProfile ? '(You)' : ''}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isTicked ? 'Meal Taken' : 'No meal'}
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

      {/* Extras Counter (No extras description, clean +/-) */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center justify-between">
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
      <div className="mt-4 px-2 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Slot Total: {totalMealsThisSlot} tiffins</span>
        <span className="font-bold text-slate-700">₹{totalMealsThisSlot * TIFFIN_PRICE}</span>
      </div>
    </div>
  );
};
