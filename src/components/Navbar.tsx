import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  Menu,
  X,
  UtensilsCrossed,
  CreditCard,
  Zap,
  Home,
  Wifi,
  WifiOff,
  RefreshCw,
  Shield,
  ChevronRight
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { id: 'tiffins', label: 'Tiffins', icon: UtensilsCrossed, description: 'Daily meals counter' },
    { id: 'bills', label: 'Electricity Bill', icon: Zap, description: 'Upload & view bills' },
    { id: 'rent', label: 'Rent Log', icon: Home, description: 'Monthly rent records' },
    { id: 'payments', label: 'Payments', icon: CreditCard, description: 'UPI QR & dues' },
  ];

  const handleSelectTab = (tabId: string) => {
    setCurrentTab(tabId);
    setDrawerOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-15">
            {/* Left: Hamburger Button & App Name without icon */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-1.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <span className="font-extrabold text-base tracking-tight text-slate-900">
                Flat<span className="text-brand-600">Eco</span>
              </span>
            </div>

            {/* Right: Sync Status (Notifications and Profile tag removed) */}
            <div className="flex items-center space-x-2">
              {/* Online/Offline Status */}
              <button
                onClick={syncNow}
                title={isOnline ? (pendingCount > 0 ? `${pendingCount} changes syncing` : 'Synced') : 'Offline'}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !isOnline
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : pendingCount > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {!isOnline ? (
                  <WifiOff className="w-3 h-3 text-amber-600" />
                ) : (
                  <Wifi className="w-3 h-3 text-emerald-600" />
                )}
                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin text-slate-600 ml-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hamburger Menu Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Top Header: Showing Tenant or Owner Tag instead of FlatEco heading and icon */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                      currentUser?.role === 'owner'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300/70'
                        : 'bg-brand-50 text-brand-700 border border-brand-200'
                    }`}
                  >
                    <Shield className={`w-3.5 h-3.5 mr-1.5 ${currentUser?.role === 'owner' ? 'text-amber-600' : 'text-brand-600'}`} />
                    {currentUser?.role === 'owner' ? 'Apartment Owner' : 'Tenant'}
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Active Profile Info */}
              {currentUser && (
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm ${
                      currentUser.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
                    }`}>
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="truncate flex-1">
                      <span className="text-sm font-bold text-slate-900 block truncate">
                        {currentUser.name}
                      </span>
                      <span className="text-xs text-slate-400 block">
                        {currentUser.role === 'owner' ? 'Owner / Caretaker' : 'Tenant'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="p-3 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-bold shadow-xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                        <div>
                          <span className="text-sm block">{item.label}</span>
                          <span className="text-[11px] text-slate-400 font-normal block">{item.description}</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-300'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
