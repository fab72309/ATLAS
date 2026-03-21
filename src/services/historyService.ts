import type { MeanItem } from '../types/means';
import type { HydratedOrdreConduite, HydratedOrdreInitial, InterventionHistoryEntry } from '../stores/useInterventionStore';
import { normalizeMeanItems } from '../utils/means';
import { normalizeSymbolProps } from '../utils/sitacSymbolPersistence';
import type { OctTreeNode } from '../utils/octTreeStore';
import { parseConduitePayload, parseOiPayload } from '../utils/soiec';
import { listUserInterventions, type InterventionHistoryItem } from './interventionsService';
import { requireSupabaseClient } from './supabase';

export type MessagePayload = {
  date?: string;
  time?: string;
  stamped?: boolean;
  addressConfirmed?: boolean;
  jeSuis?: string;
  jeVois?: string;
  jeDemande?: string;
  jePrevois?: string;
  jeFais?: string;
  demandes?: Record<string, unknown>;
  surLesLieux?: Record<string, unknown>;
};

export type MessageHistoryEntry = {
  id: string;
  createdAt: string;
  type: 'MESSAGE_AMBIANCE_VALIDATED' | 'MESSAGE_COMPTE_RENDU_VALIDATED';
  payload: MessagePayload;
};

type SitacHistoryRow = {
  feature_id: string;
  symbol_type: string;
  lat: number;
  lng: number;
  props: Record<string, unknown> | null;
};

export type SitacHistoryFeature = {
  id: string;
  symbolType: string;
  color: string;
  label: string;
  lat: number;
  lng: number;
};

export type InterventionHistoryDetails = {
  ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[];
  ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[];
  means: MeanItem[];
  messages: MessageHistoryEntry[];
  sitacFeatures: SitacHistoryFeature[];
  sitacCount: number;
  octCounts: { total: number; sectors: number; subsectors: number; engines: number } | null;
};

const parseMessagePayload = (payload: unknown): MessagePayload | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  return data as MessagePayload;
};

const buildSitacHistoryFeature = (row: SitacHistoryRow): SitacHistoryFeature => {
  const baseProps = row.props ?? {};
  const symbolTypeRaw = typeof row.symbol_type === 'string' ? row.symbol_type : 'symbol';
  const { type: symbolType, props } = normalizeSymbolProps(symbolTypeRaw, baseProps);
  const color = typeof (props as Record<string, unknown>).color === 'string'
    ? (props as Record<string, unknown>).color as string
    : '#3b82f6';
  const textContent = typeof (props as Record<string, unknown>).textContent === 'string'
    ? (props as Record<string, unknown>).textContent as string
    : '';
  const iconName = typeof (props as Record<string, unknown>).iconName === 'string'
    ? (props as Record<string, unknown>).iconName as string
    : '';
  const label = textContent || iconName || symbolType;
  return {
    id: row.feature_id,
    symbolType,
    color,
    label,
    lat: row.lat,
    lng: row.lng
  };
};

const countOctNodes = (node: OctTreeNode, acc = { total: 0, sectors: 0, subsectors: 0, engines: 0 }) => {
  acc.total += 1;
  if (node.type === 'sector') acc.sectors += 1;
  if (node.type === 'subsector') acc.subsectors += 1;
  if (node.type === 'engine') acc.engines += 1;
  node.children.forEach((child) => countOctNodes(child, acc));
  return acc;
};

const isOctTreeNodeLike = (value: unknown): value is OctTreeNode => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string'
    && typeof record.type === 'string'
    && typeof record.label === 'string'
    && Array.isArray(record.children)
    && record.children.every((child) => isOctTreeNodeLike(child))
  );
};

export const fetchUserInterventionHistory = async (userId: string): Promise<InterventionHistoryItem[]> => (
  listUserInterventions(userId)
);

export const fetchInterventionDetails = async (interventionId: string): Promise<InterventionHistoryDetails> => {
  const supabase = requireSupabaseClient();
  const ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[] = [];
  const ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[] = [];
  const messages: MessageHistoryEntry[] = [];

  const { data: eventRows, error: eventError } = await supabase
    .from('intervention_events')
    .select('id, event_type, payload, created_at, user_id, logical_id')
    .eq('intervention_id', interventionId)
    .in('event_type', [
      'OI_VALIDATED',
      'ORDRE_CONDUITE_VALIDATED',
      'MESSAGE_AMBIANCE_VALIDATED',
      'MESSAGE_COMPTE_RENDU_VALIDATED'
    ])
    .order('created_at', { ascending: false });
  if (eventError) throw eventError;

  (eventRows ?? []).forEach((row) => {
    if (row.event_type === 'OI_VALIDATED') {
      const parsed = parseOiPayload(row.payload, row.created_at ?? undefined);
      if (!parsed) return;
      ordreInitialHistory.push({
        id: row.id,
        createdAt: row.created_at,
        userId: row.user_id ?? null,
        logicalId: row.logical_id ?? null,
        payload: parsed
      });
      return;
    }
    if (row.event_type === 'ORDRE_CONDUITE_VALIDATED') {
      const parsed = parseConduitePayload(row.payload, row.created_at ?? undefined);
      if (!parsed) return;
      ordreConduiteHistory.push({
        id: row.id,
        createdAt: row.created_at,
        userId: row.user_id ?? null,
        logicalId: row.logical_id ?? null,
        payload: parsed
      });
      return;
    }
    if (row.event_type === 'MESSAGE_AMBIANCE_VALIDATED' || row.event_type === 'MESSAGE_COMPTE_RENDU_VALIDATED') {
      const parsed = parseMessagePayload(row.payload);
      if (!parsed || !row.created_at) return;
      messages.push({
        id: row.id,
        createdAt: row.created_at,
        type: row.event_type,
        payload: parsed
      });
    }
  });

  let means: MeanItem[] = [];
  let octCounts: InterventionHistoryDetails['octCounts'] = null;
  const { data: meansRows, error: meansError } = await supabase
    .from('intervention_means_state')
    .select('data')
    .eq('intervention_id', interventionId)
    .limit(1);
  if (meansError) throw meansError;
  const raw = meansRows?.[0]?.data as { selectedMeans?: unknown[]; octTree?: unknown } | null | undefined;
  means = normalizeMeanItems(raw?.selectedMeans);
  if (raw?.octTree && isOctTreeNodeLike(raw.octTree)) {
    octCounts = countOctNodes(raw.octTree);
  }

  const { data: sitacRows, error: sitacError } = await supabase
    .from('sitac_features')
    .select('feature_id, symbol_type, lat, lng, props')
    .eq('intervention_id', interventionId);
  if (sitacError) throw sitacError;
  const sitacFeatures = (sitacRows ?? []).map((row) => buildSitacHistoryFeature(row as SitacHistoryRow));

  return {
    ordreInitialHistory,
    ordreConduiteHistory,
    means,
    messages,
    sitacFeatures,
    sitacCount: sitacFeatures.length,
    octCounts
  };
};
