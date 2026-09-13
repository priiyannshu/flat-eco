import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, DEFAULT_SETTINGS } from '../lib/api';
import { RentRecord, TiffinRecord, ElectricityBill } from '../types';
import {
  QrCode,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Home,
  UtensilsCrossed,
  Zap,
  Check,
  Edit2
} from 'lucide-react';

const TIFFIN_PRICE = 60;
const MONTHLY_RENT = 2000;

export const PaymentsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([]);
  const [tiffins, setTiffins] = useState<TiffinRecord[]>([]);
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [loading, setLoading] = useState(false);

  // Owner UPI ID configuration
  const [ownerUpi, setOwnerUpi] = useState<string>(() => {
    return localStorage.getItem('flat_eco_owner_upi') || DEFAULT_SETTINGS.owner_upi;
  });
  const [editingUpi, setEditingUpi] = useState(false);
  const [upiInput, setUpiInput] = useState(ownerUpi);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rData, tData, bData] = await Promise.all([
        api.getRent(currentUser?.id, currentMonthStr),
        api.getTiffins(currentMonthStr),
        api.getBills()
      ]);
      setRentRecords(rData);
      setTiffins(tData);
      setBills(bData);
    } catch (err) {
      console.error('Failed to load payments data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const isOwner = currentUser?.role === 'owner';
  const tenants = useMemo(() => allUsers.filter((u) => u.role === 'tenant'), [allUsers]);

  // Latest active electricity bill
  const latestBill = bills[0];

  // Current tenant dues calculation
  const tenantDues = useMemo(() => {
    if (!currentUser || isOwner) return null;

    const tKey = currentUser.id as 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4';

    // Rent
    const myRent = rentRecords.find((r) => r.user_id === currentUser.id && r.month === currentMonthStr);
    const isRentPaid = myRent?.is_paid === 1;
    const rentAmountDue = isRentPaid ? 0 : MONTHLY_RENT;

    // Tiffins
    let tiffinCount = 0;
    for (const r of tiffins) {
      tiffinCount += (r[tKey] || 0);
    }
    const tiffinAmountDue = tiffinCount * TIFFIN_PRICE;

    // Total due
    const totalDue = rentAmountDue + tiffinAmountDue;

    return {
      isRentPaid,
      rentAmountDue,
      tiffinCount,
      tiffinAmountDue,
      totalDue
    };
  }, [currentUser, isOwner, rentRecords, tiffins, currentMonthStr]);

  // Owner summary: calculate dues for each of the 4 tenants
  const ownerSummary = useMemo(() => {
    if (!isOwner) return [];

    return tenants.map((t) => {
      const tKey = t.id as 'tenant_1' | 'tenant_2' | 'tenant_3' | 'tenant_4';
      const rentRec = rentRecords.find((r) => r.user_id === t.id && r.month === currentMonthStr);
      const isRentPaid = rentRec?.is_paid === 1;
      const rentDue = isRentPaid ? 0 : MONTHLY_RENT;

      let mealCount = 0;
      for (const r of tiffins) {
        mealCount += (r[tKey] || 0);
      }
      const tiffinCost = mealCount * TIFFIN_PRICE;
      const totalDue = rentDue + tiffinCost;

      return {
        tenant: t,
        isRentPaid,
        rentDue,
        mealCount,
        tiffinCost,
        totalDue
      };
    });
  }, [isOwner, tenants, rentRecords, tiffins, currentMonthStr]);

  const totalFlatReceivables = useMemo(() => {
    return ownerSummary.reduce((acc, curr) => acc + curr.totalDue, 0);
  }, [ownerSummary]);

  // UPI deep link & QR Code URL
  const paymentAmount = tenantDues ? tenantDues.totalDue : 0;
  const upiPayUrl = `upi://pay?pa=${ownerUpi}&pn=FlatOwner&am=${paymentAmount > 0 ? paymentAmount : ''}&cu=INR`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiPayUrl)}`;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(ownerUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleSaveUpi = (e: React.FormEvent) => {
    e.preventDefault();
    if (upiInput.trim()) {
      setOwnerUpi(upiInput.trim());
      localStorage.setItem('flat_eco_owner_upi', upiInput.trim());
      setEditingUpi(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-slate-900">Payments</h1>
        <p className="text-xs text-slate-500 mt-0.5">{monthName} dues and owner UPI QR</p>
      </div>

      {/* TENANT VIEW: WHAT YOU NEED TO PAY FOR */}
      {!isOwner && tenantDues && (
        <div className="space-y-5">
          {/* Total Due Highlight Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Amount Due
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-3xl font-black text-brand-700">₹{tenantDues.totalDue}</span>
              {tenantDues.totalDue === 0 ? (
                <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  All Dues Clear
                </span>
              ) : (
                <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                  Payment Pending
                </span>
              )}
            </div>
          </div>

          {/* Dues Breakdown List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">What You Need To Pay For</h2>
            <div className="space-y-3 divide-y divide-slate-100">
              {/* Rent */}
              <div className="pt-2.5 first:pt-0 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">Monthly Rent</span>
                    <span className="text-xs text-slate-400">
                      {tenantDues.isRentPaid ? 'Verified Paid by Owner' : 'Pending for this month'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black ${tenantDues.isRentPaid ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    ₹{MONTHLY_RENT}
                  </span>
                  <span className={`block text-[10px] font-bold ${tenantDues.isRentPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {tenantDues.isRentPaid ? 'Paid' : 'Due: ₹2,000'}
                  </span>
                </div>
              </div>

              {/* Tiffins */}
              <div className="pt-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-slate-800 block">Tiffins Consumed</span>
                    <span className="text-xs text-slate-400">
                      {tenantDues.tiffinCount} meals @ ₹{TIFFIN_PRICE}/meal
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900">
                    ₹{tenantDues.tiffinAmountDue}
                  </span>
                  <span className="block text-[10px] font-bold text-brand-600">
                    {tenantDues.tiffinCount} tiffins
                  </span>
                </div>
              </div>

              {/* Electricity Bill info (if uploaded) */}
              {latestBill && (
                <div className="pt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-amber-500">
                      <Zap className="w-4 h-4 fill-amber-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-800 block">Electricity Bill</span>
                      <span className="text-xs text-slate-400">
                        {latestBill.billing_month} • {latestBill.due_date ? `Due: ${latestBill.due_date}` : 'Uploaded'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900">
                      ₹{latestBill.total_amount}
                    </span>
                    <span className="block text-[10px] text-slate-400">Flat total</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Code & Payment Action Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Pay Owner via UPI</h2>
            <p className="text-xs text-slate-400 mb-4">
              Scan this QR with any UPI app (GPay, PhonePe, Paytm) or tap to pay
            </p>

            {/* QR Code Display */}
            <div className="inline-block bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <img
                src={qrCodeUrl}
                alt="Owner UPI QR Code"
                className="w-48 h-48 mx-auto rounded-lg"
                loading="lazy"
              />
            </div>

            {/* UPI ID Pill */}
            <div className="max-w-xs mx-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between mb-4">
              <div className="text-left pl-1 truncate">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Owner UPI ID</span>
                <span className="text-xs font-bold text-slate-800 truncate block">{ownerUpi}</span>
              </div>
              <button
                onClick={handleCopyUpi}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                title="Copy UPI ID"
              >
                {copiedUpi ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Direct UPI App Button */}
            <a
              href={upiPayUrl}
              className="inline-flex items-center justify-center space-x-2 w-full max-w-xs py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm shadow-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Pay ₹{tenantDues.totalDue} via UPI App</span>
            </a>
          </div>
        </div>
      )}

      {/* OWNER VIEW: RECEIVABLES & UPI SETTINGS */}
      {isOwner && (
        <div className="space-y-5">
          {/* Flat Total Receivables */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Pending Receivables ({monthName})
            </span>
            <span className="text-3xl font-black text-brand-700 block mt-1">₹{totalFlatReceivables}</span>
            <span className="text-xs text-slate-400 mt-1 block">Across all 4 flatmates</span>
          </div>

          {/* Tenants Dues Table */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Roommate Balances</h2>
            <div className="space-y-2.5">
              {ownerSummary.map((item) => (
                <div
                  key={item.tenant.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{item.tenant.name}</span>
                    <span className="text-xs text-slate-500">
                      Rent: {item.isRentPaid ? 'Paid' : 'Pending (₹2000)'} • Tiffins: {item.mealCount} (₹{item.tiffinCost})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-slate-900 block">₹{item.totalDue}</span>
                    <span className={`text-[10px] font-bold ${item.totalDue === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {item.totalDue === 0 ? 'Clear' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Owner UPI Settings & QR Preview */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
            <h2 className="text-sm font-bold text-slate-800 mb-1">Your Receiving UPI ID & QR</h2>
            <p className="text-xs text-slate-400 mb-4">Tenants will scan this QR to pay you directly</p>

            <div className="inline-block bg-white p-3 rounded-2xl border border-slate-200 shadow-sm mb-4">
              <img
                src={qrCodeUrl}
                alt="Owner UPI QR Code"
                className="w-44 h-44 mx-auto rounded-lg"
                loading="lazy"
              />
            </div>

            {editingUpi ? (
              <form onSubmit={handleSaveUpi} className="max-w-xs mx-auto flex gap-2">
                <input
                  type="text"
                  value={upiInput}
                  onChange={(e) => setUpiInput(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank"
                  className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold"
                >
                  Save
                </button>
              </form>
            ) : (
              <div className="max-w-xs mx-auto bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                <div className="text-left pl-1 truncate">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active UPI ID</span>
                  <span className="text-xs font-bold text-slate-800 truncate block">{ownerUpi}</span>
                </div>
                <button
                  onClick={() => setEditingUpi(true)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
                  title="Change UPI ID"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
