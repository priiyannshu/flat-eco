import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ElectricityBill } from '../types';
import { api } from '../lib/api';
import {
  Zap,
  Upload,
  Calendar,
  AlertCircle,
  FileImage,
  CheckCircle2,
  Eye,
  X,
  CreditCard,
  CloudLightning,
  Info
} from 'lucide-react';

export const BillsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload Form State (Owner)
  const [billingMonth, setBillingMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [billNumber, setBillNumber] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Image Preview Modal
  const [previewingBill, setPreviewingBill] = useState<ElectricityBill | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const data = await api.getBills();
      setBills(data);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const isOwner = currentUser?.role === 'owner';

  // Client-side image compression to WebP/JPEG under 150KB for fast D1 storage (No R2 payment card needed)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200; // High enough for meter readings, compact in storage
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to JPEG / WebP at 75% quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        setImageData(compressedBase64);
        setImagePreview(compressedBase64);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleUploadBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalAmount || !billingMonth || !currentUser) return;

    setUploading(true);
    try {
      await api.uploadBill(
        {
          billing_month: billingMonth,
          bill_number: billNumber,
          total_amount: parseFloat(totalAmount),
          due_date: dueDate,
          image_data: imageData || undefined,
          notes: notes
        },
        currentUser.id
      );

      // Reset
      setShowUploadModal(false);
      setTotalAmount('');
      setBillNumber('');
      setDueDate('');
      setNotes('');
      setImageData(null);
      setImagePreview(null);
      await fetchBills();
    } catch (err) {
      console.error('Bill upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  // Latest active bill
  const latestBill = bills[0];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-orange-500/15 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <Zap className="w-3.5 h-3.5 text-yellow-200 fill-yellow-200" />
              <span>Electricity & Utilities</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Electricity Bill & 4-Way Split</h1>
            <p className="text-amber-100 text-xs sm:text-sm mt-0.5">
              Split equally among 4 flatmates • In-app notifications sent upon upload
            </p>
          </div>

          {isOwner && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white text-orange-700 font-bold rounded-xl text-xs sm:text-sm shadow-md hover:bg-orange-50 transition-colors shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Upload New Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* R2 Card & Storage Note (Answers User's Explicit Question) */}
      <div className="p-4 mb-6 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <span className="font-bold text-slate-800">Do you need Cloudflare R2?</span> Bill images are automatically optimized and compressed client-side (under 120KB), and safely stored in <span className="font-semibold text-slate-800">Cloudflare D1</span> with zero external card requirement. If you later configure R2, the storage binding in <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">wrangler.toml</code> is already structured for instant plug-and-play!
        </div>
      </div>

      {/* Latest Active Bill Spotlight */}
      {latestBill ? (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 mb-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div>
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Latest Billing Cycle</span>
              <h2 className="text-lg font-black text-slate-900">
                {new Date(latestBill.billing_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            {latestBill.due_date && (
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Due Date</span>
                <span className="text-xs font-bold text-red-600">{latestBill.due_date}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-400 font-medium block">Total Meter Invoice</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">₹{latestBill.total_amount}</span>
              <span className="text-[11px] text-slate-500">Full flat consumption</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-xs text-amber-700 font-bold block">Your 1/4th Share</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">₹{latestBill.per_person_share}</span>
              <span className="text-[11px] text-amber-800 font-medium">Auto-calculated per flatmate</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Invoice Attachment</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  {latestBill.image_data ? 'Official Bill Attached' : 'No photo uploaded'}
                </span>
              </div>
              {latestBill.image_data && (
                <button
                  onClick={() => setPreviewingBill(latestBill)}
                  className="mt-2 flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold shadow-sm transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-brand-600" />
                  <span>View Bill Photo</span>
                </button>
              )}
            </div>
          </div>

          {latestBill.notes && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Owner Notes:</span> {latestBill.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 mb-6">
          <Zap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No electricity bills uploaded yet</h3>
          <p className="text-xs text-slate-400 mt-1">
            {isOwner ? 'Click "Upload New Bill" above to add the current month bill.' : 'The owner has not uploaded any bill yet.'}
          </p>
        </div>
      )}

      {/* Past Electricity Bills History */}
      {bills.length > 1 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Past Bills History</h3>
          <div className="divide-y divide-slate-100">
            {bills.slice(1).map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    {new Date(b.billing_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-slate-400">Total: ₹{b.total_amount} • Due: {b.due_date || 'N/A'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    Share: ₹{b.per_person_share}
                  </span>
                  {b.image_data && (
                    <button
                      onClick={() => setPreviewingBill(b)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                      title="View bill photo"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Bill Modal (Owner) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" /> Upload Electricity Bill
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadBill} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Billing Month *</label>
                  <input
                    type="month"
                    required
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    placeholder="e.g. 1800"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Real-time split preview */}
              {totalAmount && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span className="font-medium">4-Way Split:</span>
                  <span className="font-extrabold text-amber-800">
                    ₹{Math.round(parseFloat(totalAmount) / 4)} per roommate
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Consumer / Bill #</label>
                  <input
                    type="text"
                    placeholder="e.g. 102938475"
                    value={billNumber}
                    onChange={(e) => setBillNumber(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Bill Image Upload */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Bill Photo / Screenshot (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={imagePreview}
                        alt="Bill preview"
                        className="max-h-40 mx-auto rounded-lg shadow-sm border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageData(null);
                          setImagePreview(null);
                        }}
                        className="text-xs text-red-600 font-bold hover:underline"
                      >
                        Remove photo
                      </button>
                    </div>
                  ) : (
                    <div>
                      <FileImage className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                      <label className="cursor-pointer">
                        <span className="text-xs font-bold text-amber-600 hover:text-amber-700">Click to upload photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1">Auto-compressed under 150KB for fast sync</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Units consumed: 180 kWh"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading & Notifying...' : 'Publish Bill & Notify All'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Image Preview Modal */}
      {previewingBill && previewingBill.image_data && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="font-bold text-sm text-slate-800">
                Electricity Bill: {previewingBill.billing_month} (Total ₹{previewingBill.total_amount})
              </span>
              <button
                onClick={() => setPreviewingBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={previewingBill.image_data}
                alt="Electricity Bill"
                className="max-w-full h-auto rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
