/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import {
  EMPLOYMENT_LEVEL_OPTIONS,
  normalizeEmploymentLevel,
  SHORTCUT_OPTIONS,
  type ShortcutKey
} from '../constants/profile';
import { buildDevBypassProfile, isDevAuthBypassEnabled } from '../utils/devBypass';
import {
  buildProfileInsertFromUser,
  createProfile,
  fetchProfileById,
  updateProfileById
} from '../services/profileService';
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
    if (isDevAuthBypassEnabled()) {
      void targetUser;
      const mockProfile = buildDevBypassProfile();
      setProfile(mockProfile);
      setError(null);
      return mockProfile;
    }
    const insertPayload = buildProfileInsertFromUser(targetUser);
    insertPayload.employment_level = normalizeEmploymentLevel(insertPayload.employment_level) ?? null;
    try {
      const data = await createProfile(insertPayload);
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      setError(null);
      return normalized;
    } catch (insertError) {
      console.error('Profile insert error', insertError);
      setError('Impossible de créer le profil.');
      return null;
    }
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdate) => {
    if (isDevAuthBypassEnabled()) {
      let nextProfile: ProfileRow | null = null;
      setProfile((currentProfile) => {
        nextProfile = {
          ...(currentProfile ?? buildDevBypassProfile()),
          ...updates,
          updated_at: new Date().toISOString()
        } as ProfileRow;
        return nextProfile;
      });
      setError(null);
      return nextProfile;
    }
    if (!user) return null;
    const payload = { ...updates };
    try {
      const data = await updateProfileById(user.id, payload);
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      setError(null);
      return normalized;
    } catch (updateError) {
      console.error('Profile update error', updateError);
      setError('Impossible de mettre à jour le profil.');
      return null;
    }
  }, [user]);

  const applyProfileDefaults = useCallback(async (nextProfile: ProfileRow) => {
    if (!shouldApplyDefaults(nextProfile)) return nextProfile;
    const shortcut_keys = getDefaultShortcuts(nextProfile.employment_level);
    return updateProfile({ shortcut_keys });
  }, [updateProfile]);

  const fetchProfile = useCallback(async () => {
    if (isDevAuthBypassEnabled()) {
      setProfile(buildDevBypassProfile());
      setLoading(false);
      setError(null);
      return;
    }
    if (!user) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfileById(user.id);
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
