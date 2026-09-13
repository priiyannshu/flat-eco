import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { TiffinRecord, MealType } from '../types';
import { api } from '../lib/api';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Check,
  Plus,
  Minus,
  Sun,
  Moon,
  UtensilsCrossed,
  Sparkles,
  ArrowUpDown,
  KeyRound,
  X
} from 'lucide-react';

const TIFFIN_PRICE = 60;

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

interface TiffinLogPageProps {
  onTabChange?: (tab: string) => void;
}

export const TiffinLogPage: React.FC<TiffinLogPageProps> = ({ onTabChange }) => {
  const { currentUser, allUsers } = useAuth();
  const isOwner = currentUser?.role === 'owner';

  const todayStr = getLocalDateString();
  const currentMonthInitial = getLocalMonthString();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthInitial);
  const [mealFilter, setMealFilter] = useState<'all' | 'lunch' | 'dinner'>('all');
  const [sortDescending, setSortDescending] = useState<boolean>(true);
  const [records, setRecords] = useState<TiffinRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  // Dev Unlock modal state
  const [unlockDate, setUnlockDate] = useState<string | null>(null);
  const [unlockPasskey, setUnlockPasskey] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);

  // Fetch all records for the selected month
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTiffins(selectedMonth);
      setRecords(data);
    } catch (err) {
      console.error('Failed to load tiffins for log:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Auto-hide locked notice toast
  useEffect(() => {
    if (lockedNotice) {
      const timer = setTimeout(() => setLockedNotice(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [lockedNotice]);

  // Month navigation
  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(getLocalMonthString(d));
  };

  // Tenant definitions
  const tenantUsers = useMemo(() => {
    return [
      { key: 'tenant_1' as const, label: allUsers.find((u) => u.id === 'tenant_1')?.name || 'Priyanshu', id: 'tenant_1' },
      { key: 'tenant_2' as const, label: allUsers.find((u) => u.id === 'tenant_2')?.name || 'Sushil', id: 'tenant_2' },
      { key: 'tenant_3' as const, label: allUsers.find((u) => u.id === 'tenant_3')?.name || 'Varsh', id: 'tenant_3' },
      { key: 'tenant_4' as const, label: allUsers.find((u) => u.id === 'tenant_4')?.name || 'Sunny', id: 'tenant_4' }
    ];
  }, [allUsers]);

  // Compute days list for the selected month
  const daysList = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    // Show up to today if viewing the current month, or all days if past month
    const maxDay = isCurrentMonth ? today.getDate() : totalDaysInMonth;

    const days: string[] = [];
    if (sortDescending) {
      for (let d = maxDay; d >= 1; d--) {
        const dayStr = String(d).padStart(2, '0');
        days.push(`${yearStr}-${monthStr}-${dayStr}`);
      }
    } else {
      for (let d = 1; d <= maxDay; d++) {
        const dayStr = String(d).padStart(2, '0');
        days.push(`${yearStr}-${monthStr}-${dayStr}`);
      }
    }
    return days;
  }, [selectedMonth, sortDescending]);

  // Helper to check if a date is locked
  // "after a day has passed its entries are locked and show as such while while a day is ongoing its entries are mutable"
  const isDateLocked = useCallback((dateStr: string) => {
    // If it's today, it's ongoing: mutable
    if (dateStr >= todayStr) return false;
    // If it's a past day, check if any record was developer-unlocked
    const lunchRec = records.find((r) => r.id === `${dateStr}_lunch`);
    const dinnerRec = records.find((r) => r.id === `${dateStr}_dinner`);
    if (lunchRec?.is_dev_unlocked === 1 || dinnerRec?.is_dev_unlocked === 1) {
      return false;
    }
    return true; // Day has passed, locked
  }, [todayStr, records]);

  // Get or initialize record
  const getRecord = useCallback((dateStr: string, meal: MealType): TiffinRecord => {
    const id = `${dateStr}_${meal}`;
    const found = records.find((r) => r.id === id);
    if (found) return found;
    return {
      id,
      date: dateStr,
      meal_type: meal,
      tenant_1: 0,
      tenant_2: 0,
      tenant_3: 0,
      tenant_4: 0,
      extras: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
      is_dev_unlocked: 0
    };
  }, [records]);

  // Toggle meal mark for a tenant
  const handleToggleMeal = async (dateStr: string, meal: MealType, tenantKey: 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4') => {
    if (isDateLocked(dateStr)) {
      setLockedNotice(`Locked: Record for ${dateStr} has passed and cannot be changed.`);
      return;
    }

    const currentRec = getRecord(dateStr, meal);
    const newVal = currentRec[tenantKey] === 1 ? 0 : 1;

    const updated: TiffinRecord = {
      ...currentRec,
      [tenantKey]: newVal,
      updated_at: Date.now(),
      created_at: currentRec.created_at || Date.now()
    };

    // Optimistic local update
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    await api.saveTiffin(updated);
  };

  // Update extras for a meal slot
  const handleUpdateExtras = async (dateStr: string, meal: MealType, delta: number) => {
    if (isDateLocked(dateStr)) {
      setLockedNotice(`Locked: Record for ${dateStr} has passed and cannot be changed.`);
      return;
    }

    const currentRec = getRecord(dateStr, meal);
    const nextVal = Math.max(0, (currentRec.extras || 0) + delta);

    const updated: TiffinRecord = {
      ...currentRec,
      extras: nextVal,
      updated_at: Date.now(),
      created_at: currentRec.created_at || Date.now()
    };

    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });

    await api.saveTiffin(updated);
  };

  // Developer unlock submission
  const handleDevUnlock = async () => {
    if (!unlockDate || !unlockPasskey) return;
    setUnlockLoading(true);
    setUnlockError(null);

    try {
      const lunchId = `${unlockDate}_lunch`;
      const dinnerId = `${unlockDate}_dinner`;

      const res1 = await api.devUnlock(unlockPasskey, lunchId);
      const res2 = await api.devUnlock(unlockPasskey, dinnerId);

      if (res1.success || res2.success) {
        await fetchRecords();
        setUnlockDate(null);
        setUnlockPasskey('');
        setLockedNotice(`Unlocked! ${unlockDate} is now open for corrections.`);
      } else {
        setUnlockError(res1.error || 'Invalid developer passkey');
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Unlock failed');
    } finally {
      setUnlockLoading(false);
    }
  };

  // --- BIRD'S EYE VIEW MONTHLY STATISTICS ---
  const monthlyStats = useMemo(() => {
    let tenantCounts = { tenant_1: 0, tenant_2: 0, tenant_3: 0, tenant_4: 0 };
    let totalExtras = 0;
    let totalMeals = 0;
    let todayMeals = 0;

    for (const r of records) {
      const t1 = r.tenant_1 || 0;
      const t2 = r.tenant_2 || 0;
      const t3 = r.tenant_3 || 0;
      const t4 = r.tenant_4 || 0;
      const ext = r.extras || 0;

      tenantCounts.tenant_1 += t1;
      tenantCounts.tenant_2 += t2;
      tenantCounts.tenant_3 += t3;
      tenantCounts.tenant_4 += t4;
      totalExtras += ext;

      const recTotal = t1 + t2 + t3 + t4 + ext;
      totalMeals += recTotal;

      if (r.date === todayStr) {
        todayMeals += recTotal;
      }
    }

    return {
      tenantCounts,
      totalExtras,
      totalMeals,
      totalAmount: totalMeals * TIFFIN_PRICE,
      todayMeals
    };
  }, [records, todayStr]);

  const [yStr, mStr] = selectedMonth.split('-');
  const monthTitle = new Date(Number(yStr), Number(mStr) - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6">
      {/* 1. Owner Top Tabs: Daily Counter vs Tiffin Log */}
      {isOwner && (
        <div className="flex p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl mb-5 border border-slate-200 dark:border-slate-700/60 shadow-xs">
          <button
            onClick={() => onTabChange?.('tiffins')}
            className="flex-1 py-2 text-xs font-bold rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Daily Tiffin Counter
          </button>
          <button
            className="flex-1 py-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-700 text-brand-700 dark:text-brand-300 shadow-sm"
          >
            Tiffin Log (Bird's Eye)
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Tiffin Log</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              Bird's Eye View
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            OMR attendance sheet for monthly meals • Ongoing day is mutable, past days locked
          </p>
        </div>

        {/* Month Selector & Controls */}
        <div className="flex items-center space-x-2">
          {/* Month Switcher */}
          <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2 min-w-[100px] text-center">
              {monthTitle}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortDescending((prev) => !prev)}
            title={sortDescending ? 'Sorted: Today / Newest first' : 'Sorted: Day 1 / Oldest first'}
            className="flex items-center space-x-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{sortDescending ? 'Newest' : 'Oldest'}</span>
          </button>
        </div>
      </div>

      {/* 2. Bird's Eye Monthly Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Total Meals ({monthTitle})
          </span>
          <span className="text-xl font-black text-brand-700 dark:text-brand-400 block mt-0.5">
            {monthlyStats.totalMeals} <span className="text-xs font-medium text-slate-400">tiffins</span>
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Total Value
          </span>
          <span className="text-xl font-black text-slate-900 dark:text-white block mt-0.5">
            ₹{monthlyStats.totalAmount}
          </span>
          <span className="text-[10px] text-slate-400 block font-medium">₹{TIFFIN_PRICE} / meal</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Extra Tiffins
          </span>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 block mt-0.5">
            +{monthlyStats.totalExtras}
          </span>
          <span className="text-[10px] text-slate-400 block font-medium">Guests & extra boxes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Today's Tally
          </span>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
            {monthlyStats.todayMeals} <span className="text-xs font-medium text-slate-400">today</span>
          </span>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block font-bold">● Active slot</span>
        </div>
      </div>

      {/* 3. Roommate Tallies Pill Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Roommate Totals:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tenantUsers.map((t) => {
            const count = monthlyStats.tenantCounts[t.key];
            return (
              <div
                key={t.key}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5"
              >
                <span className="font-bold text-slate-800 dark:text-slate-200">{t.label}:</span>
                <span className="font-black text-brand-700 dark:text-brand-400">{count}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">(₹{count * TIFFIN_PRICE})</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* View Filter & Legend Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 px-1">
        {/* Meal Filter Pills */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setMealFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mealFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            All Meals (L + D)
          </button>
          <button
            onClick={() => setMealFilter('lunch')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mealFilter === 'lunch'
                ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sun className="w-3 h-3 text-amber-500" />
            <span>Lunch</span>
          </button>
          <button
            onClick={() => setMealFilter('dinner')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              mealFilter === 'dinner'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Moon className="w-3 h-3 text-indigo-500" />
            <span>Dinner</span>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded-xs border-2 border-slate-900 dark:border-brand-400 bg-slate-900 dark:bg-brand-600 flex items-center justify-center text-white">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
            <span>Marked</span>
          </div>

          <div className="flex items-center space-x-1">
            <div className="w-4 h-4 rounded-xs border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            <span>Unmarked</span>
          </div>

          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Today (Mutable)</span>
          </div>

          <div className="flex items-center space-x-1">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Past (Locked)</span>
          </div>
        </div>
      </div>

      {/* Floating Locked Alert Toast */}
      {lockedNotice && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-xl flex items-center justify-between text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{lockedNotice}</span>
          </div>
          <button
            onClick={() => setLockedNotice(null)}
            className="p-1 text-amber-600 hover:text-amber-800 dark:text-amber-300"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. OMR SHEET TABLE WITH STICKY HEADERS AND STICKY DATE COLUMN */}
      <div className="relative overflow-auto max-h-[68vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-center border-separate border-spacing-0">
          <thead>
            {/* Top Horizontal Sticky Header: 4 Tenants + Extras */}
            <tr>
              {/* Top-Left Corner: Sticky Both Horizontally & Vertically */}
              <th className="sticky top-0 left-0 z-40 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-3 text-left min-w-[120px] sm:min-w-[140px] shadow-xs">
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider block">
                  Date / Day
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Vertical Log</span>
              </th>

              {/* 4 Tenant Headers */}
              {tenantUsers.map((tenant) => (
                <th
                  key={tenant.key}
                  className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 py-2.5 min-w-[96px] sm:min-w-[110px] shadow-xs"
                >
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white block truncate">
                    {tenant.label}
                  </span>
                  {mealFilter === 'all' ? (
                    <div className="flex items-center justify-around text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                      <span className="text-amber-600 dark:text-amber-400">L</span>
                      <span className="text-indigo-600 dark:text-indigo-400">D</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                      {mealFilter === 'lunch' ? 'Lunch' : 'Dinner'}
                    </span>
                  )}
                </th>
              ))}

              {/* Extras Column Header */}
              <th className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 py-2.5 min-w-[96px] sm:min-w-[110px] shadow-xs">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  Extras
                </span>
                {mealFilter === 'all' ? (
                  <div className="flex items-center justify-around text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                    <span className="text-amber-600 dark:text-amber-400">L</span>
                    <span className="text-indigo-600 dark:text-indigo-400">D</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                    {mealFilter === 'lunch' ? 'L Extra' : 'D Extra'}
                  </span>
                )}
              </th>

              {/* Daily Total Header */}
              <th className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2 py-2.5 min-w-[80px] sm:min-w-[90px] text-right pr-3 shadow-xs">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                  Day Total
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Meals</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {daysList.map((dateStr) => {
              const isToday = dateStr === todayStr;
              const isLocked = isDateLocked(dateStr);

              const lunchRec = getRecord(dateStr, 'lunch');
              const dinnerRec = getRecord(dateStr, 'dinner');

              // Compute day total
              const dayLunchMeals =
                (lunchRec.tenant_1 || 0) +
                (lunchRec.tenant_2 || 0) +
                (lunchRec.tenant_3 || 0) +
                (lunchRec.tenant_4 || 0) +
                (lunchRec.extras || 0);

              const dayDinnerMeals =
                (dinnerRec.tenant_1 || 0) +
                (dinnerRec.tenant_2 || 0) +
                (dinnerRec.tenant_3 || 0) +
                (dinnerRec.tenant_4 || 0) +
                (dinnerRec.extras || 0);

              const dayTotalMeals =
                mealFilter === 'lunch'
                  ? dayLunchMeals
                  : mealFilter === 'dinner'
                  ? dayDinnerMeals
                  : dayLunchMeals + dayDinnerMeals;

              const dateObj = new Date(dateStr + 'T00:00:00');
              const formattedDate = dateObj.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                weekday: 'short'
              });

              return (
                <tr
                  key={dateStr}
                  className={`transition-colors ${
                    isToday
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30'
                      : isLocked
                      ? 'bg-slate-50/30 dark:bg-slate-900/40 hover:bg-slate-100/40 dark:hover:bg-slate-800/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {/* Left Column: Vertical Dates (STICKY HORIZONTALLY) */}
                  <td
                    className={`sticky left-0 z-20 border-b border-r border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left transition-colors ${
                      isToday
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 shadow-xs'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-1.5">
                      <span
                        className={`text-xs font-bold block ${
                          isToday
                            ? 'text-emerald-900 dark:text-emerald-100 font-black'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {formattedDate}
                      </span>

                      {/* Lock / Mutable Indicator */}
                      {isToday ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                          Today
                        </span>
                      ) : isLocked ? (
                        <button
                          onClick={() => {
                            setUnlockDate(dateStr);
                            setUnlockPasskey('');
                            setUnlockError(null);
                          }}
                          title="Record locked (day has passed). Click to enter dev unlock passkey."
                          className="inline-flex items-center text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors shrink-0 p-0.5"
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-bold shrink-0">
                          <Unlock className="w-3 h-3 inline" />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 4 Tenant Cells: OMR Square Boxes */}
                  {tenantUsers.map((tenant) => {
                    const isLunchMarked = lunchRec[tenant.key] === 1;
                    const isDinnerMarked = dinnerRec[tenant.key] === 1;

                    return (
                      <td
                        key={tenant.key}
                        className="border-b border-r border-slate-100 dark:divide-slate-800 dark:border-slate-800/80 px-2 py-2 text-center"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          {/* Lunch Box */}
                          {(mealFilter === 'all' || mealFilter === 'lunch') && (
                            <button
                              disabled={isLocked}
                              onClick={() => handleToggleMeal(dateStr, 'lunch', tenant.key)}
                              title={
                                isLocked
                                  ? `Lunch for ${tenant.label}: ${isLunchMarked ? 'Marked' : 'Unmarked'} (Locked)`
                                  : `Click to toggle Lunch for ${tenant.label}`
                              }
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-all ${
                                isLocked
                                  ? isLunchMarked
                                    ? 'border-2 border-slate-700 bg-slate-800 dark:bg-slate-700 text-white cursor-not-allowed opacity-90'
                                    : 'border-2 border-slate-200 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/30 cursor-not-allowed'
                                  : isLunchMarked
                                  ? 'border-2 border-slate-900 dark:border-brand-400 bg-slate-900 dark:bg-brand-600 text-white shadow-xs cursor-pointer active:scale-95 ring-offset-1 focus:ring-2 focus:ring-brand-500'
                                  : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50/30 cursor-pointer active:scale-95'
                              }`}
                            >
                              {isLunchMarked ? (
                                <div className="w-3.5 h-3.5 bg-white dark:bg-white rounded-xs flex items-center justify-center shadow-xs">
                                  <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3.5]" />
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                  L
                                </span>
                              )}
                            </button>
                          )}

                          {/* Dinner Box */}
                          {(mealFilter === 'all' || mealFilter === 'dinner') && (
                            <button
                              disabled={isLocked}
                              onClick={() => handleToggleMeal(dateStr, 'dinner', tenant.key)}
                              title={
                                isLocked
                                  ? `Dinner for ${tenant.label}: ${isDinnerMarked ? 'Marked' : 'Unmarked'} (Locked)`
                                  : `Click to toggle Dinner for ${tenant.label}`
                              }
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-all ${
                                isLocked
                                  ? isDinnerMarked
                                    ? 'border-2 border-slate-700 bg-slate-800 dark:bg-slate-700 text-white cursor-not-allowed opacity-90'
                                    : 'border-2 border-slate-200 dark:border-slate-700/60 bg-slate-100/50 dark:bg-slate-800/30 cursor-not-allowed'
                                  : isDinnerMarked
                                  ? 'border-2 border-slate-900 dark:border-brand-400 bg-slate-900 dark:bg-brand-600 text-white shadow-xs cursor-pointer active:scale-95 ring-offset-1 focus:ring-2 focus:ring-brand-500'
                                  : 'border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/30 cursor-pointer active:scale-95'
                              }`}
                            >
                              {isDinnerMarked ? (
                                <div className="w-3.5 h-3.5 bg-white dark:bg-white rounded-xs flex items-center justify-center shadow-xs">
                                  <Check className="w-2.5 h-2.5 text-slate-950 stroke-[3.5]" />
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                  D
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Extras Cell */}
                  <td className="border-b border-r border-slate-100 dark:border-slate-800/80 px-2 py-2 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {/* Lunch Extras */}
                      {(mealFilter === 'all' || mealFilter === 'lunch') && (
                        <div className="flex items-center space-x-1">
                          {!isLocked ? (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleUpdateExtras(dateStr, 'lunch', -1)}
                                disabled={(lunchRec.extras || 0) <= 0}
                                className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span
                                className={`px-1 text-xs font-black min-w-[16px] ${
                                  (lunchRec.extras || 0) > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {lunchRec.extras || 0}
                              </span>
                              <button
                                onClick={() => handleUpdateExtras(dateStr, 'lunch', 1)}
                                className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md border flex items-center justify-center text-xs font-black ${
                                (lunchRec.extras || 0) > 0
                                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400'
                              }`}
                              title={`Lunch Extras: ${lunchRec.extras || 0}`}
                            >
                              {(lunchRec.extras || 0) > 0 ? `+${lunchRec.extras}` : '0'}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dinner Extras */}
                      {(mealFilter === 'all' || mealFilter === 'dinner') && (
                        <div className="flex items-center space-x-1">
                          {!isLocked ? (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleUpdateExtras(dateStr, 'dinner', -1)}
                                disabled={(dinnerRec.extras || 0) <= 0}
                                className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span
                                className={`px-1 text-xs font-black min-w-[16px] ${
                                  (dinnerRec.extras || 0) > 0
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {dinnerRec.extras || 0}
                              </span>
                              <button
                                onClick={() => handleUpdateExtras(dateStr, 'dinner', 1)}
                                className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md border flex items-center justify-center text-xs font-black ${
                                (dinnerRec.extras || 0) > 0
                                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-400'
                              }`}
                              title={`Dinner Extras: ${dinnerRec.extras || 0}`}
                            >
                              {(dinnerRec.extras || 0) > 0 ? `+${dinnerRec.extras}` : '0'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Daily Total Column */}
                  <td className="border-b border-slate-100 dark:border-slate-800/80 px-3 py-2.5 text-right font-extrabold text-slate-900 dark:text-white">
                    {dayTotalMeals > 0 ? (
                      <div>
                        <span className="text-xs">{dayTotalMeals}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                          ₹{dayTotalMeals * TIFFIN_PRICE}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Table Summary Footer */}
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-800/90 font-black text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
              <td className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-700 px-3 py-3 text-left">
                <span>Month Total</span>
              </td>

              {tenantUsers.map((tenant) => (
                <td
                  key={tenant.key}
                  className="border-r border-slate-300 dark:border-slate-700 px-2 py-3 text-center"
                >
                  <span className="text-brand-700 dark:text-brand-400 text-sm block">
                    {monthlyStats.tenantCounts[tenant.key]}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 block">
                    ₹{monthlyStats.tenantCounts[tenant.key] * TIFFIN_PRICE}
                  </span>
                </td>
              ))}

              <td className="border-r border-slate-300 dark:border-slate-700 px-2 py-3 text-center">
                <span className="text-amber-600 dark:text-amber-400 text-sm block">
                  +{monthlyStats.totalExtras}
                </span>
                <span className="text-[10px] font-medium text-slate-400 block">
                  ₹{monthlyStats.totalExtras * TIFFIN_PRICE}
                </span>
              </td>

              <td className="px-3 py-3 text-right">
                <span className="text-sm font-black text-slate-900 dark:text-white block">
                  {monthlyStats.totalMeals}
                </span>
                <span className="text-[10px] font-bold text-brand-700 dark:text-brand-400 block">
                  ₹{monthlyStats.totalAmount}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 5. Developer Unlock Modal (For Past Days) */}
      {unlockDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Developer Unlock</h3>
              </div>
              <button
                onClick={() => setUnlockDate(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              The date <span className="font-bold text-slate-800 dark:text-slate-200">{unlockDate}</span> is locked because
              it has passed. Enter the developer passkey to unlock it for modifications.
            </p>

            {unlockError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold text-red-700 dark:text-red-300">
                {unlockError}
              </div>
            )}

            <input
              type="password"
              placeholder="Developer Passkey"
              value={unlockPasskey}
              onChange={(e) => setUnlockPasskey(e.target.value)}
              className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={() => setUnlockDate(null)}
                className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={unlockLoading || !unlockPasskey}
                onClick={handleDevUnlock}
                className="px-4 py-2 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {unlockLoading ? 'Verifying...' : 'Unlock Day'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
