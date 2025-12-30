import { useRef, useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import type { MapMouseEvent } from 'maplibre-gl';
import type { Feature, Geometry } from 'geojson';
import { useSitacStore } from '../stores/useSitacStore';
import { createId } from '../utils/sitacUtils';
import type { SITACFeatureProperties, SymbolAsset } from '../types/sitac';

// Layer IDs for hit testing
const SYMBOL_LAYER_ID = 'easy-draw-symbol';
const TEXT_LAYER_ID = 'easy-draw-text';
const LINE_LAYER_ID = 'easy-draw-line';
const FILL_LAYER_ID = 'easy-draw-fill';

type DrawParams = {
    map: maplibregl.Map | null;
    activeSymbol: SymbolAsset | null;
    interactionLock?: boolean;
};

export const useSitacDraw = ({ map, activeSymbol, interactionLock = false }: DrawParams) => {
    // Access store via refs to avoid re-binding listeners
    const mode = useSitacStore((s) => s.mode);
    const drawingColor = useSitacStore((s) => s.drawingColor);
    const lineStyle = useSitacStore((s) => s.lineStyle);
    const locked = useSitacStore((s) => s.locked);

    // Actions
    const addFeature = useSitacStore((s) => s.addFeature);
    const deleteFeature = useSitacStore((s) => s.deleteFeature);
    const setSelectedFeatureId = useSitacStore((s) => s.setSelectedFeatureId);
    const setMode = useSitacStore((s) => s.setMode);

    // Refs for state inside event handlers
    const stateRef = useRef({
        mode,
        drawingColor,
        lineStyle,
        locked,
        activeSymbol,
        addFeature,
        deleteFeature,
        setSelectedFeatureId,
        setMode,
    });

    // Keep refs updated
    useEffect(() => {
        stateRef.current = {
            mode,
            drawingColor,
            lineStyle,
            locked,
            activeSymbol,
            addFeature,
            deleteFeature,
            setSelectedFeatureId,
            setMode,
        };
    }, [mode, drawingColor, lineStyle, locked, activeSymbol, addFeature, deleteFeature, setSelectedFeatureId, setMode]);

    useEffect(() => {
        if (!map) return;

        // --- Helpers ---
        // (No helpers needed currently for simple selection logic)


        // --- Interaction Management ---
        // React to mode/lock changes immediately
        const shouldDisableInteractions =
            interactionLock ||
            locked ||
            mode.startsWith('draw_');

        if (shouldDisableInteractions) {
            // Disable immediately
            map.dragPan.disable();
            map.scrollZoom.disable();
            map.boxZoom.disable();
            map.touchZoomRotate.disable();
        } else {
            map.dragPan.enable();
            map.scrollZoom.enable();
            map.boxZoom.enable();
            map.touchZoomRotate.enable();
        }

        // --- Handlers ---

        const handleClick = (e: MapMouseEvent) => {
            if (!map.isStyleLoaded()) return;
            if (!e?.lngLat || !Number.isFinite(e.lngLat.lng) || !Number.isFinite(e.lngLat.lat)) return;
            const { mode, drawingColor, activeSymbol, addFeature, setSelectedFeatureId, setMode, deleteFeature } = stateRef.current;

            // Text placement is handled by the Fabric overlay to avoid duplicates.
            if (mode === 'draw_symbol' && activeSymbol) {
                const id = createId();
                addFeature({
                    type: 'Feature',
                    id,
                    properties: {
                        id,
                        type: 'symbol',
                        iconName: activeSymbol.id,
                        color: drawingColor,
                        strokeWidth: 3,
                        colorizable: activeSymbol.colorizable,
                        url: activeSymbol.url,
                    },
                    geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                });
                setSelectedFeatureId(id);
                setMode('select');
                return;
            }

            // Handle Selection / Deletion
            if (mode === 'erase') {
                const layers = [SYMBOL_LAYER_ID, TEXT_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID].filter((id) => map.getLayer(id));
                if (layers.length === 0) return;
                const hits = map.queryRenderedFeatures(e.point, { layers });
                const hit = hits.find((f) => f.properties?.id) as Feature<Geometry, SITACFeatureProperties> | undefined;
                if (hit?.properties?.id) {
                    deleteFeature(hit.properties.id);
                }
                return;
            }

            if (mode === 'select' || mode === 'view') {
                const layers = [SYMBOL_LAYER_ID, TEXT_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID].filter((id) => map.getLayer(id));
                if (layers.length === 0) {
                    setSelectedFeatureId(null);
                    return;
                }
                const hits = map.queryRenderedFeatures(e.point, { layers });
                const hit = hits.find((f) => f.properties?.id) as Feature<Geometry, SITACFeatureProperties> | undefined;
                setSelectedFeatureId(hit?.properties?.id ?? null);
            }
        };

        // Binding
        map.on('click', handleClick);
        // Note: We removed dblclick, mousedown, mousemove, mouseup for drawing shapes
        // because SitacDrawingCanvas now handles them overlaying the map.

        return () => {
            map.off('click', handleClick);
        };
    }, [map, mode, locked, interactionLock]); // Added mode/locked to re-run effect and update interaction state
};
