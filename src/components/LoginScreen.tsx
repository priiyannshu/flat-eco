import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import {
  Shield,
  ScanFace,
  AlertCircle
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const {
    allUsers,
    deviceBoundUserId,
    selectProfile,
    enrollDevicePasskey,
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

  // If device is already bound to a user, activate immediately without showing any lock screen
  useEffect(() => {
    if (boundUser) {
      selectProfile(boundUser);
    }
  }, [boundUser]);

  if (boundUser) {
    return null;
  }

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
      setErrorMsg(err.message || 'Setup error');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Fresh Device Setup (Apartment Owner)
  // Tenants are locked down on their respective devices
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
            Setting up device for <span className="font-semibold text-slate-700">{owner.name}</span>
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
              <span>{loading ? 'Registering...' : 'Set Up Device with Face ID / Passkey'}</span>
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
              Set Up Device with PIN Only
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center mt-5 leading-relaxed">
            Tenant setups are locked down. This phone will be configured exclusively for the Apartment Owner profile.
          </p>
        </div>
      </div>
    </div>
  );
};
