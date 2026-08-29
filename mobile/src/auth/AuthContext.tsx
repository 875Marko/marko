import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, AuthApi, User, setAuthToken } from '@/src/api/client';

const TOKEN_KEY = 'car_spotter_session_token';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (!stored) return;
        setAuthToken(stored);
        const me = await AuthApi.me();
        setUser(me);
      } catch {
        // Expired/invalid session — fall through to logged-out state.
        setAuthToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applySession = useCallback(async (session_token: string, freshUser: User) => {
    setAuthToken(session_token);
    await AsyncStorage.setItem(TOKEN_KEY, session_token);
    setUser(freshUser);
  }, []);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const { session_token, user: freshUser } = await AuthApi.login(username, password);
      await applySession(session_token, freshUser);
    },
    [applySession]
  );

  const signUp = useCallback(
    async (username: string, password: string, displayName?: string) => {
      const { session_token, user: freshUser } = await AuthApi.register(username, password, displayName);
      await applySession(session_token, freshUser);
    },
    [applySession]
  );

  const signOut = useCallback(async () => {
    try {
      await AuthApi.logout();
    } catch {
      // Best-effort — clear local session regardless of server response.
    }
    setAuthToken(null);
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await AuthApi.me();
      setUser(me);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuthToken(null);
        await AsyncStorage.removeItem(TOKEN_KEY);
        setUser(null);
      }
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, refreshUser }),
    [user, loading, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
