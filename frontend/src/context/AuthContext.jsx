// frontend/src/context/AuthContext.jsx — session state backed by the API's httpOnly cookie
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { auth } from '../services/userApi';

const AuthContext = createContext();
const LAST_USER_KEY = 'nivra_last_user_v1';

export const AuthProvider = ({ children }) => {
  // authStatus: 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'
  const [authStatus, setAuthStatus] = useState('AUTH_LOADING');
  const [user, setUser] = useState(null);
  const [authConfig, setAuthConfig] = useState({ googleClientId: null, mobileEnabled: false, mobileDevMode: false });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [bootError, setBootError] = useState('');

  const applyUser = useCallback((u) => {
    setUser(u);
    setAuthStatus(u ? 'AUTHENTICATED' : 'UNAUTHENTICATED');
    // remember who was signed in so the app (helplines, saved location) still opens offline
    try {
      if (u) localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: u.id, name: u.name, avatar: u.avatar, provider: u.provider, isGuest: u.isGuest, profile: u.profile, emergencyContacts: u.emergencyContacts }));
      else localStorage.removeItem(LAST_USER_KEY);
    } catch { /* storage unavailable */ }
  }, []);

  const boot = useCallback(async () => {
    setBootError('');
    try {
      const [me, cfg] = await Promise.all([auth.me(), auth.config()]);
      setAuthConfig(cfg);
      applyUser(me.user);
    } catch (err) {
      // No network: open with the last signed-in user instead of the login screen
      let last = null;
      try { last = JSON.parse(localStorage.getItem(LAST_USER_KEY)); } catch { /* ignore */ }
      if (err.status === 0 && last) {
        setUser({ ...last, offline: true });
        setAuthStatus('AUTHENTICATED');
        return;
      }
      setBootError(err.message);
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => { boot(); }, [boot]);

  // back online after an offline start: confirm the real session
  useEffect(() => {
    if (!user?.offline) return;
    window.addEventListener('online', boot);
    return () => window.removeEventListener('online', boot);
  }, [user?.offline, boot]);

  // Each login helper resolves to the user or throws an ApiError with a readable message
  const run = useCallback(async (promise) => {
    const { user: u } = await promise;
    applyUser(u);
    return u;
  }, [applyUser]);

  const value = {
    authStatus,
    user,
    authConfig,
    bootError,
    retryBoot: boot,
    showLogoutConfirm,
    setShowLogoutConfirm,
    register: (name, email, password) => run(auth.register(name, email, password)),
    loginWithEmail: (email, password) => run(auth.login(email, password)),
    loginWithGoogle: (credential) => run(auth.google(credential)),
    requestOtp: (phone) => auth.requestOtp(phone),
    verifyOtp: (phone, code) => run(auth.verifyOtp(phone, code)),
    loginAsGuest: () => run(auth.guest()),
    updateProfile: (patch) => run(auth.update(patch)),
    logout: async () => {
      setShowLogoutConfirm(false);
      try { await auth.logout(); } finally { applyUser(null); }
    },
    deleteAccount: async () => {
      await auth.deleteAccount();
      applyUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
