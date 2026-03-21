import type { User } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import { requireSupabaseClient } from './supabase';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export const fetchProfileById = async (userId: string): Promise<ProfileRow | null> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const createProfile = async (payload: ProfileInsert): Promise<ProfileRow> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const updateProfileById = async (userId: string, updates: ProfileUpdate): Promise<ProfileRow> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

export const buildProfileInsertFromUser = (user: User): ProfileInsert => {
  const metadata = user.user_metadata || {};
  const firstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
  const lastName = typeof metadata.last_name === 'string' ? metadata.last_name.trim() : '';
  const employmentLevel = typeof metadata.employment_level === 'string' ? metadata.employment_level : null;
  return {
    id: user.id,
    first_name: firstName || null,
    last_name: lastName || null,
    employment_level: employmentLevel
  };
};
