import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../utils/supabaseClient';

export const requireSupabaseClient = (): SupabaseClient => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Configuration Supabase manquante.');
  }
  return supabase;
};

export const getAuthenticatedUser = async (): Promise<User> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) {
    throw new Error('Utilisateur non authentifié.');
  }
  return data.user;
};

export const getAuthenticatedUserId = async (): Promise<string> => {
  const user = await getAuthenticatedUser();
  return user.id;
};
