import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';
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
  ChevronRight,
  Sun,
  Moon,
  ClipboardList
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();
  const { isDark, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isOwner = currentUser?.role === 'owner';

  const navItems = [
    {
      id: 'tiffins',
      label: isOwner ? 'Daily Tiffin Counter' : 'Tiffins',
      icon: UtensilsCrossed,
      description: isOwner ? 'Mark daily meals' : 'Daily meals counter'
    },
    ...(isOwner
      ? [
          {
            id: 'tiffin-log',
            label: 'Tiffin Log',
            icon: ClipboardList,
            description: "Bird's eye view of tiffins"
          }
        ]
      : []),
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
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
        <div className="max-w-4xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-15">
            {/* Left: Hamburger Button & App Name */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                Flat<span className="text-brand-600 dark:text-brand-500">Eco</span>
              </span>
            </div>

            {/* Right: Sync Status */}
            <div className="flex items-center space-x-2">
              {/* Online/Offline Status */}
              <button
                onClick={syncNow}
                title={isOnline ? (pendingCount > 0 ? `${pendingCount} changes syncing` : 'Synced') : 'Offline'}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  !isOnline
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                    : pendingCount > 0
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}
              >
                {!isOnline ? (
                  <WifiOff className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Wifi className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                )}
                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin text-slate-600 dark:text-slate-400 ml-0.5" />}
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
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 h-full shadow-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200">
            <div>
              {/* Drawer Top Header: Showing Tenant or Owner Tag */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold tracking-wide uppercase ${
                      currentUser?.role === 'owner'
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60'
                        : 'bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800'
                    }`}
                  >
                    <Shield className={`w-3.5 h-3.5 mr-1.5 ${currentUser?.role === 'owner' ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'}`} />
                    {currentUser?.role === 'owner' ? 'Apartment Owner' : 'Tenant'}
                  </span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Active Profile Info */}
              {currentUser && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm ${
                      currentUser.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
                    }`}>
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="truncate flex-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">
                        {currentUser.name}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-400 block">
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
                          ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-400 font-bold shadow-xs'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <div>
                          <span className="text-sm block">{item.label}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal block">{item.description}</span>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Drawer Bottom: Sun / Moon Dark Mode Toggle */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-800 flex items-center justify-center transition-colors">
                    {isDark ? (
                      <Moon className="w-4 h-4 text-brand-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      {isDark ? 'Dark Mode' : 'Light Mode'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 block">
                      {isDark ? 'Night theme enabled' : 'Day theme enabled'}
                    </span>
                  </div>
                </div>

                {/* Sun / Moon Toggle Switch */}
                <button
                  onClick={toggleTheme}
                  type="button"
                  role="switch"
                  aria-checked={isDark}
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isDark ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white dark:bg-slate-900 shadow-md ring-0 transition duration-200 ease-in-out ${
                      isDark ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  >
                    {isDark ? (
                      <Moon className="w-3.5 h-3.5 text-brand-400 fill-brand-400/20" />
                    ) : (
                      <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
