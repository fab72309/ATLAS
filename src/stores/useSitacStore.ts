import { create } from 'zustand';
import type { SITACCollection, SITACFeature, DrawingMode, Snapshot, SITACFeatureProperties } from '../types/sitac';

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

    // Actions
    setMode: (mode: DrawingMode) => void;
    setColor: (color: string) => void;
    setLineStyle: (style: 'solid' | 'dashed' | 'dot-dash') => void;
    setSelectedFeatureId: (id: string | null) => void;
    setGeoJSON: (fc: SITACCollection, pushHistory?: boolean) => void;
    addFeature: (feature: SITACFeature) => void;
    updateFeature: (id: string, updater: (feature: SITACFeature) => SITACFeature) => void;
    deleteFeature: (id: string) => void;
    undo: () => void;
    redoAction: () => void;
    clear: () => void;
    toggleLock: () => void;
    addSnapshot: (snapshot: Snapshot) => void;
    // Fabric Sync
    selectedFabricProperties: SITACFeatureProperties | null;
    fabricAction: { type: 'delete' | 'none' } | null; // Adding missing action
    setSelectedFabricProperties: (props: SITACFeatureProperties | null) => void;
    updateFabricObject: (props: Partial<SITACFeatureProperties>) => void;
    setFabricAction: (action: { type: 'delete' | 'none' } | null) => void;
}

const EMPTY_FC: SITACCollection = { type: 'FeatureCollection', features: [] };
const SNAPSHOT_LIMIT = 4;

export const useSitacStore = create<SitacState>((set, get) => ({
    mode: 'view',
    drawingColor: '#111111', // Default black/dark
    lineStyle: 'solid',
    geoJSON: EMPTY_FC,
    history: [EMPTY_FC],
    redo: [],
    selectedFeatureId: null,
    snapshots: [],
    locked: false,

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

    clear: () => set({
        geoJSON: EMPTY_FC,
        history: [EMPTY_FC],
        redo: [],
        selectedFeatureId: null
    }),

    toggleLock: () => set((state) => ({ locked: !state.locked })),

    addSnapshot: (snapshot) =>
        set((state) => ({
            snapshots: [snapshot, ...state.snapshots].slice(0, SNAPSHOT_LIMIT)
        })),

    selectedFabricProperties: null,
    fabricAction: null,

    setSelectedFabricProperties: (props) => set({ selectedFabricProperties: props }),

    updateFabricObject: (props) => set((state) => ({
        selectedFabricProperties: state.selectedFabricProperties
            ? { ...state.selectedFabricProperties, ...props }
            : null
    })),

    setFabricAction: (action) => set({ fabricAction: action }),
}));
