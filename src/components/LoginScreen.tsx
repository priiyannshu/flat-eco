import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { api } from '../lib/api';
import {
  UtensilsCrossed,
  Shield,
  Lock,
  ScanFace,
  Fingerprint,
  KeyRound,
  AlertCircle,
  Smartphone,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const {
    allUsers,
    deviceBoundUserId,
    passkeySupported,
    biometricsAvailable,
    enrollDevicePasskey,
    unlockWithPasskey,
    loginWithPin,
    unbindDevice
  } = useAuth();

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPinFallback, setShowPinFallback] = useState(false);
  const [hasPasskeyEnrolled, setHasPasskeyEnrolled] = useState(false);

  // Check if bound user exists
  const boundUser = allUsers.find((u) => u.id === deviceBoundUserId);

  useEffect(() => {
    if (boundUser) {
      setSelectedUser(boundUser);
      // Check if user has registered passkey
      api.getPasskeyStatus(boundUser.id).then((status) => {
        setHasPasskeyEnrolled(status.hasPasskey);
      });
    }
  }, [boundUser]);

  // Attempt instant Face ID / Passkey unlock for returning bound user
  const handlePasskeyUnlock = async () => {
    if (!selectedUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await unlockWithPasskey(selectedUser.id);
      if (!res.success) {
        setErrorMsg(res.error || 'Biometric verification cancelled.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Passkey verification failed');
    } finally {
      setLoading(false);
    }
  };

  // Enroll device with Face ID / Passkey
  const handleEnrollPasskey = async () => {
    if (!selectedUser) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await enrollDevicePasskey(selectedUser.id, pinInput || undefined);
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
  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !pinInput) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await loginWithPin(selectedUser.id, pinInput);
      if (!res.success) {
        setErrorMsg(res.error || 'Incorrect PIN');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login error');
    } finally {
      setLoading(false);
    }
  };

  const owner = allUsers.find((u) => u.role === 'owner') || {
    id: 'owner',
    name: 'Apartment Owner',
    role: 'owner' as const,
    room_or_info: 'Owner / Caretaker',
    pin: '1234',
    created_at: 0
  };

  const tenants = allUsers.filter((u) => u.role === 'tenant');

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
                {boundUser.role === 'owner' ? 'Apartment Owner' : boundUser.room_or_info || 'Tenant'}
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

          {/* Device Reset / Unbind */}
          <div className="mt-10 pt-6 border-t border-slate-900">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to unbind this device? You will need to re-authenticate on next setup.')) {
                  unbindDevice();
                }
              }}
              className="text-[11px] text-slate-500 hover:text-red-400 transition-colors"
            >
              Reset Device / Change Bound User
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: Fresh Device Setup (One-time Enrollment)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* App Branding */}
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand-500/20">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">FlatEco Setup</h1>
          <p className="text-xs text-slate-500 mt-1">
            {selectedUser
              ? `Locking device to ${selectedUser.name}`
              : 'Select your profile to lock this device to your identity'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Select Profile */}
        {!selectedUser ? (
          <div>
            {/* Owner Card */}
            <div className="mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Landlord / Owner
              </p>
              <button
                onClick={() => setSelectedUser(owner)}
                className="w-full bg-white border border-amber-200 hover:border-amber-400 p-4 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200 font-bold text-base">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors block">
                      {owner.name}
                    </span>
                    <span className="text-xs text-slate-400 block">
                      {owner.room_or_info || 'Apartment Caretaker'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
              </button>
            </div>

            {/* Tenant Profiles */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
                Flatmates (4 Roommates)
              </p>
              <div className="space-y-2.5">
                {tenants.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedUser(t)}
                    className="w-full bg-white border border-slate-200 hover:border-brand-400 p-3.5 rounded-2xl shadow-sm hover:shadow transition-all flex items-center justify-between text-left group"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-brand-50 group-hover:text-brand-700 flex items-center justify-center font-bold text-sm transition-colors">
                        {t.name ? t.name.charAt(t.name.length - 1) : idx + 1}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-800 group-hover:text-brand-700 transition-colors block">
                          {t.name}
                        </span>
                        <span className="text-xs text-slate-400 block">
                          {t.room_or_info || `Tenant ${idx + 1}`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-6">
              Each flatmate must choose their own profile on their personal phone.
            </p>
          </div>
        ) : (
          /* STEP 2: Enroll Passkey (Face ID / Touch ID / Fingerprint) */
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <button
              onClick={() => {
                setSelectedUser(null);
                setPinInput('');
                setErrorMsg('');
              }}
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Profiles</span>
            </button>

            <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${
                selectedUser.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
              }`}>
                {selectedUser.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedUser.name}</h3>
                <p className="text-xs text-slate-400 capitalize">
                  {selectedUser.role === 'owner' ? 'Owner / Caretaker' : selectedUser.room_or_info || 'Tenant'}
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
                className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <ScanFace className="w-4 h-4 text-brand-200" />
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
                onClick={handlePinLogin}
                disabled={loading || !pinInput}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
              >
                Lock Device with PIN Only
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">
              Once registered, this phone will be locked exclusively to your profile. Row-level security protects your account from tampering.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
