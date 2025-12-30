import { create } from 'zustand';
import type { SITACCollection, SITACFeature, DrawingMode, Snapshot, SITACFeatureProperties } from '../types/sitac';
import { createId } from '../utils/sitacUtils';

interface SitacState {
    mode: DrawingMode;
    drawingColor: string;
    lineStyle: 'solid' | 'dashed' | 'dot-dash';
    geoJSON: SITACCollection;
    history: SITACCollection[];
    redo: SITACCollection[];
    selectedFeatureId: string | null;
    snapshots: Snapshot[];
    locked: boolean;
    externalSearchQuery: string;
    externalSearchId: number;
    hydrationId: number;

    // Actions
    setMode: (mode: DrawingMode) => void;
    setColor: (color: string) => void;
    setLineStyle: (style: 'solid' | 'dashed' | 'dot-dash') => void;
    setSelectedFeatureId: (id: string | null) => void;
    setGeoJSON: (fc: SITACCollection, pushHistory?: boolean) => void;
    setFromHydration: (fc: SITACCollection) => void;
    addFeature: (feature: SITACFeature) => void;
    updateFeature: (id: string, updater: (feature: SITACFeature) => SITACFeature) => void;
    deleteFeature: (id: string) => void;
    duplicateFeature: (id: string) => void;
    undo: () => void;
    redoAction: () => void;
    clear: () => void;
    toggleLock: () => void;
    addSnapshot: (snapshot: Snapshot) => void;
    setExternalSearch: (query: string) => void;
    reset: () => void;
    // Fabric Sync
    selectedFabricProperties: SITACFeatureProperties | null;
    fabricAction: { type: 'delete' | 'duplicate' | 'none' } | null; // Adding missing action
    setSelectedFabricProperties: (props: SITACFeatureProperties | null) => void;
    updateFabricObject: (props: Partial<SITACFeatureProperties>) => void;
    setFabricAction: (action: { type: 'delete' | 'none' } | null) => void;
}

const createEmptyFc = (): SITACCollection => ({ type: 'FeatureCollection', features: [] });
const SNAPSHOT_LIMIT = 4;

const buildBaseState = () => {
    const empty = createEmptyFc();
    return {
        mode: 'view' as DrawingMode,
        drawingColor: '#ef4444',
        lineStyle: 'solid' as const,
        geoJSON: empty,
        history: [empty],
        redo: [],
        selectedFeatureId: null,
        snapshots: [],
        locked: false,
        externalSearchQuery: '',
        externalSearchId: 0,
        selectedFabricProperties: null,
        fabricAction: null,
        hydrationId: 0,
    };
};

export const useSitacStore = create<SitacState>((set, get) => ({
    ...buildBaseState(),

    setMode: (mode) => set({ mode }),
    setColor: (color) => set({ drawingColor: color }),
    setLineStyle: (style) => set({ lineStyle: style }),
    setSelectedFeatureId: (id) => set({ selectedFeatureId: id }),

    setGeoJSON: (fc, pushHistory = true) => {
        const next = JSON.parse(JSON.stringify(fc)) as SITACCollection;
        const { history } = get();
        // Keep max 50 history states
        const newHistory = pushHistory ? [...history, next].slice(-50) : history;
        set({ geoJSON: next, history: newHistory, redo: [] });
    },

    setFromHydration: (fc) => {
        const next = JSON.parse(JSON.stringify(fc)) as SITACCollection;
        set((state) => ({
            geoJSON: next,
            history: [next],
            redo: [],
            selectedFeatureId: null,
            hydrationId: state.hydrationId + 1
        }));
    },

    addFeature: (feature) => {
        const { geoJSON, history } = get();
        const next: SITACCollection = { ...geoJSON, features: [...geoJSON.features, feature] };
        set({
            geoJSON: next,
            history: [...history, next].slice(-50),
            redo: [],
            selectedFeatureId: String(feature.id),
        });
    },

    updateFeature: (id, updater) => {
        const { geoJSON, history } = get();
        let changed = false;
        const nextFeatures = geoJSON.features.map((feat) => {
            if (feat.id === id) {
                changed = true;
                return updater(JSON.parse(JSON.stringify(feat)) as SITACFeature);
            }
            return feat;
        });

        if (!changed) return;

        const next = { ...geoJSON, features: nextFeatures };
        set({ geoJSON: next, history: [...history, next].slice(-50), redo: [] });
    },

    deleteFeature: (id) => {
        const { geoJSON, history } = get();
        const next = { ...geoJSON, features: geoJSON.features.filter((f) => f.id !== id) };
        set({
            geoJSON: next,
            history: [...history, next].slice(-50),
            redo: [],
            selectedFeatureId: null,
        });
    },

    duplicateFeature: (id) => {
        const { geoJSON, history } = get();
        const safeFeatures = Array.isArray(geoJSON.features) ? geoJSON.features : [];
        const safeHistory = Array.isArray(history) ? history : [];
        const target = safeFeatures.find((f) => f.id === id);
        if (!target) return;
        const nextId = createId();
        const clone: SITACFeature = JSON.parse(JSON.stringify(target));
        clone.id = nextId;
        clone.properties = { ...(clone.properties || {}), id: nextId };
        const next: SITACCollection = { ...geoJSON, features: [...safeFeatures, clone] };
        set({
            geoJSON: next,
            history: [...safeHistory, next].slice(-50),
            redo: [],
            selectedFeatureId: nextId,
        });
    },

    undo: () => {
        const { history, redo } = get();
        if (history.length <= 1) return;
        const current = history[history.length - 1];
        const previous = history[history.length - 2];
        set({
            geoJSON: previous,
            history: history.slice(0, -1),
            redo: [current, ...redo],
            selectedFeatureId: null,
        });
    },

    redoAction: () => {
        const { redo, history } = get();
        if (redo.length === 0) return;
        const [next, ...rest] = redo;
        set({
            geoJSON: next,
            history: [...history, next],
            redo: rest,
            selectedFeatureId: null,
        });
    },

    clear: () => {
        const empty = createEmptyFc();
        set({
            geoJSON: empty,
            history: [empty],
            redo: [],
            selectedFeatureId: null
        });
    },

    toggleLock: () => set((state) => ({ locked: !state.locked })),

    addSnapshot: (snapshot) =>
        set((state) => ({
            snapshots: [snapshot, ...state.snapshots].slice(0, SNAPSHOT_LIMIT)
        })),

    setExternalSearch: (query) =>
        set((state) => ({
            externalSearchQuery: query,
            externalSearchId: state.externalSearchId + 1
        })),

    reset: () => set((state) => ({ ...buildBaseState(), hydrationId: state.hydrationId + 1 })),

    setSelectedFabricProperties: (props) => set({ selectedFabricProperties: props }),

    updateFabricObject: (props) => set((state) => ({
        selectedFabricProperties: state.selectedFabricProperties
            ? { ...state.selectedFabricProperties, ...props }
            : null
    })),

    setFabricAction: (action) => set({ fabricAction: action }),
}));
