import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { UtensilsCrossed, Shield, User, ChevronRight } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { allUsers, selectProfile } = useAuth();

  const owner = allUsers.find((u) => u.role === 'owner') || {
    id: 'owner',
    name: 'Apartment Owner',
    role: 'owner' as const,
    room_or_info: 'Owner / Caretaker',
    pin: '1234',
    created_at: 0
  };

  const tenants = allUsers.filter((u) => u.role === 'tenant');

  const handleSelect = (user: UserProfile) => {
    selectProfile(user);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* App Branding */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand-500/20">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">FlatEco</h1>
          <p className="text-xs text-slate-500 mt-1">Select your profile to continue</p>
        </div>

        {/* Owner Profile Card */}
        <div className="mb-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Owner Profile
          </p>
          <button
            onClick={() => handleSelect(owner)}
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
            <div className="flex items-center space-x-1 text-slate-400 group-hover:text-amber-600 transition-colors">
              <span className="text-xs font-semibold">Enter</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Tenant Profiles List */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            Flatmates (4 Tenants)
          </p>
          <div className="space-y-2.5">
            {tenants.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
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
                <div className="flex items-center space-x-1 text-slate-400 group-hover:text-brand-600 transition-colors">
                  <span className="text-xs font-medium">Select</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Minimal info */}
        <p className="text-[11px] text-slate-400 text-center mt-8">
          You can switch profiles at any time from the menu
        </p>
      </div>
    </div>
  );
};
