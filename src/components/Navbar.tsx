import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  UtensilsCrossed,
  Home,
  Zap,
  BookOpen,
  FileText,
  Wrench,
  Wifi,
  WifiOff,
  RefreshCw,
  Bell,
  User,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { AppNotification } from '../types';
import { api } from '../lib/api';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { currentUser, allUsers, switchUser, isDevMode } = useAuth();
  const { isOnline, pendingCount, isSyncing, syncNow } = useSync();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
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
    { id: 'tiffins', label: 'Tiffins', icon: UtensilsCrossed, badge: 'Daily' },
    { id: 'rent', label: 'Rent', icon: Home },
    { id: 'bills', label: 'Bills', icon: Zap },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
    { id: 'receipts', label: 'Receipts', icon: FileText },
    { id: 'dev', label: 'Dev', icon: Wrench, isDev: true },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900">Flat<span className="text-brand-600">Eco</span></span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">PWA</span>
                {isDevMode && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Dev Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Apartment Tiffins, Rent & Shared Ledger</p>
            </div>
          </div>

          {/* Center Navigation for Desktop */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] bg-brand-200/60 text-brand-800 px-1 rounded font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Sync & Offline Status */}
            <button
              onClick={syncNow}
              title={isOnline ? (pendingCount > 0 ? `${pendingCount} offline changes pending sync` : 'All synced') : 'Offline - changes stored locally'}
              className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                !isOnline
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : pendingCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Online</span>
                </>
              )}
              {pendingCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white rounded-full text-[10px] px-1.5 py-0.2 font-bold">
                  {pendingCount}
                </span>
              )}
              {isSyncing && <RefreshCw className="w-3 h-3 animate-spin ml-1 text-slate-600" />}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowProfileMenu(false);
                }}
                className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkRead(n.id)}
                          className={`p-3 text-left transition-colors cursor-pointer ${
                            n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-brand-50/50 hover:bg-brand-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="text-xs font-semibold text-slate-800">{n.title}</h4>
                            <span className="text-[10px] text-slate-400">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Switcher Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(!showProfileMenu);
                  setShowNotifMenu(false);
                }}
                className="flex items-center space-x-2 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                  currentUser?.role === 'owner' ? 'bg-amber-500' : 'bg-brand-600'
                }`}>
                  {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[90px]">
                    {currentUser?.name || 'Guest'}
                  </div>
                  <div className="text-[10px] text-slate-400 capitalize">
                    {currentUser?.role === 'owner' ? 'Apartment Owner' : 'Flatmate'}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Profile Selector Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Switch Active Profile</p>
                    <p className="text-xs text-slate-600 mt-0.5">5 Profiles (1 Owner + 4 Flatmates)</p>
                  </div>
                  <div className="py-1">
                    {allUsers.map((user) => {
                      const isCurrent = currentUser?.id === user.id;
                      return (
                        <button
                          key={user.id}
                          onClick={() => {
                            switchUser(user.id);
                            setShowProfileMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            isCurrent ? 'bg-brand-50 text-brand-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${user.role === 'owner' ? 'bg-amber-500' : 'bg-brand-500'}`} />
                            <div className="text-left">
                              <span className="block">{user.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{user.room_or_info}</span>
                            </div>
                          </div>
                          {isCurrent && <span className="text-brand-600 text-[10px] font-bold">Active</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="pt-2 border-t border-slate-100 px-3">
                    <button
                      onClick={() => {
                        setCurrentTab('dev');
                        setShowProfileMenu(false);
                      }}
                      className="w-full text-left py-1 text-xs text-purple-700 font-medium hover:text-purple-900 flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" /> Developer Passcode & Overrides
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 shadow-lg flex justify-around items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`flex flex-col items-center py-1.5 px-3 rounded-lg transition-colors relative ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-brand-600 stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
              {item.badge && (
                <span className="absolute -top-1 right-2 w-2 h-2 bg-brand-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
