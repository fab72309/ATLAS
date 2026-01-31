/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../utils/supabaseClient';
import { clearUserScopedStorage, getCurrentUserId, setActiveUserId } from '../utils/userStorage';
import { hydrateAllStores, resetAllStores } from '../utils/storeReset';

type AuthInitError = {
  kind: 'missing-env' | 'timeout' | 'error';
  message: string;
};

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  initError: AuthInitError | null;
  retryInit: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, profile?: { firstName?: string; lastName?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_TIMEOUT_MS = 8000;

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new TimeoutError('Supabase request timeout')), ms);
      promise.then(resolve, reject);
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<AuthInitError | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const previousUserId = useRef<string | null>(null);

  const retryInit = useCallback(() => {
    setInitAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let subscription: { unsubscribe: () => void } | null = null;

    setInitializing(true);
    setInitError(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setInitError({
        kind: 'missing-env',
        message: 'Configuration Supabase manquante. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.'
      });
      setInitializing(false);
      return () => {
        active = false;
      };
    }

    const applyUser = (nextUser: User | null) => {
      const nextUserId = nextUser?.id ?? null;
      const prevUserId = previousUserId.current;
      if (prevUserId !== nextUserId) {
        resetAllStores();
        clearUserScopedStorage(prevUserId);
        setActiveUserId(nextUserId);
        hydrateAllStores(nextUserId);
        previousUserId.current = nextUserId;
      }
      setUser(nextUser);
      setInitError(null);
      setInitializing(false);
    };

    const bootstrap = async () => {
      try {
        const sessionResult = await withTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS);
        if (!active) return;
        if (sessionResult.error) {
          console.error('Erreur récupération session', sessionResult.error);
        }
        const currentUserId = await withTimeout(getCurrentUserId(), SESSION_TIMEOUT_MS);
        if (!active) return;
        const sessionUserId = sessionResult.data.session?.user?.id ?? null;
        if (currentUserId && currentUserId !== sessionUserId) {
          console.warn('Auth user mismatch', { currentUserId, sessionUserId });
        }
        applyUser(sessionResult.data.session?.user ?? null);
      } catch (error) {
        if (!active) return;
        if (error instanceof TimeoutError) {
          setInitError({
            kind: 'timeout',
            message: 'Supabase injoignable. Vérifiez la connexion et réessayez.'
          });
          setInitializing(false);
          return;
        }
        console.error('Erreur initialisation auth', error);
        setInitError({
          kind: 'error',
          message: 'Impossible d\'initialiser la session. Réessayez.'
        });
        setInitializing(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription: authSubscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });
    subscription = authSubscription;

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [initAttempt]);

  const login = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Configuration Supabase manquante.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const register = useCallback(async (email: string, password: string, profile?: { firstName?: string; lastName?: string }) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Configuration Supabase manquante.');
    }
    const data = {
      first_name: profile?.firstName?.trim() || undefined,
      last_name: profile?.lastName?.trim() || undefined
    };
    const hasProfileData = Boolean(data.first_name || data.last_name);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: hasProfileData ? { data } : undefined
    });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Configuration Supabase manquante.');
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      initError,
      retryInit,
      login,
      register,
      logout
    }),
    [user, initializing, initError, retryInit, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
