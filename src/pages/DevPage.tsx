import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { TiffinRecord } from '../types';
import { api } from '../lib/api';
import { localDB } from '../lib/idb';
import {
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Unlock,
  Lock,
  RefreshCw,
  Database,
  Users,
  Settings,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const DevPage: React.FC = () => {
  const { isDevMode, devPasskey, enableDevMode, disableDevMode, allUsers, refreshUsers } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();

  const [inputPasskey, setInputPasskey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lockedRecords, setLockedRecords] = useState<TiffinRecord[]>([]);
  const [loadingLocked, setLoadingLocked] = useState(false);

  // Load locked records
  const fetchLockedRecords = async () => {
    setLoadingLocked(true);
    try {
      const all = await api.getTiffins();
      const now = Date.now();
      const lockMs = 24 * 60 * 60 * 1000;
      const locked = all.filter((r) => now - r.created_at > lockMs);
      setLockedRecords(locked);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLocked(false);
    }
  };

  useEffect(() => {
    fetchLockedRecords();
  }, []);

  const handleActivateDev = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const ok = await enableDevMode(inputPasskey);
    if (ok) {
      setSuccessMsg('Developer Mode enabled! 24-hour locks can now be bypassed or unlocked.');
      setInputPasskey('');
    } else {
      setErrorMsg('Invalid Developer Passkey. Default passkey is "flatdev2026".');
    }
  };

  const handleUnlockRecord = async (recordId: string) => {
    const res = await api.devUnlock(devPasskey || 'flatdev2026', recordId);
    if (res.success) {
      setSuccessMsg(`Record ${recordId} successfully unlocked for editing!`);
      await fetchLockedRecords();
    } else {
      setErrorMsg(res.error || 'Failed to unlock record');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-24">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 rounded-2xl p-5 text-white shadow-lg shadow-purple-700/15 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
            <Wrench className="w-5 h-5 text-purple-200" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Developer Mode & 24h Lock Override</h1>
            <p className="text-purple-200 text-xs sm:text-sm mt-0.5">
              Audit preservation control, offline sync diagnostics & system overrides
            </p>
          </div>
        </div>
      </div>

      {/* Dev Mode Status Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-slate-900">Developer Override Status:</span>
              {isDevMode ? (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>ACTIVE (UNLOCKED)</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>LOCKED (Protected)</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              When enabled, you can edit tiffin ticks older than 24 hours to correct historical mistakes.
            </p>
          </div>

          {isDevMode ? (
            <button
              onClick={disableDevMode}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Disable Dev Mode
            </button>
          ) : null}
        </div>

        {/* Enter Passkey Form */}
        {!isDevMode ? (
          <form onSubmit={handleActivateDev} className="mt-5 space-y-3">
            <label className="text-xs font-bold text-slate-700 block">
              Enter Developer Passkey (Default: <code className="text-purple-700 font-mono">flatdev2026</code>)
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={inputPasskey}
                onChange={(e) => setInputPasskey(e.target.value)}
                placeholder="flatdev2026"
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                Authenticate
              </button>
            </div>
          </form>
        ) : null}

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Locked Records Inspector */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">24-Hour Locked Records ({lockedRecords.length})</h2>
            <p className="text-xs text-slate-400">
              Records older than 24 hours frozen against non-developer modification
            </p>
          </div>
          <button
            onClick={fetchLockedRecords}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {lockedRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No records currently past the 24-hour lock threshold. Newly recorded meals will lock automatically after 24 hours.
          </p>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {lockedRecords.map((r) => {
              const isAlreadyUnlocked = r.is_dev_unlocked === 1;
              return (
                <div
                  key={r.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{r.id}</span>
                    <span className="text-slate-500 ml-2">
                      (Tenant1: {r.tenant_1}, Tenant2: {r.tenant_2}, Tenant3: {r.tenant_3}, Tenant4: {r.tenant_4}, Extras: {r.extras})
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">
                      Recorded on {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    {isAlreadyUnlocked ? (
                      <span className="text-emerald-700 font-bold text-[11px] bg-emerald-100 px-2 py-1 rounded">
                        Dev Unlocked
                      </span>
                    ) : (
                      <button
                        onClick={() => handleUnlockRecord(r.id)}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-bold text-xs transition-colors"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock Record</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Offline & Sync Diagnostics */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Offline Sync & Storage Diagnostics</h2>
        <p className="text-xs text-slate-400 mb-4">IndexedDB offline queue status and manual sync trigger</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-xs text-slate-500 block">Connection</span>
            <span className={`text-sm font-black mt-1 block ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isOnline ? 'Connected (Online)' : 'Disconnected (Offline)'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-xs text-slate-500 block">Offline Mutations Queued</span>
            <span className="text-sm font-black text-slate-800 mt-1 block">
              {pendingCount} changes
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-xs text-slate-500 block">Database</span>
            <span className="text-sm font-black text-purple-700 mt-1 block">
              Cloudflare D1 + IndexedDB
            </span>
          </div>
        </div>

        <button
          onClick={syncNow}
          disabled={isSyncing}
          className="flex items-center justify-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors w-full sm:w-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Flushing Queue...' : 'Force Sync With Cloudflare D1'}</span>
        </button>
      </div>
    </div>
  );
};
