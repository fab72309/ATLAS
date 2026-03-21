import { normalizeMeanItems } from './means';
import { resetOctTree, setOctTree, type OctTreeNode } from './octTreeStore';
import { useInterventionStore, type HydratedOrdreInitial, type HydratedOrdreConduite, type InterventionHistoryEntry } from '../stores/useInterventionStore';
import { useMeansStore } from '../stores/useMeansStore';
import { useSitacStore } from '../stores/useSitacStore';
import type { MeanItem } from '../types/means';
import type { SITACCollection } from '../types/sitac';
import { parseConduitePayload, parseOiPayload } from './soiec';
import { fetchInterventionMeta, fetchMeansState } from '../services/interventionsService';
import { loadSitacCollection } from '../services/sitacService';
import { requireSupabaseClient } from '../services/supabase';

export const isOctTreeNode = (value: unknown): value is OctTreeNode => {
  if (!value || typeof value !== 'object') return false;
  const record = value as OctTreeNode;
  return typeof record.id === 'string' && typeof record.type === 'string' && Array.isArray(record.children);
};

export type HydratedInterventionResult = {
  ordreInitial?: HydratedOrdreInitial;
  ordreConduite?: HydratedOrdreConduite;
  means: MeanItem[];
  sitac: SITACCollection;
  startedAtMs: number;
};

const buildEmptyCollection = (): SITACCollection => ({ type: 'FeatureCollection', features: [] });

export const hydrateIntervention = async (interventionId: string): Promise<HydratedInterventionResult> => {
  if (!interventionId) {
    throw new Error('Intervention manquante pour hydratation');
  }

  const interventionStore = useInterventionStore.getState();
  const meansStore = useMeansStore.getState();
  const sitacStore = useSitacStore.getState();

  const emptySitac = buildEmptyCollection();
  sitacStore.setFromHydration(emptySitac);
  meansStore.setFromHydration([]);
  resetOctTree();
  interventionStore.setHydratedOrdreInitial(null, interventionId);
  interventionStore.setHydratedOrdreConduite(null, interventionId);
  interventionStore.setOrdersHistory({ ordreInitial: [], ordreConduite: [] });
  interventionStore.setLogicalIds({ oiLogicalId: null, conduiteLogicalId: null });

  let startedAtMs = Date.now();
  try {
    const row = await fetchInterventionMeta(interventionId);
    const createdAt = row?.created_at;
    if (createdAt) {
      const parsed = new Date(createdAt).getTime();
      if (Number.isFinite(parsed)) startedAtMs = parsed;
    }
    const hasAddress =
      Boolean(row?.address_line1) ||
      Boolean(row?.street_number) ||
      Boolean(row?.street_name) ||
      Boolean(row?.city);
    if (hasAddress) {
      interventionStore.setInterventionAddress({
        address: row?.address_line1 ?? null,
        streetNumber: row?.street_number ?? null,
        streetName: row?.street_name ?? null,
        city: row?.city ?? null
      });
    }
    interventionStore.setInterventionMeta({
      status: typeof row?.status === 'string' ? row.status : null,
      isTraining: typeof row?.is_training === 'boolean' ? row.is_training : null,
      trainingSetAt: typeof row?.training_set_at === 'string' ? row.training_set_at : null,
      trainingSetBy: typeof row?.training_set_by === 'string' ? row.training_set_by : null
    });
    interventionStore.setLogicalIds({
      oiLogicalId: row?.oi_logical_id ?? null,
      conduiteLogicalId: row?.conduite_logical_id ?? null
    });
  } catch (error) {
    console.error('Hydration: intervention meta failed', error);
  }

  interventionStore.setCurrentIntervention(interventionId, startedAtMs);

  let ordreInitial: HydratedOrdreInitial | undefined;
  let ordreConduite: HydratedOrdreConduite | undefined;
  const ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[] = [];
  const ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[] = [];
  try {
    const supabase = requireSupabaseClient();
    const { data: eventRows, error } = await supabase
      .from('intervention_events')
      .select('id, event_type, payload, created_at, user_id, logical_id')
      .eq('intervention_id', interventionId)
      .in('event_type', ['OI_VALIDATED', 'ORDRE_CONDUITE_VALIDATED'])
      .order('created_at', { ascending: false });
    if (error) throw error;
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
        if (!ordreInitial) ordreInitial = parsed;
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
        if (!ordreConduite) ordreConduite = parsed;
      }
    });
    interventionStore.setOrdersHistory({
      ordreInitial: ordreInitialHistory,
      ordreConduite: ordreConduiteHistory
    });
    interventionStore.setHydratedOrdreInitial(ordreInitial ?? null, interventionId);
    interventionStore.setHydratedOrdreConduite(ordreConduite ?? null, interventionId);
  } catch (error) {
    console.error('Hydration: orders failed', error);
  }

  let means: MeanItem[] = [];
  try {
    const raw = await fetchMeansState(interventionId);
    means = normalizeMeanItems(raw?.selectedMeans);
    meansStore.setFromHydration(means);
    if (raw?.octTree && isOctTreeNode(raw.octTree)) {
      setOctTree(raw.octTree);
    }
  } catch (error) {
    console.error('Hydration: means failed', error);
  }

  let sitac: SITACCollection = emptySitac;
  try {
    sitac = await loadSitacCollection(interventionId);
    sitacStore.setFromHydration(sitac);
  } catch (error) {
    console.error('Hydration: sitac failed', error);
  }

  interventionStore.setHydrationMeta(interventionId, new Date().toISOString());

  return { ordreInitial, ordreConduite, means, sitac, startedAtMs };
};
