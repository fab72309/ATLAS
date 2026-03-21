import type { SITACCollection, SITACFeature, SITACFeatureProperties } from '../types/sitac';
import { normalizeSymbolProps } from '../utils/sitacSymbolPersistence';
import { getAuthenticatedUserId, requireSupabaseClient } from './supabase';

export type SitacFeatureRow = {
  feature_id: string;
  symbol_type: string;
  lat: number;
  lng: number;
  props: Record<string, unknown> | null;
};

export type SitacStateSnapshot = {
  featureId: string;
  symbolType: string;
  lat: number;
  lng: number;
  props: Record<string, unknown>;
  hash: string;
};

type SitacSyncDiff = {
  added: SitacStateSnapshot[];
  updated: SitacStateSnapshot[];
  removed: SitacStateSnapshot[];
  nextMap: Map<string, SitacStateSnapshot>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const content = entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',');
    return `{${content}}`;
  }
  return JSON.stringify(value);
};

export const mapSitacRowToFeature = (row: SitacFeatureRow): SITACFeature => {
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

export const buildSitacSnapshot = (feature: SITACFeature): SitacStateSnapshot | null => {
  if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return null;
  const coords = feature.geometry.coordinates as unknown;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const rawProps: Record<string, unknown> = isRecord(feature.properties) ? feature.properties : {};
  const featureId = typeof feature.id === 'string'
    ? feature.id
    : typeof rawProps.id === 'string'
      ? rawProps.id
      : '';
  if (!featureId) return null;
  const { type: symbolType, props } = normalizeSymbolProps(
    typeof rawProps.type === 'string' ? rawProps.type : 'symbol',
    rawProps
  );
  const hash = stableStringify({ symbolType, lat, lng, props });
  return { featureId, symbolType, lat, lng, props, hash };
};

export const buildSitacSnapshotMap = (collection: SITACCollection) => {
  const next = new Map<string, SitacStateSnapshot>();
  const features = Array.isArray(collection?.features) ? collection.features : [];
  features.forEach((feature) => {
    const snapshot = buildSitacSnapshot(feature);
    if (snapshot) next.set(snapshot.featureId, snapshot);
  });
  return next;
};

const diffSitacState = (
  currentMap: Map<string, SitacStateSnapshot>,
  previousMap: Map<string, SitacStateSnapshot>
): SitacSyncDiff => {
  const added: SitacStateSnapshot[] = [];
  const updated: SitacStateSnapshot[] = [];
  const removed: SitacStateSnapshot[] = [];

  currentMap.forEach((snapshot, id) => {
    const previous = previousMap.get(id);
    if (!previous) {
      added.push(snapshot);
      return;
    }
    if (previous.hash !== snapshot.hash) {
      updated.push(snapshot);
    }
  });

  previousMap.forEach((snapshot, id) => {
    if (!currentMap.has(id)) {
      removed.push(snapshot);
    }
  });

  return { added, updated, removed, nextMap: currentMap };
};

export const loadSitacCollection = async (interventionId: string): Promise<SITACCollection> => {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('sitac_features')
    .select('feature_id, symbol_type, lat, lng, props')
    .eq('intervention_id', interventionId);
  if (error) throw error;
  return {
    type: 'FeatureCollection',
    features: (data ?? []).map((row) => mapSitacRowToFeature(row as SitacFeatureRow))
  };
};

export const syncSitacCollection = async ({
  interventionId,
  collection,
  previousMap
}: {
  interventionId: string;
  collection: SITACCollection;
  previousMap: Map<string, SitacStateSnapshot>;
}): Promise<SitacSyncDiff> => {
  const supabase = requireSupabaseClient();
  const currentMap = buildSitacSnapshotMap(collection);
  const diff = diffSitacState(currentMap, previousMap);
  if (!diff.added.length && !diff.updated.length && !diff.removed.length) {
    return diff;
  }

  const userId = await getAuthenticatedUserId();
  const upsertRows = [...diff.added, ...diff.updated].map((snapshot) => ({
    intervention_id: interventionId,
    feature_id: snapshot.featureId,
    symbol_type: snapshot.symbolType,
    lat: snapshot.lat,
    lng: snapshot.lng,
    props: snapshot.props,
    updated_by: userId
  }));

  if (upsertRows.length) {
    const { error } = await supabase
      .from('sitac_features')
      .upsert(upsertRows, { onConflict: 'intervention_id,feature_id' });
    if (error) throw error;
  }

  if (diff.removed.length) {
    const removedIds = diff.removed.map((snapshot) => snapshot.featureId);
    const { error } = await supabase
      .from('sitac_features')
      .delete()
      .eq('intervention_id', interventionId)
      .in('feature_id', removedIds);
    if (error) throw error;
  }

  return diff;
};
