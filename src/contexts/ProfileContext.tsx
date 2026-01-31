/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { getSupabaseClient } from '../utils/supabaseClient';
import {
  EMPLOYMENT_LEVEL_OPTIONS,
  normalizeEmploymentLevel,
  SHORTCUT_OPTIONS,
  type ShortcutKey
} from '../constants/profile';
import { useAuth } from './AuthContext';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

const SHORTCUT_KEYS = new Set(SHORTCUT_OPTIONS.map((shortcut) => shortcut.key));

const normalizeShortcutKeys = (input: readonly string[] | null | undefined): ShortcutKey[] => {
  if (!Array.isArray(input)) return [];
  return input.filter((key): key is ShortcutKey => SHORTCUT_KEYS.has(key as ShortcutKey));
};

const getDefaultShortcuts = (level: string | null | undefined): ShortcutKey[] => {
  const normalized = normalizeEmploymentLevel(level);
  const found = EMPLOYMENT_LEVEL_OPTIONS.find((option) => option.value === normalized);
  return normalizeShortcutKeys(found?.defaultShortcuts ?? []);
};

const buildProfileInsert = (user: User): Database['public']['Tables']['profiles']['Insert'] => {
  const metadata = user.user_metadata || {};
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
  const employmentLevel = normalizeEmploymentLevel(
    typeof metadata.employment_level === 'string' ? metadata.employment_level : null
  );
  return {
    id: user.id,
    first_name: firstName || null,
    last_name: lastName || null,
    employment_level: employmentLevel
  };
};

const normalizeProfile = (profile: ProfileRow): ProfileRow => ({
  ...profile,
  employment_level: normalizeEmploymentLevel(profile.employment_level) ?? null,
  shortcut_keys: normalizeShortcutKeys(profile.shortcut_keys as string[])
});

const shouldApplyDefaults = (profile: ProfileRow | null): boolean => {
  if (!profile) return false;
  if (profile.shortcut_keys && profile.shortcut_keys.length > 0) return false;
  return Boolean(profile.employment_level);
};

interface ProfileContextValue {
  profile: ProfileRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<ProfileRow | null>;
  ensureProfile: (user: User) => Promise<ProfileRow | null>;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureProfile = useCallback(async (targetUser: User): Promise<ProfileRow | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Configuration Supabase manquante.');
      return null;
    }
    const insertPayload = buildProfileInsert(targetUser);
    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert(insertPayload)
      .select('*')
      .single();
    if (insertError) {
      console.error('Profile insert error', insertError);
      setError('Impossible de créer le profil.');
      return null;
    }
    const normalized = normalizeProfile(data);
    setProfile(normalized);
    setError(null);
    return normalized;
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (!user) return null;
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Configuration Supabase manquante.');
      return null;
    }
    const payload = { ...updates };
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select('*')
      .single();
    if (updateError) {
      console.error('Profile update error', updateError);
      setError('Impossible de mettre à jour le profil.');
      return null;
    }
    const normalized = normalizeProfile(data);
    setProfile(normalized);
    setError(null);
    return normalized;
  }, [user]);

  const applyProfileDefaults = useCallback(async (nextProfile: ProfileRow) => {
    if (!shouldApplyDefaults(nextProfile)) return nextProfile;
    const shortcut_keys = getDefaultShortcuts(nextProfile.employment_level);
    return updateProfile({ shortcut_keys });
  }, [updateProfile]);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Configuration Supabase manquante.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (fetchError) {
        console.error('Profile fetch error', fetchError);
        setError('Impossible de charger le profil.');
        return;
      }
      if (!data) {
        const created = await ensureProfile(user);
        if (created) {
          await applyProfileDefaults(created);
        }
        return;
      }
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      await applyProfileDefaults(normalized);
    } catch (error) {
      console.error('Profile fetch error', error);
      setError('Impossible de charger le profil.');
    } finally {
      setLoading(false);
    }
  }, [applyProfileDefaults, ensureProfile, user]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const refresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      refresh,
      updateProfile,
      ensureProfile
    }),
    [profile, loading, error, refresh, updateProfile, ensureProfile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile doit être utilisé dans un ProfileProvider');
  return ctx;
};

export const isProfileComplete = (profile: ProfileRow | null): boolean => Boolean(profile?.employment_level);
