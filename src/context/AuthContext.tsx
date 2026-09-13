import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { api, DEFAULT_PROFILES } from '../lib/api';
import {
  createPasskeyCredential,
  getPasskeyAssertion,
  isPasskeySupported,
  isPlatformAuthenticatorAvailable
} from '../lib/webauthn';

interface AuthContextType {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  deviceBoundUserId: string | null;
  isLocked: boolean;
  passkeySupported: boolean;
  biometricsAvailable: boolean;
  enrollDevicePasskey: (userId: string, setupPin?: string) => Promise<{ success: boolean; error?: string }>;
  unlockWithPasskey: (targetUserId?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPin: (userId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  selectProfile: (user: UserProfile) => void;
  lockApp: () => void;
  unbindDevice: () => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getDevicePlatform(): string {
  if (typeof navigator === 'undefined') return 'Mobile Device';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone (Face ID)';
  if (/Android/i.test(ua)) return 'Android (Fingerprint / Biometric)';
  if (/Mac/i.test(ua)) return 'Mac (Touch ID)';
  if (/Win/i.test(ua)) return 'Windows (Windows Hello)';
  return 'Personal Device';
}

function getInitialUser(): UserProfile | null {
  try {
    const saved = localStorage.getItem('flat_eco_user');
    if (saved) {
      return JSON.parse(saved);
    }
    const boundId = localStorage.getItem('flat_eco_device_user_id');
    if (boundId) {
      const match = DEFAULT_PROFILES.find((u) => u.id === boundId);
      if (match) {
        localStorage.setItem('flat_eco_user', JSON.stringify(match));
        return match;
      }
    }
  } catch (e) {
    console.error('Error restoring initial user from localStorage:', e);
  }
  return null;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceBoundUserId, setDeviceBoundUserId] = useState<string | null>(() => {
    return localStorage.getItem('flat_eco_device_user_id');
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getInitialUser);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>(DEFAULT_PROFILES);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);

  const refreshUsers = async () => {
    const users = await api.getUsers();
    setAllUsers(users);
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) {
        setCurrentUser(updated);
        localStorage.setItem('flat_eco_user', JSON.stringify(updated));
      }
    }
  };

  // Check WebAuthn platform availability on mount
  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
    isPlatformAuthenticatorAvailable().then(setBiometricsAvailable);
  }, []);

  // Sync users and verify session on boot in background without blocking or locking
  useEffect(() => {
    const initAuth = async () => {
      try {
        const users = await api.getUsers();
        setAllUsers(users);

        // Keep currentUser updated with latest server state
        const boundId = localStorage.getItem('flat_eco_device_user_id');
        const savedUserStr = localStorage.getItem('flat_eco_user');
        const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        const targetId = savedUser?.id || boundId || currentUser?.id;

        if (targetId) {
          const fresh = users.find((u) => u.id === targetId);
          if (fresh) {
            setCurrentUser(fresh);
            localStorage.setItem('flat_eco_user', JSON.stringify(fresh));
            if (!boundId) {
              setDeviceBoundUserId(fresh.id);
              localStorage.setItem('flat_eco_device_user_id', fresh.id);
            }
          }
        }

        // Verify session in background to refresh server token if possible
        const sessionResult = await api.checkSession();
        if (sessionResult && sessionResult.user) {
          setCurrentUser(sessionResult.user);
          localStorage.setItem('flat_eco_user', JSON.stringify(sessionResult.user));
          if (!deviceBoundUserId) {
            setDeviceBoundUserId(sessionResult.user.id);
            localStorage.setItem('flat_eco_device_user_id', sessionResult.user.id);
          }
        }
      } catch (err) {
        console.error('Background auth init error:', err);
      }
    };

    initAuth();
  }, []);

  const selectProfile = (user: UserProfile) => {
    setCurrentUser(user);
    setIsLocked(false);
    setDeviceBoundUserId(user.id);
    localStorage.setItem('flat_eco_user', JSON.stringify(user));
    localStorage.setItem('flat_eco_device_user_id', user.id);
  };

  // Register device passkey (e.g. Face ID / Fingerprint)
  const enrollDevicePasskey = async (
    userId: string,
    setupPin?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const options = await api.getPasskeyRegisterOptions(userId, setupPin);
      const credential = await createPasskeyCredential(options);
      const deviceName = getDevicePlatform();

      const res = await api.verifyPasskeyRegister(userId, credential, deviceName);
      if (res.success && res.user) {
        selectProfile(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Passkey enrollment failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Passkey setup cancelled or failed' };
    }
  };

  // Unlock with Face ID / Passkey
  const unlockWithPasskey = async (targetUserId?: string): Promise<{ success: boolean; error?: string }> => {
    const userId = targetUserId || deviceBoundUserId;
    if (!userId) {
      return { success: false, error: 'No profile associated with this device.' };
    }

    try {
      const options = await api.getPasskeyAuthOptions(userId);
      const assertion = await getPasskeyAssertion(options);
      const deviceName = getDevicePlatform();

      const res = await api.verifyPasskeyAuth(userId, assertion, deviceName);
      if (res.success && res.user) {
        selectProfile(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Biometric authentication failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Face ID / Touch ID cancelled' };
    }
  };

  // Fallback PIN login (for devices without biometrics or during setup)
  const loginWithPin = async (userId: string, pin: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const deviceName = getDevicePlatform();
      const res = await api.login(userId, pin, deviceName);
      if (res.success && res.user) {
        selectProfile(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Authentication failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login error' };
    }
  };

  // Lock the device (no-op now since lock device feature was removed)
  const lockApp = () => {
    // Intentionally no-op to prevent locking on reload or user action
  };

  // Unbind this device (clears local binding and server session)
  const unbindDevice = async () => {
    await api.logoutServer();
    setCurrentUser(null);
    setIsLocked(false);
    setDeviceBoundUserId(null);
    localStorage.removeItem('flat_eco_device_user_id');
    localStorage.removeItem('flat_eco_token');
    localStorage.removeItem('flat_eco_user');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        deviceBoundUserId,
        isLocked,
        passkeySupported,
        biometricsAvailable,
        enrollDevicePasskey,
        unlockWithPasskey,
        loginWithPin,
        selectProfile,
        lockApp,
        unbindDevice,
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
