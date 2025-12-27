import * as fabric from 'fabric';
import type maplibregl from 'maplibre-gl';

export interface FabricGeoObject extends fabric.Object {
    geoPosition?: { lng: number; lat: number };
    baseZoom?: number;
    baseScaleX?: number;
    baseScaleY?: number;
}

/**
 * Syncs the position of a Fabric object based on its stored geoPosition and the current map view.
 */
export const syncObjectPosition = (obj: FabricGeoObject, map: maplibregl.Map) => {
    if (!obj.geoPosition) return;
    const { lng, lat } = obj.geoPosition;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const point = map.project([lng, lat]);

    const currentZoom = map.getZoom();
    const baseZoom = obj.baseZoom ?? currentZoom;
    if (obj.baseZoom === undefined) {
        obj.baseZoom = baseZoom;
    }

    const zoomDelta = currentZoom - baseZoom;
    const zoomScale = Math.pow(2, zoomDelta); // keep object size proportional to map zoom
    const baseScaleX = obj.baseScaleX ?? obj.scaleX ?? 1;
    const baseScaleY = obj.baseScaleY ?? obj.scaleY ?? 1;
    if (obj.baseScaleX === undefined) {
        obj.baseScaleX = baseScaleX;
    }
    if (obj.baseScaleY === undefined) {
        obj.baseScaleY = baseScaleY;
    }
    obj.set({
        scaleX: baseScaleX * zoomScale,
        scaleY: baseScaleY * zoomScale,
    });
    obj.setPositionByOrigin(new fabric.Point(point.x, point.y), 'center', 'center');
    obj.setCoords();
};

/**
 * Refreshes the object's stored geo position and base transform values.
 */
export const refreshGeoTransform = (obj: FabricGeoObject, map: maplibregl.Map) => {
    const center = obj.getCenterPoint();
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) return;
    const lngLat = toLngLat(center.x, center.y, map);
    if (!Number.isFinite(lngLat.lng) || !Number.isFinite(lngLat.lat)) return;
    obj.geoPosition = { lng: lngLat.lng, lat: lngLat.lat };
    obj.baseZoom = map.getZoom();
    obj.baseScaleX = obj.scaleX ?? obj.baseScaleX ?? 1;
    obj.baseScaleY = obj.scaleY ?? obj.baseScaleY ?? 1;
};

/**
 * Converts a screen point (Fabric canvas coords) to LngLat using the map.
 */
export const toLngLat = (x: number, y: number, map: maplibregl.Map) => {
    return map.unproject([x, y]);
};

/**
 * Converts LngLat to a screen point.
 */
export const toPoint = (lng: number, lat: number, map: maplibregl.Map) => {
    return map.project([lng, lat]);
};
