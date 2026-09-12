import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { TiffinRecord, RentRecord, ElectricityBill, UserProfile } from '../types';
import { api, DEFAULT_SETTINGS } from '../lib/api';
import {
  BookOpen,
  Calendar,
  DollarSign,
  UtensilsCrossed,
  Home,
  Zap,
  User,
  ShieldCheck,
  Download,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { downloadReceiptPDF } from '../lib/pdf';

const TIFFIN_PRICE = 60;
const MONTHLY_RENT = 2000;

export const LedgerPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [tiffins, setTiffins] = useState<TiffinRecord[]>([]);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [issuedToast, setIssuedToast] = useState<string | null>(null);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const [tData, rData, bData] = await Promise.all([
        api.getTiffins(selectedMonth),
        api.getRent(currentUser?.id, selectedMonth),
        api.getBills()
      ]);
      setTiffins(tData);
      setRentRecords(rData);
      setBills(bData);
    } catch (err) {
      console.error('Error fetching ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [selectedMonth, currentUser]);

  const isOwner = currentUser?.role === 'owner';
  const tenants = useMemo(() => allUsers.filter((u) => u.role === 'tenant'), [allUsers]);

  // Current month's electricity share
  const activeBill = useMemo(() => {
    return bills.find((b) => b.billing_month === selectedMonth) || bills[0];
  }, [bills, selectedMonth]);

  const electricityShare = activeBill ? activeBill.per_person_share : 0;

  // Calculate per-tenant summaries
  const tenantSummaries = useMemo(() => {
    return tenants.map((t) => {
      const tKey = t.id as 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4';
      let mealCount = 0;
      for (const r of tiffins) {
        mealCount += (r[tKey] || 0);
      }
      const tiffinCost = mealCount * TIFFIN_PRICE;

      const rentRec = rentRecords.find((r) => r.user_id === t.id && r.month === selectedMonth);
      const isRentPaid = rentRec?.is_paid === 1;
      const rentDue = isRentPaid ? 0 : MONTHLY_RENT;

      const totalDue = (isRentPaid ? 0 : MONTHLY_RENT) + tiffinCost + electricityShare;
      const grandTotalMonth = MONTHLY_RENT + tiffinCost + electricityShare;

      return {
        tenant: t,
        mealCount,
        tiffinCost,
        isRentPaid,
        rentDue,
        electricityShare,
        totalDue,
        grandTotalMonth
      };
    });
  }, [tenants, tiffins, rentRecords, selectedMonth, electricityShare]);

  // Extras summary
  const extrasSummary = useMemo(() => {
    let count = 0;
    for (const r of tiffins) {
      count += (r.extras || 0);
    }
    return { count, cost: count * TIFFIN_PRICE };
  }, [tiffins]);

  // If current user is tenant, get only their summary
  const mySummary = useMemo(() => {
    return tenantSummaries.find((s) => s.tenant.id === currentUser?.id);
  }, [tenantSummaries, currentUser]);

  // Issue In-App Receipt (Owner only)
  const handleIssueReceipt = async (summary: typeof tenantSummaries[0]) => {
    if (!currentUser || currentUser.role !== 'owner') return;

    const receipt = {
      id: `REC-${selectedMonth}-${summary.tenant.id.toUpperCase()}`,
      user_id: summary.tenant.id,
      month: selectedMonth,
      rent_amount: MONTHLY_RENT,
      tiffin_count: summary.mealCount,
      tiffin_amount: summary.tiffinCost,
      electricity_amount: summary.electricityShare,
      extras_amount: 0,
      total_amount: summary.grandTotalMonth,
      status: summary.isRentPaid ? ('settled' as const) : ('issued' as const),
      issued_at: Date.now(),
      issued_by: 'owner',
      notes: `Issued for ${selectedMonth} by ${currentUser.name}`
    };

    await api.issueReceipt(receipt, currentUser.id);
    setIssuedToast(`Receipt successfully issued and sent to ${summary.tenant.name}!`);
    setTimeout(() => setIssuedToast(null), 3500);
  };

  // Download PDF Receipt directly
  const handleDownloadMyReceipt = (summary: typeof tenantSummaries[0]) => {
    const receipt = {
      id: `REC-${selectedMonth}-${summary.tenant.id.toUpperCase()}`,
      user_id: summary.tenant.id,
      month: selectedMonth,
      rent_amount: MONTHLY_RENT,
      tiffin_count: summary.mealCount,
      tiffin_amount: summary.tiffinCost,
      electricity_amount: summary.electricityShare,
      extras_amount: 0,
      total_amount: summary.grandTotalMonth,
      status: summary.isRentPaid ? ('settled' as const) : ('issued' as const),
      issued_at: Date.now(),
      issued_by: 'owner'
    };
    downloadReceiptPDF(receipt, summary.tenant);
  };

  const changeMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(d.toISOString().substring(0, 7));
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Toast */}
      {issuedToast && (
        <div className="fixed top-18 right-4 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl shadow-lg border text-sm bg-emerald-50 text-emerald-800 border-emerald-200 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{issuedToast}</span>
        </div>
      )}

      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-green-700 rounded-2xl p-5 text-white shadow-lg shadow-emerald-600/15 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Full Cost Transparency</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Monthly Expense Ledger</h1>
            <p className="text-emerald-100 text-xs sm:text-sm mt-0.5">
              {isOwner ? "Owner Master Overview: All Roommates' Balances" : "Your Private Itemized Ledger Breakdown"}
            </p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center space-x-2 bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 self-start sm:self-auto">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1 rounded-lg hover:bg-white/20 text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold">
              {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1 rounded-lg hover:bg-white/20 text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TENANT PRIVATE LEDGER VIEW */}
      {!isOwner && mySummary && (
        <div className="space-y-6">
          {/* Main Balance Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statement For</span>
                <h2 className="text-xl font-extrabold text-slate-900">{mySummary.tenant.name}</h2>
                <p className="text-xs text-slate-500">
                  {new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} • {mySummary.tenant.room_or_info}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-400 font-medium block">Total Payable This Month</span>
                <span className="text-3xl font-black text-brand-700">₹{mySummary.grandTotalMonth}</span>
                <span className={`text-xs font-bold block mt-0.5 ${mySummary.isRentPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {mySummary.isRentPaid ? 'Rent Settled • ₹' + (mySummary.tiffinCost + mySummary.electricityShare) + ' food & utilities due' : 'Rent Pending'}
                </span>
              </div>
            </div>

            {/* Itemized Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              {/* Rent Item */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2 text-indigo-700 mb-2">
                  <Home className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Room Rent</span>
                </div>
                <span className="text-xl font-black text-slate-900 block">₹{MONTHLY_RENT}</span>
                <div className="flex items-center space-x-1.5 mt-2">
                  {mySummary.isRentPaid ? (
                    <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      <Clock className="w-3 h-3 mr-1" /> Due ₹{MONTHLY_RENT}
                    </span>
                  )}
                </div>
              </div>

              {/* Tiffin Meals Item */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2 text-brand-700 mb-2">
                  <UtensilsCrossed className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Tiffins Consumed</span>
                </div>
                <span className="text-xl font-black text-slate-900 block">₹{mySummary.tiffinCost}</span>
                <span className="text-xs text-slate-500 mt-2 block font-medium">
                  {mySummary.mealCount} meals @ ₹{TIFFIN_PRICE}/meal
                </span>
              </div>

              {/* Electricity Share Item */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-2 text-amber-600 mb-2">
                  <Zap className="w-4 h-4 fill-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider">Electricity Share</span>
                </div>
                <span className="text-xl font-black text-slate-900 block">₹{mySummary.electricityShare}</span>
                <span className="text-xs text-slate-500 mt-2 block font-medium">
                  1/4th flat share
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Data synced from Cloudflare D1 Edge Ledger
              </span>
              <button
                onClick={() => handleDownloadMyReceipt(mySummary)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OWNER MASTER LEDGER VIEW */}
      {isOwner && (
        <div className="space-y-6">
          {/* Grand Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-xs text-slate-400 font-medium block">Total Tiffins</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {tenantSummaries.reduce((a, b) => a + b.mealCount, 0) + extrasSummary.count}
              </span>
              <span className="text-xs text-brand-600 font-bold">
                ₹{(tenantSummaries.reduce((a, b) => a + b.mealCount, 0) + extrasSummary.count) * TIFFIN_PRICE}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-xs text-slate-400 font-medium block">Rent Collected</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">
                ₹{tenantSummaries.filter((s) => s.isRentPaid).length * MONTHLY_RENT}
              </span>
              <span className="text-xs text-slate-400">
                {tenantSummaries.filter((s) => s.isRentPaid).length} of 4 roommates paid
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-xs text-slate-400 font-medium block">Rent Pending</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                ₹{tenantSummaries.filter((s) => !s.isRentPaid).length * MONTHLY_RENT}
              </span>
              <span className="text-xs text-slate-400">
                {tenantSummaries.filter((s) => !s.isRentPaid).length} roommate dues
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <span className="text-xs text-slate-400 font-medium block">Extras Column</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {extrasSummary.count} tiffins
              </span>
              <span className="text-xs text-amber-600 font-bold">₹{extrasSummary.cost}</span>
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Roommates Ledger Breakdown</h2>
            <p className="text-xs text-slate-400 mb-4">
              Individual balances, rent status and instant receipt generation
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="pb-3 pl-2">Roommate</th>
                    <th className="pb-3">Tiffins</th>
                    <th className="pb-3">Tiffin Cost</th>
                    <th className="pb-3">Rent (₹2000)</th>
                    <th className="pb-3">Power Share</th>
                    <th className="pb-3">Total Payable</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantSummaries.map((s) => (
                    <tr key={s.tenant.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pl-2 font-bold text-slate-900">
                        {s.tenant.name}
                        <span className="block text-[10px] text-slate-400 font-normal">{s.tenant.room_or_info}</span>
                      </td>
                      <td className="py-3.5 font-semibold text-slate-700">{s.mealCount} meals</td>
                      <td className="py-3.5 font-bold text-brand-700">₹{s.tiffinCost}</td>
                      <td className="py-3.5">
                        {s.isRentPaid ? (
                          <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 font-medium text-slate-700">₹{s.electricityShare}</td>
                      <td className="py-3.5 font-black text-slate-900 text-sm">₹{s.grandTotalMonth}</td>
                      <td className="py-3.5 text-right pr-2 space-x-1.5">
                        <button
                          onClick={() => handleIssueReceipt(s)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold rounded-lg transition-colors"
                          title="Issue and send receipt in-app"
                        >
                          <Send className="w-3 h-3" />
                          <span>Send Receipt</span>
                        </button>
                        <button
                          onClick={() => handleDownloadMyReceipt(s)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors inline-flex"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
