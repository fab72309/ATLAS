import type { Database } from '../types/supabase';
import { getAuthenticatedUserId, requireSupabaseClient } from './supabase';

export type InterventionHistoryItem = {
  id: string;
  status: string;
  title: string | null;
  created_at: string | null;
  updated_at: string | null;
  address_line1: string | null;
  street_number: string | null;
  street_name: string | null;
  city: string | null;
  incident_number: string | null;
  command_level: string | null;
  role: string | null;
};

export type InterventionStatus = 'open' | 'closed' | string;

export type InterventionMetaRecord = {
  created_at?: string | null;
  status?: string | null;
  is_training?: boolean | null;
  training_set_at?: string | null;
  training_set_by?: string | null;
  address_line1?: string | null;
  street_number?: string | null;
  street_name?: string | null;
  postal_code?: string | null;
  city?: string | null;
  incident_number?: string | null;
  oi_logical_id?: string | null;
  conduite_logical_id?: string | null;
};

type InterventionCreateInput = {
  commandLevel: string;
  title: string;
  addressLine1?: string | null;
  streetNumber?: string | null;
  streetName?: string | null;
  city?: string | null;
  isTraining: boolean;
};

type InterventionCreateResult = {
  interventionId: string;
  userId: string;
  oiLogicalId: string | null;
  conduiteLogicalId: string | null;
  trainingSetAt: string | null;
  trainingMetaApplied: boolean;
};

type MeansStateRow = {
  data?: {
    selectedMeans?: unknown[];
    octTree?: unknown;
  } | null;
};

const normalizeHistoryItem = (row: {
  intervention_id: string;
  role?: string | null;
  command_level?: string | null;
  interventions?: Record<string, unknown> | Record<string, unknown>[] | null;
}): InterventionHistoryItem => {
  const rawIntervention = row.interventions;
  const intervention = Array.isArray(rawIntervention) ? rawIntervention[0] ?? {} : rawIntervention ?? {};
  return {
    id: (intervention.id as string) || row.intervention_id,
    status: (intervention.status as string) || 'open',
    title: (intervention.title as string) ?? null,
    created_at: (intervention.created_at as string) ?? null,
    updated_at: (intervention.updated_at as string) ?? null,
    address_line1: (intervention.address_line1 as string) ?? null,
    street_number: (intervention.street_number as string) ?? null,
    street_name: (intervention.street_name as string) ?? null,
    city: (intervention.city as string) ?? null,
    incident_number: (intervention.incident_number as string) ?? null,
    command_level: row.command_level ?? null,
    role: row.role ?? null
  };
};

export const listUserInterventions = async (userId: string): Promise<InterventionHistoryItem[]> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('intervention_members')
    .select('intervention_id, role, command_level, interventions ( id, title, status, created_at, updated_at, address_line1, street_number, street_name, city, incident_number )')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .map((row) => normalizeHistoryItem(row as Parameters<typeof normalizeHistoryItem>[0]))
    .filter((item) => item.id)
    .sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
};

export const createIntervention = async (input: InterventionCreateInput): Promise<InterventionCreateResult> => {
  const supabase = requireSupabaseClient();
  const userId = await getAuthenticatedUserId();
  const trainingSetAt = new Date().toISOString();
  const basePayload = {
    title: input.title,
    created_by: userId,
    address_line1: input.addressLine1 || null,
    street_number: input.streetNumber || null,
    street_name: input.streetName || null,
    city: input.city || null,
    is_training: input.isTraining
  };
  const createWithTraining = {
    ...basePayload,
    training_set_at: trainingSetAt,
    training_set_by: userId
  };

  let created: { id?: string; oi_logical_id?: string | null; conduite_logical_id?: string | null } | null = null;
  let trainingMetaApplied = false;

  const { data: createdWithTraining, error: firstError } = await supabase
    .from('interventions')
    .insert(createWithTraining)
    .select('id, oi_logical_id, conduite_logical_id')
    .single();

  if (firstError) {
    console.warn('Intervention creation with training metadata failed, retrying without training_set_by.', firstError);
    const { data: createdFallback, error: fallbackError } = await supabase
      .from('interventions')
      .insert(basePayload)
      .select('id, oi_logical_id, conduite_logical_id')
      .single();
    if (fallbackError) throw fallbackError;
    created = createdFallback;
  } else {
    created = createdWithTraining;
    trainingMetaApplied = true;
  }

  const interventionId = created?.id as string | undefined;
  if (!interventionId) {
    throw new Error('Intervention ID manquant après création.');
  }

  const { error: memberError } = await supabase
    .from('intervention_members')
    .insert({ intervention_id: interventionId, user_id: userId, role: 'owner', command_level: input.commandLevel });
  if (memberError) throw memberError;

  return {
    interventionId,
    userId,
    oiLogicalId: created?.oi_logical_id ?? null,
    conduiteLogicalId: created?.conduite_logical_id ?? null,
    trainingSetAt: trainingMetaApplied ? trainingSetAt : null,
    trainingMetaApplied
  };
};

export const fetchInterventionMeta = async (interventionId: string): Promise<InterventionMetaRecord | null> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('interventions')
    .select('created_at, status, is_training, training_set_at, training_set_by, address_line1, street_number, street_name, postal_code, city, incident_number, oi_logical_id, conduite_logical_id')
    .eq('id', interventionId)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as InterventionMetaRecord | undefined) ?? null;
};

export const fetchInterventionStatus = async (interventionId: string): Promise<InterventionStatus | null> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('interventions')
    .select('status')
    .eq('id', interventionId)
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.status as InterventionStatus | undefined) ?? null;
};

export const reopenIntervention = async (interventionId: string): Promise<void> => {
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from('interventions')
    .update({ status: 'open' })
    .eq('id', interventionId);
  if (error) throw error;
};

export const closeIntervention = async (interventionId: string): Promise<void> => {
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from('interventions')
    .update({ status: 'closed' })
    .eq('id', interventionId);
  if (error) throw error;
};

export const deleteIntervention = async (interventionId: string): Promise<void> => {
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from('interventions')
    .delete()
    .eq('id', interventionId);
  if (error) throw error;
};

export const fetchMeansState = async (interventionId: string): Promise<MeansStateRow['data']> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('intervention_means_state')
    .select('data')
    .eq('intervention_id', interventionId)
    .limit(1);
  if (error) throw error;
  return (data?.[0] as MeansStateRow | undefined)?.data ?? null;
};

export const upsertMeansState = async (
  interventionId: string,
  payload: { selectedMeans: unknown[]; octTree: unknown }
): Promise<string> => {
  const supabase = requireSupabaseClient();
  const userId = await getAuthenticatedUserId();
  const { error } = await supabase
    .from('intervention_means_state')
    .upsert({
      intervention_id: interventionId,
      data: payload as Database['public']['Tables']['intervention_means_state']['Insert']['data'],
      updated_by: userId
    });
  if (error) throw error;
  return userId;
};
