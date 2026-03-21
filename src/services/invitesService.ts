import { requireSupabaseClient } from './supabase';

export type InvitePreview = {
  intervention_id: string;
  title: string | null;
  incident_number: string | null;
  address_line1: string | null;
  street_number: string | null;
  street_name: string | null;
  postal_code: string | null;
  city: string | null;
};

export const previewInvite = async (token: string): Promise<InvitePreview | null> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc('preview_invite', { p_token: token });
  if (error) throw error;
  const payload = Array.isArray(data) ? data[0] : data;
  return (payload as InvitePreview | null | undefined) ?? null;
};

export const joinInterventionByToken = async (token: string, commandLevel: string): Promise<string> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc('join_by_token', {
    p_token: token,
    p_command_level: commandLevel
  });
  if (error) throw error;
  const interventionId = typeof data === 'string' ? data : null;
  if (!interventionId) {
    throw new Error('Intervention introuvable.');
  }
  return interventionId;
};

export const createInvite = async (interventionId: string): Promise<{ token: string }> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.rpc('create_invite', {
    p_intervention_id: interventionId
  });
  if (error) throw error;
  const payload = Array.isArray(data) ? data[0] : data;
  const token = payload && typeof payload.token === 'string' ? payload.token : null;
  if (!token) {
    throw new Error('Token manquant dans la reponse.');
  }
  return { token };
};
