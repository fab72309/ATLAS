/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';
import { clearUserScopedStorage, getCurrentUserId, setActiveUserId } from '../utils/userStorage';
import { hydrateAllStores, resetAllStores } from '../utils/storeReset';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

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
      setInitializing(false);
    };

    const bootstrap = async () => {
      const sessionResult = await supabase.auth.getSession();
      if (!active) return;
      if (sessionResult.error) {
        console.error('Erreur récupération session', sessionResult.error);
      }
      const currentUserId = await getCurrentUserId();
      if (!active) return;
      const sessionUserId = sessionResult.data.session?.user?.id ?? null;
      if (currentUserId && currentUserId !== sessionUserId) {
        console.warn('Auth user mismatch', { currentUserId, sessionUserId });
      }
      applyUser(sessionResult.data.session?.user ?? null);
    };

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      login,
      register,
      logout
    }),
    [user, initializing, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
};
