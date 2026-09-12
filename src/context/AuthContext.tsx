import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { api, DEFAULT_PROFILES } from '../lib/api';

interface AuthContextType {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isDevMode: boolean;
  devPasskey: string;
  login: (userId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  switchUser: (userId: string) => void;
  logout: () => void;
  enableDevMode: (passkey: string) => Promise<boolean>;
  disableDevMode: () => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('flat_eco_user');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES[1]; // Default to Tenant 1 (Me) for instant access
  });
  const [allUsers, setAllUsers] = useState<UserProfile[]>(DEFAULT_PROFILES);
  const [isDevMode, setIsDevMode] = useState<boolean>(() => {
    return localStorage.getItem('flat_eco_dev_mode') === 'true';
  });
  const [devPasskey, setDevPasskey] = useState<string>(() => {
    return localStorage.getItem('flat_eco_dev_key') || '';
  });

  const refreshUsers = async () => {
    const users = await api.getUsers();
    setAllUsers(users);
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const login = async (userId: string, pin: string) => {
    const res = await api.login(userId, pin);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      localStorage.setItem('flat_eco_user', JSON.stringify(res.user));
      return { success: true };
    }
    return { success: false, error: res.error || 'Authentication failed' };
  };

  const switchUser = (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem('flat_eco_user', JSON.stringify(target));
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('flat_eco_user');
  };

  const enableDevMode = async (passkey: string) => {
    const res = await api.devUnlock(passkey);
    if (res.success) {
      setIsDevMode(true);
      setDevPasskey(passkey);
      localStorage.setItem('flat_eco_dev_mode', 'true');
      localStorage.setItem('flat_eco_dev_key', passkey);
      return true;
    }
    return false;
  };

  const disableDevMode = () => {
    setIsDevMode(false);
    setDevPasskey('');
    localStorage.removeItem('flat_eco_dev_mode');
    localStorage.removeItem('flat_eco_dev_key');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        isDevMode,
        devPasskey,
        login,
        switchUser,
        logout,
        enableDevMode,
        disableDevMode,
        refreshUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
