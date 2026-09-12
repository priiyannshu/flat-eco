import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ElectricityBill } from '../types';
import { api } from '../lib/api';
import {
  Zap,
  Upload,
  Eye,
  X,
  FileImage,
  Calendar
} from 'lucide-react';

export const BillsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [bills, setBills] = useState<ElectricityBill[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload Form State (Owner)
  const [billingMonth, setBillingMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [totalAmount, setTotalAmount] = useState<string>('');
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

  // Client-side image compression
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
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
          total_amount: parseFloat(totalAmount),
          due_date: dueDate,
          image_data: imageData || undefined,
          notes: notes
        },
        currentUser.id
      );

      setShowUploadModal(false);
      setTotalAmount('');
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

  const latestBill = bills[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Electricity Bill</h1>
          <p className="text-xs text-slate-500 mt-0.5">Uploaded bills and past months log</p>
        </div>

        {isOwner && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs shadow-sm transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Bill</span>
          </button>
        )}
      </div>

      {/* Latest Bill Spotlight */}
      {latestBill ? (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm mb-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Latest Bill
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5">
                {new Date(latestBill.billing_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            {latestBill.due_date && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-medium">Due Date</span>
                <span className="text-xs font-bold text-red-600">{latestBill.due_date}</span>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs text-slate-400 block">Total Amount</span>
              <span className="text-3xl font-black text-slate-900 mt-0.5 block">
                ₹{latestBill.total_amount}
              </span>
            </div>

            {latestBill.image_data && (
              <button
                onClick={() => setPreviewingBill(latestBill)}
                className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>View Bill Photo</span>
              </button>
            )}
          </div>

          {latestBill.notes && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Note:</span> {latestBill.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 mb-6">
          <Zap className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No electricity bills uploaded yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {isOwner ? 'Click "Upload Bill" to publish the bill for flatmates.' : 'The owner has not uploaded any bill yet.'}
          </p>
        </div>
      )}

      {/* Past Bills Log */}
      {bills.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Past Months Log</h2>
          <div className="divide-y divide-slate-100">
            {bills.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    {new Date(b.billing_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-slate-400">
                    {b.due_date ? `Due: ${b.due_date}` : 'Uploaded'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-extrabold text-slate-900">
                    ₹{b.total_amount}
                  </span>
                  {b.image_data && (
                    <button
                      onClick={() => setPreviewingBill(b)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      title="View Bill Photo"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Upload Electricity Bill</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadBill} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Month *</label>
                  <input
                    type="month"
                    required
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Total Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1600"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Due Date (Optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Bill Photo */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Bill Photo (Optional)</label>
                <div className="border border-dashed border-slate-200 rounded-xl p-3 text-center">
                  {imagePreview ? (
                    <div>
                      <img
                        src={imagePreview}
                        alt="Bill preview"
                        className="max-h-36 mx-auto rounded-lg mb-2"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageData(null);
                          setImagePreview(null);
                        }}
                        className="text-xs text-red-600 font-semibold"
                      >
                        Remove photo
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block py-2">
                      <FileImage className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs font-semibold text-brand-600">Choose photo or take picture</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Units: 140 kWh"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm disabled:opacity-50"
                >
                  {uploading ? 'Saving...' : 'Publish Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bill Photo Preview Modal */}
      {previewingBill && previewingBill.image_data && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <span className="font-bold text-xs text-slate-800">
                Bill: {previewingBill.billing_month} (₹{previewingBill.total_amount})
              </span>
              <button
                onClick={() => setPreviewingBill(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl flex items-center justify-center bg-slate-50 p-2">
              <img
                src={previewingBill.image_data}
                alt="Bill"
                className="max-w-full h-auto rounded-lg shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
