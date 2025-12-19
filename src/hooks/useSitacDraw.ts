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
};

export const useSitacDraw = ({ map, activeSymbol }: DrawParams) => {
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

        // --- Interaction Management ---
        // React to mode/lock changes immediately
        const shouldDisableInteractions =
            locked ||
            ['draw_freehand', 'draw_rect', 'draw_circle', 'draw_line', 'draw_arrow'].includes(mode);

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

        // We use 'any' for event data to avoid the strict typing issues with maplibre-gl EventData which is sometimes not exported correctly or clashes
        const handleClick = (e: MapMouseEvent & any) => {
            if (!map.isStyleLoaded()) return;
            const { mode, drawingColor, activeSymbol, addFeature, setSelectedFeatureId, setMode, deleteFeature } = stateRef.current;

            // Handle Text and Symbol placement (still point-based, so map click is fine)
            if (mode === 'draw_text') {
                const id = createId();
                addFeature({
                    type: 'Feature',
                    id,
                    properties: {
                        id,
                        type: 'text',
                        textContent: 'Texte',
                        textSize: 16,
                        color: drawingColor,
                    },
                    geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                });
                setSelectedFeatureId(id);
                setMode('select');
                return;
            }

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
                const hits = map.queryRenderedFeatures(e.point, { layers: [SYMBOL_LAYER_ID, TEXT_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID] });
                const hit = hits.find((f) => f.properties?.id) as Feature<Geometry, SITACFeatureProperties> | undefined;
                if (hit?.properties?.id) {
                    deleteFeature(hit.properties.id);
                }
                return;
            }

            if (mode === 'select' || mode === 'view') {
                const hits = map.queryRenderedFeatures(e.point, { layers: [SYMBOL_LAYER_ID, TEXT_LAYER_ID, LINE_LAYER_ID, FILL_LAYER_ID] });
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
    }, [map, mode, locked]); // Added mode/locked to re-run effect and update interaction state
};
