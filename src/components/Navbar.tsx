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
  FileText,
  Bell,
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  Shield,
  ChevronRight
} from 'lucide-react';
import { AppNotification } from '../types';
import { api } from '../lib/api';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, lockApp, unbindDevice } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
    if (!currentUser) return;
    const list = await api.getNotifications(currentUser.id);
    setNotifications(list);
    setUnreadCount(list.filter(n => !n.is_read).length);
  };

  React.useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    await fetchNotifs();
  };

  const navItems = [
    { id: 'tiffins', label: 'Tiffins', icon: UtensilsCrossed, description: 'Daily meals counter' },
    { id: 'payments', label: 'Payments', icon: CreditCard, description: 'UPI QR & dues' },
    { id: 'bills', label: 'Electricity Bill', icon: Zap, description: 'Upload & view bills' },
    { id: 'rent', label: 'Rent Log', icon: Home, description: 'Monthly rent records' },
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
            {/* Left: Hamburger Button & Logo */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-1.5 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20">
                  <UtensilsCrossed className="w-4 h-4" />
                </div>
                <span className="font-extrabold text-base tracking-tight text-slate-900">
                  Flat<span className="text-brand-600">Eco</span>
                </span>
              </div>
            </div>

            {/* Right: Sync Status, Notifications & Profile Avatar */}
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

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifMenu(!showNotifMenu)}
                  className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>

                {showNotifMenu && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded-full font-bold">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">No notifications</div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkRead(n.id)}
                            className={`p-3 text-left transition-colors cursor-pointer ${
                              n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-brand-50/40 hover:bg-brand-50'
                            }`}
                          >
                            <h4 className="text-xs font-bold text-slate-800">{n.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Pill (Click opens drawer / shows switch) */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center space-x-1.5 pl-2 pr-2.5 py-1 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                  currentUser?.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
                }`}>
                  {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <span className="text-xs font-semibold text-slate-800 max-w-[80px] truncate">
                  {currentUser?.name || 'Profile'}
                </span>
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
              {/* Drawer Top Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                  <span className="font-extrabold text-base text-slate-900">FlatEco</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-bold text-slate-900 block truncate">
                          {currentUser.name}
                        </span>
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                          <Shield className="w-2.5 h-2.5 mr-0.5" />
                          Locked
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block capitalize">
                        {currentUser.role === 'owner' ? 'Apartment Owner' : currentUser.room_or_info || 'Tenant'}
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

            {/* Drawer Bottom Actions: Lock Device & Unbind Device */}
            <div className="p-4 border-t border-slate-100 space-y-2">
              <button
                onClick={() => {
                  lockApp();
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                <span>Lock Device</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('Unbind this device? This will reset the device lock and sign out.')) {
                    unbindDevice();
                    setDrawerOpen(false);
                  }
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-slate-400 hover:text-red-500 text-[11px] font-medium transition-colors"
              >
                <span>Reset Device Binding</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
