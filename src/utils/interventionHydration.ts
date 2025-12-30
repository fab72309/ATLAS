import { supabase } from './supabaseClient';
import { normalizeMeanItems } from './means';
import { resetOctTree, setOctTree, type OctTreeNode } from './octTreeStore';
import { useInterventionStore, type HydratedOrdreInitial, type HydratedOrdreConduite, type InterventionHistoryEntry } from '../stores/useInterventionStore';
import { useMeansStore } from '../stores/useMeansStore';
import { useSitacStore } from '../stores/useSitacStore';
import type { MeanItem } from '../types/means';
import type { SITACCollection, SITACFeature, SITACFeatureProperties } from '../types/sitac';
import type { OrdreInitial, IdeeManoeuvre } from '../types/soiec';
import { normalizeSymbolProps } from './sitacSymbolPersistence';

type SitacRow = {
  feature_id: string;
  symbol_type: string;
  lat: number;
  lng: number;
  props: Record<string, unknown> | null;
};

const isOctTreeNode = (value: unknown): value is OctTreeNode => {
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

const buildSitacFeature = (row: SitacRow): SITACFeature => {
  const baseProps = row.props ?? {};
  const symbolTypeRaw = typeof row.symbol_type === 'string' ? row.symbol_type : 'symbol';
  const { type: symbolType, props } = normalizeSymbolProps(symbolTypeRaw, baseProps);
  const color = typeof (props as Record<string, unknown>).color === 'string'
    ? (props as Record<string, unknown>).color as string
    : '#3b82f6';
  const properties: SITACFeatureProperties = {
    id: row.feature_id,
    type: symbolType as SITACFeatureProperties['type'],
    color,
    ...(props as Record<string, unknown>)
  } as SITACFeatureProperties;
  return {
    type: 'Feature',
    id: row.feature_id,
    properties,
    geometry: {
      type: 'Point',
      coordinates: [row.lng, row.lat]
    }
  };
};

const normalizeStringList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (typeof entry === 'number') return String(entry);
        if (entry && typeof entry === 'object') return JSON.stringify(entry);
        return '';
      })
      .filter((entry) => entry.trim());
  }
  if (typeof value === 'string') {
    return value.split('\n').map((entry) => entry.trim()).filter(Boolean);
  }
  return [String(value)];
};

const normalizeIdeeManoeuvre = (value: unknown): IdeeManoeuvre[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return { mission: entry, moyen: '', moyen_supp: '', details: '' };
        }
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        return {
          mission: typeof record.mission === 'string' ? record.mission : '',
          moyen: typeof record.moyen === 'string' ? record.moyen : '',
          moyen_supp: typeof record.moyen_supp === 'string' ? record.moyen_supp : '',
          details: typeof record.details === 'string' ? record.details : ''
        };
      })
      .filter(Boolean) as IdeeManoeuvre[];
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((mission) => ({ mission, moyen: '', moyen_supp: '', details: '' }));
  }
  return [];
};

const normalizeExecution = (value: unknown): OrdreInitial['E'] => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value;
  return JSON.stringify(value);
};

const buildOrdreFromSoiec = (record: Record<string, unknown>): OrdreInitial => {
  const situation = typeof record.situation === 'string'
    ? record.situation
    : typeof record.S === 'string'
      ? record.S
      : '';
  const objectifs = record.objectifs ?? record.O;
  const ideeManoeuvre = record.idee_manoeuvre ?? record.I;
  const execution = record.execution ?? record.E;
  const commandement = record.commandement ?? record.C;
  const anticipation = record.anticipation ?? record.A;
  const logistique = record.logistique ?? record.L;

  return {
    S: situation,
    O: normalizeStringList(objectifs),
    I: normalizeIdeeManoeuvre(ideeManoeuvre),
    E: normalizeExecution(execution),
    C: typeof commandement === 'string' ? commandement : commandement ? JSON.stringify(commandement) : '',
    A: normalizeStringList(anticipation),
    L: normalizeStringList(logistique)
  };
};

const parseOiPayload = (payload: unknown, createdAt?: string | null): HydratedOrdreInitial | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  let ordreData = record.ordreData as HydratedOrdreInitial['ordreData'] | undefined;
  if (!ordreData && record.soiec && typeof record.soiec === 'object') {
    ordreData = buildOrdreFromSoiec(record.soiec as Record<string, unknown>);
  }
  if (!ordreData) return null;

  const meta = record.meta && typeof record.meta === 'object' ? record.meta as Record<string, unknown> : {};
  const selectedRisksSource = Array.isArray(record.selectedRisks)
    ? record.selectedRisks
    : Array.isArray(meta.selected_risks)
      ? meta.selected_risks
      : [];
  const selectedRisks = selectedRisksSource.filter((entry) => typeof entry === 'string');
  const validatedAtIso = createdAt || undefined;
  const validatedAtLabel = createdAt
    ? new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : undefined;

  const addressBlock = record.address && typeof record.address === 'object'
    ? record.address as Record<string, unknown>
    : {};
  const address = typeof record.address === 'string'
    ? record.address
    : typeof addressBlock.address === 'string'
      ? addressBlock.address
      : typeof addressBlock.address_line1 === 'string'
        ? addressBlock.address_line1
        : '';
  const city = typeof record.city === 'string'
    ? record.city
    : typeof addressBlock.city === 'string'
      ? addressBlock.city
      : '';

  return {
    ordreData,
    selectedRisks: selectedRisks as HydratedOrdreInitial['selectedRisks'],
    additionalInfo: typeof record.additionalInfo === 'string'
      ? record.additionalInfo
      : typeof meta.additional_info === 'string'
        ? meta.additional_info
        : '',
    address,
    city,
    orderTime: typeof record.orderTime === 'string'
      ? record.orderTime
      : typeof meta.order_time === 'string'
        ? meta.order_time
        : '',
    soiecType: typeof record.soiecType === 'string'
      ? record.soiecType
      : typeof meta.soiec_type === 'string'
        ? meta.soiec_type
        : undefined,
    validatedAtIso,
    validatedAtLabel
  };
};

const parseConduitePayload = (payload: unknown, createdAt?: string | null): HydratedOrdreConduite | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const ordreConduite = record.ordreConduite as HydratedOrdreConduite['ordreConduite'] | undefined;
  if (!ordreConduite) return null;

  const selectedRisks = Array.isArray(record.conduiteSelectedRisks)
    ? record.conduiteSelectedRisks.filter((entry) => typeof entry === 'string')
    : [];
  const validatedAtIso = createdAt || undefined;
  const validatedAtLabel = createdAt
    ? new Date(createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : undefined;

  const conduiteAddress = typeof record.conduiteAddress === 'string'
    ? record.conduiteAddress
    : typeof record.address === 'string'
      ? record.address
      : '';
  const conduiteCity = typeof record.conduiteCity === 'string'
    ? record.conduiteCity
    : typeof record.city === 'string'
      ? record.city
      : '';
  const conduiteAdditionalInfo = typeof record.conduiteAdditionalInfo === 'string'
    ? record.conduiteAdditionalInfo
    : typeof record.additionalInfo === 'string'
      ? record.additionalInfo
      : '';
  const conduiteOrderTime = typeof record.conduiteOrderTime === 'string'
    ? record.conduiteOrderTime
    : typeof record.orderTime === 'string'
      ? record.orderTime
      : '';

  return {
    ordreConduite,
    conduiteSelectedRisks: selectedRisks as HydratedOrdreConduite['conduiteSelectedRisks'],
    conduiteAdditionalInfo,
    conduiteAddress,
    conduiteCity,
    conduiteOrderTime,
    validatedAtIso,
    validatedAtLabel
  };
};

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
    const { data: interventionRows, error } = await supabase
      .from('interventions')
      .select('created_at, address_line1, street_number, street_name, postal_code, city, incident_number, oi_logical_id, conduite_logical_id')
      .eq('id', interventionId)
      .limit(1);
    if (error) throw error;
    const row = interventionRows?.[0];
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
  let ordreInitialHistory: InterventionHistoryEntry<HydratedOrdreInitial>[] = [];
  let ordreConduiteHistory: InterventionHistoryEntry<HydratedOrdreConduite>[] = [];
  try {
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
    const { data: meansRows, error } = await supabase
      .from('intervention_means_state')
      .select('data')
      .eq('intervention_id', interventionId)
      .limit(1);
    if (error) throw error;
    const raw = meansRows?.[0]?.data as { selectedMeans?: unknown[]; octTree?: unknown } | null | undefined;
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
    const { data: sitacRows, error } = await supabase
      .from('sitac_features')
      .select('feature_id, symbol_type, lat, lng, props')
      .eq('intervention_id', interventionId);
    if (error) throw error;
    const features = (sitacRows ?? []).map((row) => buildSitacFeature(row as SitacRow));
    sitac = { type: 'FeatureCollection', features };
    sitacStore.setFromHydration(sitac);
  } catch (error) {
    console.error('Hydration: sitac failed', error);
  }

  interventionStore.setHydrationMeta(interventionId, new Date().toISOString());

  return { ordreInitial, ordreConduite, means, sitac, startedAtMs };
};
