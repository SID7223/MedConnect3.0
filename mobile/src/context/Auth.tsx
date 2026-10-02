import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';

export interface User {
  id: number | string;
  name: string;
  email?: string;
  avatar?: string;
  exam?: string;
  country?: string;
  profile_complete?: number | boolean;
  [key: string]: unknown;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (cred: string) => Promise<any>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthValue | null>(null);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('token');
        if (!t) return;

        // Show cached user instantly — works offline and removes loading flash
        const cached = await AsyncStorage.getItem('mc_user');
        let hasCached = false;
        if (cached) {
          try {
            setUser(JSON.parse(cached));
            hasCached = true;
          } catch {
            // corrupt cache — ignore
          }
        }
        // Ready to render from cache right away; refresh from the server below.
        if (hasCached) setLoading(false);

        try {
          const d = await withTimeout(api.me(), 8000);
          setUser(d.user);
          AsyncStorage.setItem('mc_user', JSON.stringify(d.user));
        } catch (err: any) {
          // Only log out if the SERVER explicitly rejected the token (401/403).
          // Network errors, timeouts, and 5xx errors should NOT log the user out.
          const msg = err?.message || '';
          const isAuthFailure =
            /\b(401|403)\b/.test(msg) ||
            msg.toLowerCase().includes('unauthorized') ||
            msg.toLowerCase().includes('forbidden');
          if (isAuthFailure) {
            AsyncStorage.removeItem('token');
            AsyncStorage.removeItem('mc_user');
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = (token: string, u: User) => {
    AsyncStorage.setItem('token', token);
    AsyncStorage.setItem('mc_user', JSON.stringify(u));
    setUser(u);
  };

  const value: AuthValue = {
    user,
    loading,
    setUser,
    login: async (e, p) => {
      const d = await api.login(e, p);
      persist(d.token, d.user);
    },
    googleLogin: async (cred) => {
      const d = await api.googleLogin(cred);
      persist(d.token, d.user);
      return d;
    },
    register: async (n, e, p) => {
      const d = await api.register(n, e, p);
      persist(d.token, d.user);
    },
    logout: () => {
      AsyncStorage.removeItem('token');
      AsyncStorage.removeItem('mc_user');
      setUser(null);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
