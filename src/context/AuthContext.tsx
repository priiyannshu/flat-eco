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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceBoundUserId, setDeviceBoundUserId] = useState<string | null>(() => {
    return localStorage.getItem('flat_eco_device_user_id');
  });

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>(DEFAULT_PROFILES);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);

  const refreshUsers = async () => {
    const users = await api.getUsers();
    setAllUsers(users);
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated) setCurrentUser(updated);
    }
  };

  // Check WebAuthn platform availability on mount
  useEffect(() => {
    setPasskeySupported(isPasskeySupported());
    isPlatformAuthenticatorAvailable().then(setBiometricsAvailable);
  }, []);

  // Check existing session on boot
  useEffect(() => {
    const initAuth = async () => {
      await refreshUsers();

      // Check if server session is still valid
      const sessionResult = await api.checkSession();
      if (sessionResult && sessionResult.user) {
        setCurrentUser(sessionResult.user);
        setIsLocked(false);
        if (!deviceBoundUserId) {
          setDeviceBoundUserId(sessionResult.user.id);
          localStorage.setItem('flat_eco_device_user_id', sessionResult.user.id);
        }
      } else {
        // Session expired or missing - locked
        setIsLocked(true);
      }
    };

    initAuth();
  }, [deviceBoundUserId]);

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
        setCurrentUser(res.user);
        setIsLocked(false);
        setDeviceBoundUserId(res.user.id);
        localStorage.setItem('flat_eco_device_user_id', res.user.id);
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
        setCurrentUser(res.user);
        setIsLocked(false);
        setDeviceBoundUserId(res.user.id);
        localStorage.setItem('flat_eco_device_user_id', res.user.id);
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
        setCurrentUser(res.user);
        setIsLocked(false);
        setDeviceBoundUserId(res.user.id);
        localStorage.setItem('flat_eco_device_user_id', res.user.id);
        return { success: true };
      }
      return { success: false, error: res.error || 'Authentication failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login error' };
    }
  };

  // Lock the device (requires biometric or PIN re-authentication)
  const lockApp = () => {
    setIsLocked(true);
    setCurrentUser(null);
  };

  // Unbind this device (clears local binding and server session)
  const unbindDevice = async () => {
    await api.logoutServer();
    setCurrentUser(null);
    setIsLocked(true);
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
