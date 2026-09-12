import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { TiffinRecord, MealType } from '../types';
import { api } from '../lib/api';
import {
  UtensilsCrossed,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  CheckCircle2,
  Circle,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Clock,
  ShieldAlert,
  Info
} from 'lucide-react';

const TIFFIN_PRICE = 60;
const LOCK_HOURS = 24;

export const TiffinsPage: React.FC = () => {
  const { currentUser, allUsers, isDevMode, devPasskey } = useAuth();
  const { isOnline, syncNow } = useSync();

  // Date selection
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');

  // All tiffin records for current month
  const [records, setRecords] = useState<TiffinRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dev unlock modal
  const [showDevModal, setShowDevModal] = useState(false);
  const [enteredDevKey, setEnteredDevKey] = useState('');
  const [devError, setDevError] = useState('');

  // Extras custom note modal
  const [extrasNote, setExtrasNote] = useState('');

  // Selected month derived from selectedDate
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

  // Current active record for the selected date & meal
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
      extras_note: '',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_dev_unlocked: 0
    };
  }, [records, recordId, selectedDate, selectedMeal]);

  useEffect(() => {
    setExtrasNote(currentRecord.extras_note || '');
  }, [currentRecord]);

  // 24-Hour Locking Check
  const isLocked = useMemo(() => {
    // If it's a completely new unsaved record for today, it's not locked
    const existing = records.find((r) => r.id === recordId);
    if (!existing) return false;

    // If developer mode is active or record was marked dev_unlocked
    if (isDevMode || existing.is_dev_unlocked === 1) return false;

    const ageInMs = Date.now() - existing.created_at;
    return ageInMs > LOCK_HOURS * 60 * 60 * 1000;
  }, [records, recordId, isDevMode]);

  // Roommates (Tenant 1 to 4)
  const tenantUsers = useMemo(() => {
    return [
      { key: 'tenant_1' as const, label: allUsers.find((u) => u.id === 'tenant_1')?.name || 'Tenant 1 (Me)', id: 'tenant_1' },
      { key: 'tenant_2' as const, label: allUsers.find((u) => u.id === 'tenant_2')?.name || 'Tenant 2', id: 'tenant_2' },
      { key: 'tenant_3' as const, label: allUsers.find((u) => u.id === 'tenant_3')?.name || 'Tenant 3', id: 'tenant_3' },
      { key: 'tenant_4' as const, label: allUsers.find((u) => u.id === 'tenant_4')?.name || 'Tenant 4', id: 'tenant_4' }
    ];
  }, [allUsers]);

  // Date Navigation
  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle or update tiffins
  const updateRecord = async (updates: Partial<TiffinRecord>) => {
    if (isLocked) {
      showToast('🔒 Record locked after 24 hours. Dev access needed.', 'error');
      return;
    }

    const updated: TiffinRecord = {
      ...currentRecord,
      ...updates,
      updated_at: Date.now(),
      created_at: currentRecord.created_at || Date.now()
    };

    // Optimistically update local state
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === recordId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    const res = await api.saveTiffin(updated, isDevMode ? devPasskey : undefined);
    if (!res.success && res.isLocked) {
      showToast(res.error || 'Record is locked after 24 hours!', 'error');
      fetchRecords(); // rollback
    } else {
      showToast('Saved successfully', 'success');
    }
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
    updateRecord({ extras: nextVal, extras_note: extrasNote });
  };

  const saveExtrasNote = () => {
    updateRecord({ extras_note: extrasNote });
  };

  // Dev passcode unlock
  const handleDevUnlock = async () => {
    setDevError('');
    const res = await api.devUnlock(enteredDevKey, recordId);
    if (res.success) {
      setShowDevModal(false);
      setEnteredDevKey('');
      showToast('Record unlocked by Developer! You can now edit.', 'success');
      fetchRecords();
    } else {
      setDevError(res.error || 'Incorrect Developer Passkey');
    }
  };

  // Stats calculation
  const totalMealsThisSlot =
    (currentRecord.tenant_1 || 0) +
    (currentRecord.tenant_2 || 0) +
    (currentRecord.tenant_3 || 0) +
    (currentRecord.tenant_4 || 0) +
    (currentRecord.extras || 0);

  const slotCost = totalMealsThisSlot * TIFFIN_PRICE;

  // Monthly stats per tenant
  const monthStats = useMemo(() => {
    let t1 = 0, t2 = 0, t3 = 0, t4 = 0, extras = 0;
    for (const r of records) {
      t1 += r.tenant_1 || 0;
      t2 += r.tenant_2 || 0;
      t3 += r.tenant_3 || 0;
      t4 += r.tenant_4 || 0;
      extras += r.extras || 0;
    }
    return {
      t1, t2, t3, t4, extras,
      total: t1 + t2 + t3 + t4 + extras,
      totalCost: (t1 + t2 + t3 + t4 + extras) * TIFFIN_PRICE
    };
  }, [records]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-18 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm animate-in fade-in slide-in-from-top-3 ${
          toastMessage.type === 'error'
            ? 'bg-red-50 text-red-800 border-red-200'
            : toastMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {toastMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-brand-600/15 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Daily Tiffin Board</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Today's Meals & Food Counter</h1>
            <p className="text-brand-100 text-xs sm:text-sm mt-0.5">
              Rate: <span className="font-bold text-white">₹{TIFFIN_PRICE}</span> per tiffin • Auto-locked after {LOCK_HOURS} hours
            </p>
          </div>

          {/* Quick Summary Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 flex items-center justify-between sm:justify-start gap-4">
            <div>
              <p className="text-[11px] text-brand-100 uppercase tracking-wider font-medium">Slot Total</p>
              <p className="text-xl font-extrabold">{totalMealsThisSlot} <span className="text-xs font-normal">tiffins</span></p>
            </div>
            <div className="text-right pl-3 border-l border-white/20">
              <p className="text-[11px] text-brand-100 uppercase tracking-wider font-medium">Amount</p>
              <p className="text-xl font-extrabold text-amber-300">₹{slotCost}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Date & Meal Slot Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Date Selector */}
          <div className="flex items-center space-x-1 sm:space-x-2 w-full sm:w-auto justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="font-bold text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              />
            </div>

            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-5 h-5" />
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
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'lunch'
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ☀️ Lunch
            </button>
            <button
              onClick={() => setSelectedMeal('dinner')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                selectedMeal === 'dinner'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌙 Dinner
            </button>
          </div>
        </div>

        {/* 24-Hour Lock Alert Banner */}
        {isLocked && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 text-amber-800">
              <Lock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xs font-bold">Record Locked (24+ Hours Elapsed)</p>
                <p className="text-[11px] text-amber-700">
                  Ticks are frozen after 24 hours to prevent accidental loss or altering.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowDevModal(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm transition-colors"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Dev Unlock</span>
            </button>
          </div>
        )}

        {isDevMode && (
          <div className="mt-3 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-800 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-4 h-4 text-purple-600" /> Dev Override Active: 24h locks bypassed.
            </span>
            <span className="text-[10px] font-bold uppercase bg-purple-200 text-purple-900 px-2 py-0.5 rounded">Unlocked</span>
          </div>
        )}
      </div>

      {/* Main Ticking Board (Touch-Optimized) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Flatmates (4 People) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">4 Roommates</h2>
              <p className="text-[11px] text-slate-400">Tap to mark food taken (₹{TIFFIN_PRICE})</p>
            </div>
            {!isLocked && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setAllTenants(1)}
                  className="text-[11px] font-semibold bg-brand-50 text-brand-700 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Tick All
                </button>
                <button
                  onClick={() => setAllTenants(0)}
                  className="text-[11px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  Clear All
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
                      ? 'opacity-85 cursor-not-allowed bg-slate-50 border-slate-200'
                      : isTicked
                      ? 'bg-brand-50/80 border-brand-300 ring-1 ring-brand-400 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                        isTicked
                          ? 'bg-brand-600 text-white'
                          : 'border-2 border-slate-300 bg-white'
                      }`}
                    >
                      {isTicked ? <CheckCircle2 className="w-5 h-5 fill-brand-600 text-white" /> : null}
                    </div>

                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-sm font-bold ${isTicked ? 'text-brand-900' : 'text-slate-800'}`}>
                          {tenant.label}
                        </span>
                        {isMyProfile && (
                          <span className="text-[10px] bg-brand-100 text-brand-800 font-bold px-1.5 py-0.2 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {isTicked ? `1 Tiffin (₹${TIFFIN_PRICE})` : 'No tiffin taken'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-bold ${isTicked ? 'text-brand-700' : 'text-slate-400'}`}>
                      {isTicked ? `+ ₹${TIFFIN_PRICE}` : '₹0'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Extras Column & Notes */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Extras & Guests Column</h2>
                <p className="text-[11px] text-slate-400">Additional tiffins taken (₹{TIFFIN_PRICE} each)</p>
              </div>
              <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                {currentRecord.extras || 0} Extra
              </span>
            </div>

            {/* Extras Counter Widget */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between mb-4">
              <div className="text-left">
                <span className="text-xs font-semibold text-slate-700 block">Extra Tiffins Count</span>
                <span className="text-xs text-slate-400">Total: ₹{(currentRecord.extras || 0) * TIFFIN_PRICE}</span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  disabled={isLocked || (currentRecord.extras || 0) <= 0}
                  onClick={() => changeExtras(-1)}
                  className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <span className="text-lg font-black text-slate-900 w-8 text-center">
                  {currentRecord.extras || 0}
                </span>

                <button
                  disabled={isLocked}
                  onClick={() => changeExtras(1)}
                  className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Note for Extras */}
            <div className="text-left">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Extras Description / Guest Name (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={isLocked}
                  value={extrasNote}
                  onChange={(e) => setExtrasNote(e.target.value)}
                  onBlur={saveExtrasNote}
                  placeholder="e.g. Guest of Tenant 2, Sunday treat"
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                />
                {!isLocked && (
                  <button
                    onClick={saveExtrasNote}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              All ticks are recorded with a timestamp. They remain fully editable for 24 hours from creation date, then lock securely.
            </span>
          </div>
        </div>
      </div>

      {/* Month Running Tiffin Overview */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Month Summary ({new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})
            </h3>
            <p className="text-xs text-slate-400">Total food consumed and cost across the whole month</p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-bold text-slate-700">Total: {monthStats.total} tiffins</span>
            <span className="font-black text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
              ₹{monthStats.totalCost}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {tenantUsers.map((tenant) => {
            const count =
              tenant.key === 'tenant_1' ? monthStats.t1 :
              tenant.key === 'tenant_2' ? monthStats.t2 :
              tenant.key === 'tenant_3' ? monthStats.t3 : monthStats.t4;
            const cost = count * TIFFIN_PRICE;
            const isMe = currentUser?.id === tenant.id;

            return (
              <div
                key={tenant.key}
                className={`p-3 rounded-xl border text-center ${
                  isMe ? 'bg-brand-50/50 border-brand-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700 block truncate">{tenant.label}</span>
                <span className="text-base font-extrabold text-slate-900 block my-0.5">{count} meals</span>
                <span className="text-xs font-bold text-brand-700">₹{cost}</span>
              </div>
            );
          })}

          {/* Extras */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-center col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-amber-900 block">Extras</span>
            <span className="text-base font-extrabold text-slate-900 block my-0.5">{monthStats.extras} meals</span>
            <span className="text-xs font-bold text-amber-700">₹{monthStats.extras * TIFFIN_PRICE}</span>
          </div>
        </div>
      </div>

      {/* Developer Passcode Modal for Unlocking */}
      {showDevModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <Unlock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Developer Unlock</h3>
            <p className="text-xs text-slate-500 mt-1">
              This record is over 24 hours old. To unlock and correct historical records, enter the Developer Passkey.
            </p>

            {devError && (
              <div className="mt-3 p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs">
                {devError}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Developer Passkey</label>
              <input
                type="password"
                value={enteredDevKey}
                onChange={(e) => setEnteredDevKey(e.target.value)}
                placeholder="Enter passkey (e.g. flatdev2026)"
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                onClick={() => {
                  setShowDevModal(false);
                  setEnteredDevKey('');
                  setDevError('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDevUnlock}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors"
              >
                Unlock Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
