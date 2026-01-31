import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type DrawingMode =
    | 'view'
    | 'select'
    | 'draw_symbol'
    | 'draw_line'
    | 'draw_arrow'
    | 'draw_freehand'
    | 'draw_rect'
    | 'draw_circle'
    | 'draw_polygon'
    | 'draw_text'
    | 'erase';

export interface SITACFeatureProperties {
    id: string;
    type: 'symbol' | 'line' | 'arrow' | 'polygon' | 'text' | 'freehand' | 'circle' | 'rect';
    color: string;
    lineStyle?: 'solid' | 'dashed' | 'dot-dash';
    strokeWidth?: number;
    iconName?: string;
    rotation?: number;
    textContent?: string;
    textSize?: number;
    url?: string;
    radius?: number;
    width?: number;
    height?: number;
    colorizable?: boolean;
    length?: number; // used for arrow/line reconstruction
    baseZoom?: number; // zoom level at creation to adjust scaling on map zoom
}

export type SITACFeature = Feature<Geometry, SITACFeatureProperties>;
export type SITACCollection = FeatureCollection<Geometry, SITACFeatureProperties>;

export type BaseLayerKey = 'plan' | 'satellite' | 'hybrid' | 'whiteboard' | 'offline';

export type SymbolAsset = {
    id: string;
    label: string;
    url: string;
    colorizable?: boolean;
};

export type Snapshot = {
    id: string;
    center: [number, number];
    zoom: number;
};
