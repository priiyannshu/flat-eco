import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReceiptRecord, UserProfile } from '../types';
import { api, DEFAULT_SETTINGS } from '../lib/api';
import { downloadReceiptPDF } from '../lib/pdf';
import {
  FileText,
  Download,
  Send,
  CheckCircle2,
  Calendar,
  User,
  ExternalLink,
  Plus,
  Clock,
  Sparkles
} from 'lucide-react';

export const ReceiptsPage: React.FC = () => {
  const { currentUser, allUsers } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // New Receipt Modal (Owner)
  const [showModal, setShowModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>('tenant_1');
  const [month, setMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [rentAmount, setRentAmount] = useState<string>('2000');
  const [tiffinCount, setTiffinCount] = useState<string>('30');
  const [electricityAmount, setElectricityAmount] = useState<string>('400');
  const [notes, setNotes] = useState<string>('');

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.getReceipts(currentUser?.id);
      setReceipts(data);
    } catch (err) {
      console.error('Failed to load receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [currentUser]);

  const isOwner = currentUser?.role === 'owner';
  const tenants = useMemo(() => allUsers.filter((u) => u.role === 'tenant'), [allUsers]);

  const handleDownload = (receipt: ReceiptRecord) => {
    const tenant = allUsers.find((u) => u.id === receipt.user_id) || {
      id: receipt.user_id,
      name: receipt.user_id,
      role: 'tenant' as const,
      pin: '1234',
      created_at: 0
    };
    downloadReceiptPDF(receipt, tenant);
  };

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const tCount = parseInt(tiffinCount) || 0;
    const tAmt = tCount * 60;
    const rAmt = parseFloat(rentAmount) || 2000;
    const eAmt = parseFloat(electricityAmount) || 0;
    const total = rAmt + tAmt + eAmt;

    const receipt: ReceiptRecord = {
      id: `REC-${month}-${targetUserId.toUpperCase()}`,
      user_id: targetUserId,
      month,
      rent_amount: rAmt,
      tiffin_count: tCount,
      tiffin_amount: tAmt,
      electricity_amount: eAmt,
      extras_amount: 0,
      total_amount: total,
      status: 'issued',
      issued_at: Date.now(),
      issued_by: currentUser.name || 'Owner',
      notes: notes || undefined
    };

    await api.issueReceipt(receipt, currentUser.id);
    setShowModal(false);
    await fetchReceipts();
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-5 text-white shadow-lg shadow-teal-600/15 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>In-App Receipts & PDF</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Official Expense Receipts</h1>
            <p className="text-teal-100 text-xs sm:text-sm mt-0.5">
              Verified receipts generated and transmitted directly inside FlatEco
            </p>
          </div>

          {isOwner && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white text-teal-800 font-bold rounded-xl text-xs sm:text-sm shadow-md hover:bg-teal-50 transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Receipt</span>
            </button>
          )}
        </div>
      </div>

      {/* Receipts List */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">
            {isOwner ? 'All Transmitted Flat Receipts' : 'Your Issued Receipts'}
          </h2>
          <span className="text-xs text-slate-400">{receipts.length} total receipts</span>
        </div>

        {receipts.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No receipts issued yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {isOwner
                ? 'Issue a receipt using the button above or from the Ledger page.'
                : 'The owner has not issued a formal receipt for your account yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((r) => {
              const tenant = allUsers.find((u) => u.id === r.user_id);
              const dateStr = new Date(r.issued_at).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 border border-teal-200">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-slate-900">{r.id}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {r.status === 'settled' ? 'PAID & VERIFIED' : 'ISSUED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        For <span className="font-semibold text-slate-800">{tenant?.name || r.user_id}</span> • Month of{' '}
                        <span className="font-semibold text-slate-800">{r.month}</span>
                      </p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1">
                        <span>Issued on {dateStr}</span>
                        <span>•</span>
                        <span>Rent: ₹{r.rent_amount}</span>
                        <span>•</span>
                        <span>Tiffins: {r.tiffin_count} (₹{r.tiffin_amount})</span>
                        <span>•</span>
                        <span>Power: ₹{r.electricity_amount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Total</span>
                      <span className="text-base font-black text-brand-700">₹{r.total_amount}</span>
                    </div>

                    <button
                      onClick={() => handleDownload(r)}
                      className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Issue Modal (Owner) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Issue Monthly Receipt</h3>
            <p className="text-xs text-slate-500 mt-1">
              Generate an official PDF receipt and send it to the roommate's profile.
            </p>

            <form onSubmit={handleCreateReceipt} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Select Roommate</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.room_or_info})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Month</label>
                  <input
                    type="month"
                    required
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Rent Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={rentAmount}
                    onChange={(e) => setRentAmount(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tiffins Count</label>
                  <input
                    type="number"
                    required
                    value={tiffinCount}
                    onChange={(e) => setTiffinCount(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Power Share (₹)</label>
                  <input
                    type="number"
                    required
                    value={electricityAmount}
                    onChange={(e) => setElectricityAmount(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {/* Total calculation preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
                <span className="text-slate-600">Calculated Total:</span>
                <span className="text-sm font-extrabold text-brand-700">
                  ₹{(parseFloat(rentAmount) || 0) + (parseInt(tiffinCount) || 0) * 60 + (parseFloat(electricityAmount) || 0)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Receipt Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Cleared via UPI on 5th"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-colors"
                >
                  Issue & Send In-App
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
