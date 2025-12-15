import type { StyleSpecification } from 'maplibre-gl';
import type maplibregl from 'maplibre-gl';
import type { BaseLayerKey, SymbolAsset } from '../types/sitac';

// Constants
export const DRAW_SOURCE_ID = 'easy-draw-source';
export const DRAFT_SOURCE_ID = 'easy-draw-draft';
export const LINE_LAYER_ID = 'easy-draw-line';
export const FILL_LAYER_ID = 'easy-draw-fill';
export const SYMBOL_LAYER_ID = 'easy-draw-symbol';
export const TEXT_LAYER_ID = 'easy-draw-text';
export const SELECT_LINE_LAYER_ID = 'easy-draw-select-line';
export const SELECT_POINT_LAYER_ID = 'easy-draw-select-point';
export const SELECT_POLYGON_LAYER_ID = 'easy-draw-select-polygon';
export const DRAFT_LINE_LAYER_ID = 'easy-draw-draft-line';
export const DRAFT_FILL_LAYER_ID = 'easy-draw-draft-fill';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || 'Mj3FpNheBXK65loEjjn5';
const OFFLINE_TILE_URL = import.meta.env.VITE_OFFLINE_TILE_URL || '/tiles/{z}/{x}/{y}.pbf';
const OFFLINE_SOURCE_LAYER = import.meta.env.VITE_OFFLINE_SOURCE_LAYER || 'layer0';

// Symbols loader
const symbolModules = import.meta.glob('../assets/logos/*.{svg,png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
});

export const SYMBOL_ASSETS: SymbolAsset[] = Object.entries(symbolModules).map(([path, url]) => {
    const raw = path.split('/').pop() || 'symbole';
    const label = raw.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b(\w)/g, (m) => m.toUpperCase());
    const id = raw.replace(/\.[^.]+$/, '');

    // Colorizable detection using naming convention:
    // Symbols with _NB, _bw, _noir, _black in filename = black/white, can be tinted by user
    // All others = pre-colored, should NOT be tinted (preserve original colors)
    // NOTE: _white is NOT included as existing files use it for other purposes
    const lowerName = raw.toLowerCase();
    const isBlackWhite = lowerName.includes('_nb') ||
        lowerName.includes('_bw') ||
        lowerName.includes('_noir') ||
        lowerName.includes('_black');

    return {
        id,
        label,
        url: url as string,
        colorizable: isBlackWhite
    };
});

// Styles
const WHITEBOARD_STYLE: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#ffffff' },
        },
    ],
};

const SATELLITE_STYLE: StyleSpecification = {
    version: 8,
    sources: {
        sat: {
            type: 'raster',
            tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`],
            tileSize: 256,
            attribution: '© MapTiler',
        },
    },
    layers: [
        {
            id: 'sat',
            type: 'raster',
            source: 'sat',
            minzoom: 0,
            maxzoom: 19,
        },
    ],
};

const OFFLINE_STYLE: StyleSpecification = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
        offline: {
            type: 'vector',
            tiles: [OFFLINE_TILE_URL],
            minzoom: 0,
            maxzoom: 14,
        },
    },
    layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#ffffff' } },
        {
            id: 'offline-fill',
            type: 'fill',
            source: 'offline',
            'source-layer': OFFLINE_SOURCE_LAYER,
            paint: { 'fill-color': '#e5e7eb' },
        },
        {
            id: 'offline-outline',
            type: 'line',
            source: 'offline',
            'source-layer': OFFLINE_SOURCE_LAYER,
            paint: { 'line-color': '#9ca3af', 'line-width': 0.5 },
        },
    ],
};

export const BASE_STYLES: Record<BaseLayerKey, StyleSpecification | string> = {
    plan: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
    satellite: SATELLITE_STYLE,
    whiteboard: WHITEBOARD_STYLE,
    offline: OFFLINE_STYLE,
};

export const ensureLayers = (map: maplibregl.Map) => {
    const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

    if (!map.getSource(DRAW_SOURCE_ID)) {
        map.addSource(DRAW_SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    }
    if (!map.getSource(DRAFT_SOURCE_ID)) {
        map.addSource(DRAFT_SOURCE_ID, { type: 'geojson', data: EMPTY_FC });
    }

    if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: DRAW_SOURCE_ID,
            filter: ['==', ['get', 'type'], 'polygon'],
            paint: {
                'fill-color': ['coalesce', ['get', 'color'], '#0f172a'],
                'fill-opacity': 0.5,
                'fill-outline-color': ['coalesce', ['get', 'color'], '#0f172a'],
            },
        });
    }

    if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
            id: LINE_LAYER_ID,
            type: 'line',
            source: DRAW_SOURCE_ID,
            filter: ['in', ['get', 'type'], ['literal', ['line', 'freehand', 'arrow']]],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': ['coalesce', ['get', 'color'], '#111111'],
                'line-width': ['coalesce', ['get', 'strokeWidth'], 4],
                'line-opacity': 1,
                'line-dasharray': [
                    'match',
                    ['get', 'lineStyle'],
                    'dashed',
                    ['literal', [2, 2]],
                    'dot-dash',
                    ['literal', [2, 2, 0.35, 2]],
                    ['literal', [1, 0]],
                ],
            },
            // Using beforeId to ensure selection layers are on top if needed, 
            // but usually we append them in order.
        });
    }

    if (!map.getLayer(DRAFT_FILL_LAYER_ID)) {
        map.addLayer({
            id: DRAFT_FILL_LAYER_ID,
            type: 'fill',
            source: DRAFT_SOURCE_ID,
            paint: {
                'fill-color': '#fbbf24',
                'fill-opacity': 0.2,
            },
            // Place before lines
        });
    }

    if (!map.getLayer(DRAFT_LINE_LAYER_ID)) {
        map.addLayer({
            id: DRAFT_LINE_LAYER_ID,
            type: 'line',
            source: DRAFT_SOURCE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#fbbf24', 'line-width': 3, 'line-dasharray': [0.3, 0.6] },
        });
    }
    if (!map.getLayer(SYMBOL_LAYER_ID)) {
        map.addLayer({
            id: SYMBOL_LAYER_ID,
            type: 'symbol',
            source: DRAW_SOURCE_ID,
            filter: ['==', ['get', 'type'], 'symbol'],
            layout: {
                'icon-image': ['get', 'iconName'],
                'icon-size': ['case', ['has', 'strokeWidth'], ['+', ['/', ['get', 'strokeWidth'], 12], 0.6], 0.8],
                'icon-allow-overlap': true,
                'icon-anchor': 'center',
                'icon-rotation-alignment': 'map',
                'icon-rotate': ['coalesce', ['get', 'rotation'], 0],
            },
            paint: {
                // Only tint SDF (B&W) icons; keep original pixels for colored assets
                'icon-color': [
                    'case',
                    ['boolean', ['get', 'colorizable'], false],
                    ['coalesce', ['get', 'color'], '#111111'],
                    ['literal', '#ffffff'],
                ],
                'icon-opacity': 0.95,
            },
        });
    }

    if (!map.getLayer(TEXT_LAYER_ID)) {
        map.addLayer({
            id: TEXT_LAYER_ID,
            type: 'symbol',
            source: DRAW_SOURCE_ID,
            filter: ['==', ['get', 'type'], 'text'],
            layout: {
                'text-field': ['coalesce', ['get', 'textContent'], 'Texte'],
                'text-size': ['coalesce', ['get', 'textSize'], 16],
                'text-font': ['Noto Sans Regular'],
                'text-offset': [0, 1],
                'text-anchor': 'top',
                'text-rotation-alignment': 'viewport',
            },
            paint: {
                'text-color': ['coalesce', ['get', 'color'], '#111111'],
                'text-halo-color': '#ffffff',
                'text-halo-width': 0.6,
            },
        });
    }

    if (!map.getLayer(SELECT_LINE_LAYER_ID)) {
        map.addLayer({
            id: SELECT_LINE_LAYER_ID,
            type: 'line',
            source: DRAW_SOURCE_ID,
            filter: ['==', ['get', 'id'], ''],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': '#f59e0b',
                'line-width': ['+', ['coalesce', ['get', 'strokeWidth'], 3], 2],
                'line-opacity': 0.9,
            },
        });
    }

    if (!map.getLayer(SELECT_POINT_LAYER_ID)) {
        map.addLayer({
            id: SELECT_POINT_LAYER_ID,
            type: 'circle',
            source: DRAW_SOURCE_ID,
            filter: ['all', ['==', ['get', 'id'], ''], ['==', ['geometry-type'], 'Point']],
            paint: {
                'circle-radius': 10,
                'circle-color': '#f59e0b',
                'circle-opacity': 0.35,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#f59e0b',
            },
        });
    }

    if (!map.getLayer(SELECT_POLYGON_LAYER_ID)) {
        map.addLayer({
            id: SELECT_POLYGON_LAYER_ID,
            type: 'line',
            source: DRAW_SOURCE_ID,
            filter: ['all', ['==', ['get', 'id'], ''], ['==', ['geometry-type'], 'Polygon']],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
                'line-color': '#f59e0b',
                'line-width': 3,
                'line-dasharray': [1, 1],
                'line-opacity': 0.9,
            },
        });
    }
};

export const setSelectionFilter = (map: maplibregl.Map, featureId: string | null) => {
    const idFilter = featureId ? (['==', ['get', 'id'], featureId] as any) : (['==', ['get', 'id'], ''] as any);

    if (map.getLayer(SELECT_LINE_LAYER_ID)) map.setFilter(SELECT_LINE_LAYER_ID, idFilter);

    if (map.getLayer(SELECT_POINT_LAYER_ID)) {
        map.setFilter(
            SELECT_POINT_LAYER_ID,
            featureId
                ? ([
                    'all',
                    ['==', ['get', 'id'], featureId],
                    ['==', ['geometry-type'], 'Point'],
                ] as any)
                : (['==', ['get', 'id'], ''] as any),
        );
    }

    if (map.getLayer(SELECT_POLYGON_LAYER_ID)) {
        map.setFilter(
            SELECT_POLYGON_LAYER_ID,
            featureId
                ? ([
                    'all',
                    ['==', ['get', 'id'], featureId],
                    ['==', ['geometry-type'], 'Polygon'],
                ] as any)
                : (['==', ['get', 'id'], ''] as any),
        );
    }
};

// --- SDF Helpers ---

export const loadImageElement = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        if (src.startsWith('http')) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = src;
    });

const computeSdfFromMask = (mask: Uint8ClampedArray, width: number, height: number, radius = 8) => {
    const size = width * height;
    const inside = new Uint8Array(size);
    for (let i = 0; i < size; i += 1) inside[i] = mask[i] > 0 ? 1 : 0;

    const distanceTransform = (targetValue: 0 | 1) => {
        const dist = new Float32Array(size).fill(Number.POSITIVE_INFINITY);
        const queue: number[] = [];
        const isBoundary = (idx: number) => {
            const x = idx % width;
            const y = Math.floor(idx / width);
            const current = inside[idx];
            if (current !== targetValue) return false;
            const neighbors: Array<[number, number]> = [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
            ];
            return neighbors.some(([nx, ny]) => {
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
                const nIdx = ny * width + nx;
                return inside[nIdx] !== current;
            });
        };

        for (let i = 0; i < size; i += 1) {
            if (isBoundary(i)) {
                dist[i] = 0;
                queue.push(i);
            }
        }

        const offsets = [-1, 1, -width, width];
        while (queue.length) {
            const idx = queue.shift()!;
            const currentDist = dist[idx];
            const cx = idx % width;
            const cy = Math.floor(idx / width);
            for (const offset of offsets) {
                const nIdx = idx + offset;
                if (nIdx < 0 || nIdx >= size) continue;
                const nx = nIdx % width;
                const ny = Math.floor(nIdx / width);
                if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
                if (inside[nIdx] !== targetValue) continue;
                const nextDist = currentDist + 1;
                if (nextDist < dist[nIdx]) {
                    dist[nIdx] = nextDist;
                    queue.push(nIdx);
                }
            }
        }
        return dist;
    };

    const insideDist = distanceTransform(1);
    const outsideDist = distanceTransform(0);
    const scale = 128 / Math.max(1, radius);
    const data = new Uint8ClampedArray(size * 4);

    for (let i = 0; i < size; i += 1) {
        const signed = inside[i] ? insideDist[i] : -outsideDist[i];
        const value = Math.max(0, Math.min(255, 128 + signed * scale));
        const offset = i * 4;
        data[offset] = 255;
        data[offset + 1] = 255;
        data[offset + 2] = 255;
        data[offset + 3] = value;
    }

    return { width, height, data };
};

export const buildSdfImageData = async (url: string) => {
    const img = await loadImageElement(url);
    const width = img.naturalWidth || 128;
    const height = img.naturalHeight || 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const mask = ctx.getImageData(0, 0, width, height).data;
    const alpha = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i += 1) {
        alpha[i] = mask[i * 4 + 3];
    }
    return computeSdfFromMask(alpha, width, height, 12);
};
