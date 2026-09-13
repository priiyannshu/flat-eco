import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { api } from '../lib/api';
import {
  Shield,
  Lock,
  ScanFace,
  KeyRound,
  AlertCircle
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const {
    allUsers,
    deviceBoundUserId,
    enrollDevicePasskey,
    unlockWithPasskey,
    loginWithPin
  } = useAuth();

  const owner: UserProfile = allUsers.find((u) => u.role === 'owner') || {
    id: 'owner',
    name: 'Apartment Owner',
    role: 'owner' as const,
    room_or_info: 'Owner / Caretaker',
    pin: '1234',
    created_at: 0
  };

  const boundUser = allUsers.find((u) => u.id === deviceBoundUserId);
  const activeUser = boundUser || owner;

  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);

  useEffect(() => {
    if (boundUser) {
      api.getPasskeyStatus(boundUser.id).then(() => {});
    }
  }, [boundUser]);

  // Attempt instant Face ID / Passkey unlock for returning bound user
  const handlePasskeyUnlock = async () => {
    if (!activeUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await unlockWithPasskey(activeUser.id);
      if (!res.success) {
        setErrorMsg(res.error || 'Biometric verification cancelled.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Passkey verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Enroll device with Face ID / Passkey (Owner setup)
  const handleEnrollPasskey = async () => {
    if (!activeUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await enrollDevicePasskey(activeUser.id, pinInput || undefined);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to enroll Face ID / Passkey.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Enrollment error');
    } finally {
      setLoading(false);
    }
  };

  // Fallback PIN login
  const handlePinLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeUser || !pinInput) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await loginWithPin(activeUser.id, pinInput);
      if (!res.success) {
        setErrorMsg(res.error || 'Incorrect PIN');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW A: Locked Device (Device already bound to a specific user)
  // -------------------------------------------------------------
  if (boundUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 text-white select-none">
        <div className="w-full max-w-sm text-center">
          {/* Lock & App Icon */}
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-3xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-brand-400 mx-auto shadow-2xl shadow-brand-500/10">
              <ScanFace className="w-10 h-10" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-slate-950 shadow-md">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            Flat<span className="text-brand-400">Eco</span> Lock
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            Device securely locked to <span className="font-bold text-white">{boundUser.name}</span>
          </p>

          {/* User Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5 text-left flex items-center space-x-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm ${
              boundUser.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
            }`}>
              {boundUser.name.charAt(0)}
            </div>
            <div className="truncate flex-1">
              <span className="text-sm font-bold text-white block truncate">{boundUser.name}</span>
              <span className="text-xs text-slate-400 block capitalize">
                {boundUser.role === 'owner' ? 'Apartment Owner' : 'Tenant'}
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Bound
            </span>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Biometric Unlock Button */}
          {!showPinFallback && (
            <div className="space-y-3">
              <button
                onClick={handlePasskeyUnlock}
                disabled={loading}
                className="w-full py-4 px-5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-xl shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <ScanFace className="w-5 h-5 text-brand-200" />
                <span>{loading ? 'Authenticating...' : 'Unlock with Face ID / Passkey'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPinFallback(true)}
                className="w-full py-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center space-x-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Use PIN fallback</span>
              </button>
            </div>
          )}

          {/* PIN Fallback View */}
          {showPinFallback && (
            <form onSubmit={handlePinLogin} className="space-y-3 animate-in fade-in duration-150">
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit PIN"
                autoFocus
                className="w-full text-center text-lg tracking-widest font-mono py-3.5 px-4 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />

              <button
                type="submit"
                disabled={loading || !pinInput}
                className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Unlock Device'}
              </button>

              <button
                type="button"
                onClick={() => setShowPinFallback(false)}
                className="text-xs text-slate-400 hover:text-slate-200 underline pt-1 block mx-auto"
              >
                Back to Face ID
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: Fresh Device Setup (Only Apartment Owner)
  // Tenants are stripped away to enforce complete lockdown
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* App Branding */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-amber-500/20">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">FlatEco Setup</h1>
          <p className="text-xs text-slate-500 mt-1">
            Locking device to <span className="font-semibold text-slate-700">{owner.name}</span>
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg bg-amber-500 shadow-sm shadow-amber-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{owner.name}</h3>
              <p className="text-xs text-slate-400">
                Apartment Caretaker & Admin
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Enter Setup PIN (Default: <code className="text-brand-600">1234</code>)
              </label>
              <input
                type="password"
                maxLength={6}
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="1234"
                className="w-full text-center text-lg tracking-widest font-mono py-2.5 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Passkey / Face ID Button */}
            <button
              type="button"
              onClick={handleEnrollPasskey}
              disabled={loading || !pinInput}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <ScanFace className="w-4 h-4 text-amber-100" />
              <span>{loading ? 'Registering...' : 'Lock Device with Face ID / Passkey'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] uppercase font-bold text-slate-400">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Fallback PIN button */}
            <button
              type="button"
              onClick={() => handlePinLogin()}
              disabled={loading || !pinInput}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              Lock Device with PIN Only
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">
            Tenant setups are locked down. This phone will be bound exclusively to the Apartment Owner profile.
          </p>
        </div>
      </div>
    </div>
  );
};
