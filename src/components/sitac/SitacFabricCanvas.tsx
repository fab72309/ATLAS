import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import type maplibregl from 'maplibre-gl';
import { useSitacStore } from '../../stores/useSitacStore';
import { refreshGeoTransform, syncObjectPosition, type FabricGeoObject, toLngLat } from '../../utils/fabricUtils';
import type { SymbolAsset } from '../../types/sitac';

interface SitacFabricCanvasProps {
    map: maplibregl.Map | null;
    width: number;
    height: number;
    activeSymbol: SymbolAsset | null;
}

const isMonochromeElement = (imgEl: HTMLImageElement) => {
    const maxSize = 64;
    const scale = Math.min(maxSize / (imgEl.naturalWidth || maxSize), maxSize / (imgEl.naturalHeight || maxSize), 1);
    const width = Math.max(1, Math.round((imgEl.naturalWidth || maxSize) * scale));
    const height = Math.max(1, Math.round((imgEl.naturalHeight || maxSize) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(imgEl, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 10) continue;
        if (Math.abs(r - g) > 12 || Math.abs(r - b) > 12 || Math.abs(g - b) > 12) {
            return false;
        }
    }
    return true;
};

const flagIfMonochrome = (img: fabric.FabricImage) => {
    const element = (img as any).getElement ? (img as any).getElement() : (img as any)._element;
    if (!element) return (img as any).colorizable === true;
    if ((img as any).colorizable === true) return true;
    const isMono = isMonochromeElement(element);
    if (isMono) {
        (img as any).colorizable = true;
    }
    return (img as any).colorizable === true;
};

const setBaseTransform = (obj: fabric.Object, map: maplibregl.Map | null) => {
    if (!map) return;
    (obj as any).baseZoom = (obj as any).baseZoom ?? map.getZoom();
    (obj as any).baseScaleX = (obj as any).baseScaleX ?? obj.scaleX ?? 1;
    (obj as any).baseScaleY = (obj as any).baseScaleY ?? obj.scaleY ?? 1;
};

const SitacFabricCanvas: React.FC<SitacFabricCanvasProps> = ({ map, width, height, activeSymbol }) => {
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const fabricCanvas = useRef<fabric.Canvas | null>(null);
    const syncingFromFabric = useRef(false);
    const syncingFromStore = useRef(false);

    // Store
    const mode = useSitacStore((s) => s.mode);
    const drawingColor = useSitacStore((s) => s.drawingColor);
    const lineStyle = useSitacStore((s) => s.lineStyle); // 'solid' | 'dashed' | 'dot-dash'
    const setMode = useSitacStore((s) => s.setMode);
    const locked = useSitacStore((s) => s.locked);

    const isLoaded = useRef(false);
    const geoJSON = useSitacStore((s) => s.geoJSON);

    const rebuildFromGeoJSON = React.useCallback((data) => {
        const canvas = fabricCanvas.current;
        if (!canvas || !map) return;

        syncingFromStore.current = true;
        canvas.clear();

        const pending: Promise<void>[] = [];

        data.features.forEach((feat: any) => {
            const { geometry, properties } = feat;
            if (geometry.type !== 'Point') return; // Only Points for now

            const [lng, lat] = (geometry as any).coordinates;
            const point = map.project([lng, lat]);

            let obj: any;

            if (properties.type === 'text') {
                obj = new fabric.IText(properties.textContent || 'Texte', {
                    left: point.x, top: point.y,
                    fill: properties.color,
                    fontSize: 20, fontFamily: 'Arial'
                });
                (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
            } else if (properties.type === 'symbol' && properties.url) {
                const imgUrl = properties.url;
                const p = (async () => {
                    try {
                        const img = await fabric.FabricImage.fromURL(imgUrl, {
                            crossOrigin: 'anonymous',
                        });

                        img.set({
                            left: point.x,
                            top: point.y,
                            originX: 'center',
                            originY: 'center',
                        });
                        img.scaleToWidth(50);
                        const geoPos = { lng, lat };
                        (img as FabricGeoObject).geoPosition = geoPos;
                        (img as any).baseZoom = properties.baseZoom ?? map.getZoom();
                        setBaseTransform(img, map);

                    (img as any).colorizable = properties.colorizable;
                    (img as any).iconName = properties.iconName;

                        flagIfMonochrome(img);

                        if (properties.color && properties.colorizable === true) {
                            const filter = new fabric.filters.BlendColor({
                                color: properties.color,
                                mode: 'tint',
                                alpha: 1
                            });
                            img.filters = [filter];
                            img.applyFilters();
                        } else {
                            img.filters = [];
                        }

                        canvas.add(img);
                        canvas.renderAll();
                    } catch (err) {
                        console.error('Failed to rehydrate symbol:', imgUrl, err);
                    }
                })();
                pending.push(p);
                return;
            } else if (properties.type === 'circle') {
                obj = new fabric.Circle({
                    left: point.x, top: point.y,
                    radius: properties.radius || 20,
                    originX: 'center', originY: 'center',
                    fill: properties.color + '40' || '#3b82f640',
                    stroke: properties.color || '#3b82f6',
                    strokeWidth: properties.strokeWidth || 2
                });
                (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                setBaseTransform(obj, map);
            } else if (properties.type === 'polygon' || properties.type === 'rect') {
                if (properties.points && Array.isArray(properties.points)) {
                    obj = new fabric.Polygon(properties.points, {
                        left: point.x,
                        top: point.y,
                        originX: 'center',
                        originY: 'center',
                        fill: properties.color + '40' || '#3b82f640',
                        stroke: properties.color || '#3b82f6',
                        strokeWidth: properties.strokeWidth || 2,
                        objectCaching: false,
                        angle: properties.rotation || 0,
                    });
                    (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                } else {
                    obj = new fabric.Rect({
                        left: point.x, top: point.y,
                        width: properties.width || 50,
                        height: properties.height || 50,
                        fill: properties.color + '40' || '#3b82f640',
                        stroke: properties.color || '#3b82f6',
                        strokeWidth: properties.strokeWidth || 2,
                        angle: properties.rotation || 0,
                    });
                    (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                }
                setBaseTransform(obj, map);
            } else if (properties.type === 'line') {
                const length = properties.length || properties.width || 80;
                obj = new fabric.Line([-length / 2, 0, length / 2, 0], {
                    left: point.x,
                    top: point.y,
                    originX: 'center',
                    originY: 'center',
                    stroke: properties.color || '#3b82f6',
                    strokeWidth: properties.strokeWidth || 4,
                    strokeLineCap: 'round',
                    angle: properties.rotation || 0,
                });
                (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                setBaseTransform(obj, map);
            } else if (properties.type === 'arrow') {
                const length = properties.length || properties.width || 80;
                const baseLine = new fabric.Line([-length / 2, 0, length / 2, 0], {
                    originX: 'center',
                    originY: 'center',
                    stroke: properties.color || '#3b82f6',
                    strokeWidth: properties.strokeWidth || 4,
                    strokeLineCap: 'round',
                });
                const head = new fabric.Triangle({
                    width: 14,
                    height: 16,
                    fill: properties.color || '#3b82f6',
                    originX: 'center',
                    originY: 'center',
                    left: length / 2,
                    top: 0,
                    angle: 90,
                });
                obj = new fabric.Group([baseLine, head], {
                    left: point.x,
                    top: point.y,
                    angle: properties.rotation || 0,
                    objectCaching: false,
                });
                (obj as any).isArrow = true;
                (obj as any).strokeColor = properties.color || '#3b82f6';
                (obj as any).arrowLength = length;
                (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                setBaseTransform(obj, map);
            } else if (properties.type === 'freehand' && properties.path) {
                obj = new fabric.Path(properties.path, {
                    left: point.x,
                    top: point.y,
                    originX: 'center',
                    originY: 'center',
                    fill: 'transparent',
                    stroke: properties.color || '#3b82f6',
                    strokeWidth: properties.strokeWidth || 4,
                    strokeLineCap: 'round',
                    strokeLineJoin: 'round',
                    objectCaching: false,
                });
                if (properties.scaleX) obj.set({ scaleX: properties.scaleX });
                if (properties.scaleY) obj.set({ scaleY: properties.scaleY });
                (obj as any).baseZoom = properties.baseZoom ?? map.getZoom();
                setBaseTransform(obj, map);
            }

            if (obj) {
                (obj as FabricGeoObject).geoPosition = { lng, lat };
                canvas.add(obj);
            }
        });

        canvas.renderAll();
        if (pending.length > 0) {
            Promise.all(pending).finally(() => {
                syncingFromStore.current = false;
                canvas.renderAll();
            });
        } else {
            syncingFromStore.current = false;
        }
    }, [map]);

    // Initialize Fabric & Rehydrate
    useEffect(() => {
        if (!canvasEl.current || !map || isLoaded.current) return;

        console.log('Initializing Fabric Canvas & Rehydrating');
        const canvas = new fabric.Canvas(canvasEl.current, {
            width,
            height,
            selection: true,
            preserveObjectStacking: true,
        });

        fabricCanvas.current = canvas;

        // Customize Selection Styles
        fabric.Object.prototype.set({
            transparentCorners: false,
            cornerColor: '#3b82f6', // Bright Blue
            cornerStrokeColor: '#ffffff',
            borderColor: '#3b82f6',
            cornerSize: 10,
            padding: 8,
            cornerStyle: 'circle',
            borderScaleFactor: 2,
            borderDashArray: [4, 4],
        });

        // Rehydrate from Store
        const savedData = useSitacStore.getState().geoJSON;
        if (savedData && savedData.features.length > 0) {
            rebuildFromGeoJSON(savedData);
        }

        isLoaded.current = true;

        // Handle Path Creation (Triggered by freehand)
        canvas.on('path:created', (e: any) => {
            const path = e.path as FabricGeoObject;
            if (!map) return;
            const center = path.getCenterPoint();
                    const lngLat = toLngLat(center.x, center.y, map);
                    path.geoPosition = { lng: lngLat.lng, lat: lngLat.lat };

            setBaseTransform(path, map);

            // Trigger persistence
            canvas.fire('object:modified', { target: path });
        });

        return () => {
            console.log('Disposing Fabric Canvas');
            canvas.dispose();
            fabricCanvas.current = null;
            isLoaded.current = false;
        };
    }, [map, rebuildFromGeoJSON]); // Depend on map to ensure projection works (re-init on map load)

    // Handle Resize
    useEffect(() => {
        if (fabricCanvas.current) {
            fabricCanvas.current.setDimensions({ width, height });
        }
    }, [width, height]);

    // React to store changes (undo/redo) -> rebuild canvas
    useEffect(() => {
        if (!fabricCanvas.current || !map) return;
        if (syncingFromFabric.current) return;
        rebuildFromGeoJSON(geoJSON);
    }, [geoJSON, map, rebuildFromGeoJSON]);

    // Auto-Lock Map when entering drawing mode
    useEffect(() => {
        if (mode.startsWith('draw_')) {
            useSitacStore.setState({ locked: true });
        }
    }, [mode]);

    // Handle Mode Changes & Drawing Logic
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        // Default: Reset
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.forEachObject(o => o.selectable = true);

        // Clean up previous listeners
        canvas.off('mouse:down');
        canvas.off('mouse:move');
        canvas.off('mouse:up');

        if (mode === 'draw_freehand') {
            canvas.isDrawingMode = true;
            canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
            canvas.freeDrawingBrush.color = drawingColor;
            canvas.freeDrawingBrush.width = 4;
            canvas.selection = false;
        } else if (mode === 'select') {
            // Fabric default selection
        } else if (mode === 'draw_polygon') {
            canvas.selection = false;
            canvas.defaultCursor = 'crosshair';
            canvas.forEachObject(o => o.selectable = false);

            let points: { x: number; y: number }[] = [];
            let lines: fabric.Line[] = [];
            let activeLine: fabric.Line | null = null;

            canvas.on('mouse:down', (options) => {
                const pointer = canvas.getPointer(options.e);
                points.push({ x: pointer.x, y: pointer.y });

                // Add point marker
                const point = new fabric.Circle({
                    left: pointer.x, top: pointer.y,
                    radius: 3, fill: drawingColor,
                    originX: 'center', originY: 'center',
                    selectable: false, evented: false
                });
                canvas.add(point);

                if (points.length > 1) {
                    // Finalize the previous line segment
                    const lastPoint = points[points.length - 2];
                    const line = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
                        stroke: drawingColor, strokeWidth: 2, selectable: false, evented: false
                    });
                    lines.push(line);
                    canvas.add(line);
                }

                // Check for closure (click near start)
                if (points.length > 2) {
                    const dx = pointer.x - points[0].x;
                    const dy = pointer.y - points[0].y;
                    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                        finishPolygon();
                    }
                }
            });

            canvas.on('mouse:move', (options) => {
                if (points.length === 0) return;
                const pointer = canvas.getPointer(options.e);
                const lastPoint = points[points.length - 1];

                if (activeLine) {
                    canvas.remove(activeLine);
                }

                activeLine = new fabric.Line([lastPoint.x, lastPoint.y, pointer.x, pointer.y], {
                    stroke: drawingColor, strokeWidth: 2, strokeDashArray: [5, 5], selectable: false, evented: false, opacity: 0.7
                });
                canvas.add(activeLine);
                canvas.requestRenderAll();
            });

            canvas.on('mouse:dblclick', () => {
                if (points.length > 2) finishPolygon();
            });

            const finishPolygon = () => {
                // Remove temp UI
                canvas.getObjects().forEach(o => {
                    if (!o.selectable && (o.type === 'line' || o.type === 'circle')) {
                        canvas.remove(o);
                    }
                });

                // Create Polygon
                // Fabric Polygon takes array of {x, y}
                // Need to ensure closed? Fabric handles it.
                // We remove the last point if it was the "closing click" (duplicate of first)
                // Actually if we clicked exactly on start, points includes it.
                // Let's uniquely filter points if needed, but Fabric is robust.

                const polygon = new fabric.Polygon(points, {
                    fill: 'transparent',
                    stroke: drawingColor,
                    strokeWidth: 2,
                    objectCaching: false
                });

                if (map) {
                    // Georeference CENTER of Polygon
                    // Note: Fabric Polygon center might shift if we set origin.
                    // Better strategy: Store LatLngs for ALL points?
                    // Simple approach for now: Center Georef.
                    const center = polygon.getCenterPoint();
                    const lngLat = toLngLat(center.x, center.y, map);
                    (polygon as FabricGeoObject).geoPosition = { lng: lngLat.lng, lat: lngLat.lat };
                    setBaseTransform(polygon, map);
                }

                canvas.add(polygon);
                canvas.setActiveObject(polygon);
                canvas.fire('object:modified', { target: polygon });
                setMode('select');
            };

        } else if (['draw_line', 'draw_rect', 'draw_circle', 'draw_arrow'].includes(mode)) {
            canvas.selection = false;
            canvas.forEachObject(o => o.selectable = false);
            canvas.defaultCursor = 'crosshair';

            let isDown = false;
            let startPoint: { x: number; y: number } | null = null;
            let activeObj: fabric.Object | null = null;
            let arrowHead: fabric.Triangle | null = null;
            const strokeWidth = 4;

            canvas.on('mouse:down', (o) => {
                isDown = true;
                const pointer = canvas.getPointer(o.e);
                startPoint = { x: pointer.x, y: pointer.y };

                if (mode === 'draw_line') {
                    activeObj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                        stroke: drawingColor,
                        strokeWidth,
                        strokeLineCap: 'round'
                    });
                    if (map) setBaseTransform(activeObj, map);
                } else if (mode === 'draw_arrow') {
                    activeObj = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
                        stroke: drawingColor,
                        strokeWidth,
                        strokeLineCap: 'round',
                        selectable: false,
                        evented: false,
                    });
                    arrowHead = new fabric.Triangle({
                        width: 14,
                        height: 16,
                        fill: drawingColor,
                        originX: 'center',
                        originY: 'center',
                        left: pointer.x,
                        top: pointer.y,
                        selectable: false,
                        evented: false,
                    });
                    canvas.add(activeObj);
                    if (arrowHead) canvas.add(arrowHead);
                    return;
                } else if (mode === 'draw_rect') {
                    activeObj = new fabric.Rect({
                        left: pointer.x, top: pointer.y,
                        width: 0, height: 0,
                        fill: 'transparent',
                        stroke: drawingColor, strokeWidth: 2,
                    });
                    if (map) setBaseTransform(activeObj, map);
                } else if (mode === 'draw_circle') {
                    activeObj = new fabric.Circle({
                        left: pointer.x, top: pointer.y,
                        radius: 0, originX: 'center', originY: 'center',
                        fill: drawingColor + '40',
                        stroke: drawingColor, strokeWidth: 2
                    });
                    if (map) setBaseTransform(activeObj, map);
                }

                if (activeObj) canvas.add(activeObj);
            });

            canvas.on('mouse:move', (o) => {
                if (!isDown || !activeObj || !startPoint) return;
                const pointer = canvas.getPointer(o.e);

                if (mode === 'draw_line') {
                    (activeObj as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
                } else if (mode === 'draw_rect') {
                    const width = pointer.x - startPoint.x;
                    const height = pointer.y - startPoint.y;
                    (activeObj as fabric.Rect).set({ width: Math.abs(width), height: Math.abs(height) });
                    if (width < 0) activeObj.set({ left: pointer.x });
                    if (height < 0) activeObj.set({ top: pointer.y });
                } else if (mode === 'draw_circle') {
                    const radius = Math.sqrt(Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2));
                    (activeObj as fabric.Circle).set({ radius });
                } else if (mode === 'draw_arrow' && activeObj instanceof fabric.Line) {
                    (activeObj as fabric.Line).set({ x2: pointer.x, y2: pointer.y });
                    if (arrowHead) {
                        const dx = pointer.x - startPoint.x;
                        const dy = pointer.y - startPoint.y;
                        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
                        arrowHead.set({
                            left: pointer.x,
                            top: pointer.y,
                            angle: angleDeg + 90,
                            fill: drawingColor
                        });
                    }
                }

                canvas.requestRenderAll();
            });

            canvas.on('mouse:up', (o) => {
                isDown = false;
                if (mode === 'draw_arrow' && startPoint && activeObj instanceof fabric.Line) {
                    const pointer = canvas.getPointer(o.e);
                    const dx = pointer.x - startPoint.x;
                    const dy = pointer.y - startPoint.y;
                    const length = Math.max(10, Math.sqrt(dx * dx + dy * dy));
                    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
                    const midX = (startPoint.x + pointer.x) / 2;
                    const midY = (startPoint.y + pointer.y) / 2;

                    // Remove preview pieces
                    canvas.remove(activeObj);
                    if (arrowHead) canvas.remove(arrowHead);

                    const baseLine = new fabric.Line([-length / 2, 0, length / 2, 0], {
                        stroke: drawingColor,
                        strokeWidth,
                        strokeLineCap: 'round',
                    });
                    const head = new fabric.Triangle({
                        width: 14,
                        height: 16,
                        fill: drawingColor,
                        originX: 'center',
                        originY: 'center',
                        left: length / 2,
                        top: 0,
                        angle: 90,
                    });
                    const group = new fabric.Group([baseLine, head], {
                        left: midX,
                        top: midY,
                        angle: angleDeg,
                        objectCaching: false,
                    });
                    (group as any).isArrow = true;
                    (group as any).strokeColor = drawingColor;
                    (group as any).arrowLength = length;
                    if (map) {
                        refreshGeoTransform(group as FabricGeoObject, map);
                        setBaseTransform(group, map);
                    }
                    canvas.add(group);
                    canvas.setActiveObject(group);
                    group.setCoords();
                    canvas.fire('object:modified', { target: group });
                    setMode('select');
                } else if (activeObj && map) {
                    refreshGeoTransform(activeObj as FabricGeoObject, map);
                    setBaseTransform(activeObj, map);

                    activeObj.setCoords();
                    canvas.fire('object:modified', { target: activeObj });
                    setMode('select'); // Auto-switch back to select
                }
                activeObj = null;
                arrowHead = null;
                startPoint = null;
            });
        } else if (mode === 'draw_text') {
            canvas.selection = false;
            canvas.defaultCursor = 'text';

            canvas.on('mouse:up', (o) => {
                const pointer = canvas.getPointer(o.e);
                const text = new fabric.IText('Texte', {
                    left: pointer.x,
                    top: pointer.y,
                    fontFamily: 'Arial',
                    fill: drawingColor,
                    fontSize: 20,
                });

                if (map) {
                    const lngLat = toLngLat(pointer.x, pointer.y, map);
                    (text as FabricGeoObject).geoPosition = { lng: lngLat.lng, lat: lngLat.lat };
                    setBaseTransform(text, map);
                }

                canvas.add(text);
                canvas.setActiveObject(text);
                text.enterEditing();
                text.selectAll();
                setMode('select');
            });
        } else if (mode === 'draw_symbol') {
            canvas.selection = false;
            canvas.defaultCursor = 'copy';

            canvas.on('mouse:down', async (o) => {
                if (!activeSymbol) return;
                const pointer = canvas.getPointer(o.e);

                try {
                    // Use Fabric's built-in image loading for better transparency support
                    const img = await fabric.FabricImage.fromURL(activeSymbol.url, {
                        crossOrigin: 'anonymous',
                    });

                    img.set({
                        left: pointer.x,
                        top: pointer.y,
                        originX: 'center',
                        originY: 'center',
                    });
                    img.scaleToWidth(50);

                    if (map) {
                        const lngLat = toLngLat(pointer.x, pointer.y, map);
                        (img as FabricGeoObject).geoPosition = { lng: lngLat.lng, lat: lngLat.lat };
                        setBaseTransform(img, map);
                    }
                    // Attach metadata
                    const autoColorizable =
                        activeSymbol.colorizable === true || flagIfMonochrome(img);
                    (img as any).colorizable = autoColorizable;
                    (img as any).iconName = activeSymbol.id;

                    // Tint only B&W assets
                    if (autoColorizable === true && drawingColor) {
                        const filter = new fabric.filters.BlendColor({
                            color: drawingColor,
                            mode: 'tint',
                            alpha: 1
                        });
                        img.filters = [filter];
                        img.applyFilters();
                    } else {
                        img.filters = [];
                    }

                    canvas.add(img);
                    canvas.setActiveObject(img);
                    canvas.renderAll();
                    setMode('select');
                } catch (err) {
                    console.error('Failed to load symbol image:', activeSymbol.url, err);
                }
            });
        }
    }, [mode, drawingColor, map, activeSymbol]);

    // Handle Drop
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        const json = e.dataTransfer.getData('sitac/symbol');
        if (!json) return;

        try {
            const asset: SymbolAsset = JSON.parse(json);
            const canvas = fabricCanvas.current;
            if (!canvas) return;

            // Calculate Position relative to canvas
            const rect = canvasEl.current?.getBoundingClientRect();
            if (!rect) return;

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Use Fabric's built-in image loading for better transparency support
            const img = await fabric.FabricImage.fromURL(asset.url, {
                crossOrigin: 'anonymous',
            });

            img.set({
                left: x,
                top: y,
                originX: 'center',
                originY: 'center',
            });
            img.scaleToWidth(50);

            // Attach metadata
            const autoColorizable =
                asset.colorizable === true || flagIfMonochrome(img);
            (img as any).colorizable = autoColorizable;
            (img as any).iconName = asset.id;

            if (map) {
                const lngLat = toLngLat(x, y, map);
                (img as FabricGeoObject).geoPosition = { lng: lngLat.lng, lat: lngLat.lat };
                setBaseTransform(img, map);
            }

            // Tint only B&W assets
            if (asset.colorizable === true && drawingColor) {
                const filter = new fabric.filters.BlendColor({
                    color: drawingColor,
                    mode: 'tint',
                    alpha: 1
                });
                img.filters = [filter];
                img.applyFilters();
            } else {
                img.filters = [];
            }

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            setMode('select');

        } catch (err) {
            console.error('Drop error', err);
        }
    };

    // Handle Selection Events to Update Store
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        const updateSelection = () => {
            const active = canvas.getActiveObject();
            if (active) {
                // Determine type
                let type: any = 'forme';
                if (active instanceof fabric.IText) type = 'text';
                else if (active instanceof fabric.Path) type = 'freehand';
                else if (active instanceof fabric.Line) type = 'line';
                else if (active instanceof fabric.Group && (active as any).isArrow) type = 'arrow';
                else if (active instanceof fabric.Rect) type = 'rect'; // Updated from polygon
                else if (active instanceof fabric.Circle) type = 'circle';
                else if (active instanceof fabric.Image) type = 'symbol';

                // Fabric types are tricky. simpler to check visual props.
                let color = (active.fill as string) !== 'transparent' ? active.fill : active.stroke;

                // If it is an image/symbol, check filters for color
                if (active instanceof fabric.Image && active.filters) {
                    // We assume we use BlendColor for coloring symbols
                    // TypeScript might not know about specific filter structure freely, so we cast or find
                    const blendFilter: any = active.filters.find((f: any) => f.type === 'BlendColor');
                    if (blendFilter) {
                        color = blendFilter.color;
                    } else {
                        // No filter -> No color override
                        color = 'transparent'; // Or indicative
                    }
                } else if (active instanceof fabric.Group && (active as any).isArrow) {
                    const strokeColor = (active as any).strokeColor;
                    color = strokeColor || ((active._objects[0] as any)?.stroke ?? color);
                }

                // Read Dash Array for style
                let dash = active.strokeDashArray;
                if (active instanceof fabric.Group && (active as any).isArrow) {
                    const lineChild = (active as any)._objects?.find((c: any) => c instanceof fabric.Line) as fabric.Line | undefined;
                    dash = lineChild?.strokeDashArray;
                }
                let style: any = 'solid';
                if (dash && dash.length === 2) style = 'dashed';
                if (dash && dash.length === 4) style = 'dot-dash';

                useSitacStore.setState({
                    selectedFabricProperties: {
                        color: (color as string) || '#000000',
                        lineStyle: style,
                        type: type,
                        // Add more props if needed
                    }
                });
            } else {
                useSitacStore.setState({ selectedFabricProperties: null });
            }
        };



        canvas.on('selection:created', updateSelection);
        canvas.on('selection:updated', updateSelection);
        canvas.on('selection:cleared', updateSelection);

        // Persistence Logic
        const saveToStore = (evt?: fabric.IEvent) => {
            if (syncingFromStore.current) return;
            if (map && evt?.target) {
                refreshGeoTransform(evt.target as FabricGeoObject, map);
            }
            const features: any[] = [];
            canvas.getObjects().forEach((obj) => {
                const fabricObj = obj as FabricGeoObject;
                if (!fabricObj.geoPosition && map) {
                    refreshGeoTransform(fabricObj, map);
                }
                if (!fabricObj.geoPosition) return;

                let geometry: any;
                let properties: any = {
                    id: fabricObj.names?.[0] || Date.now().toString(), // Simple ID
                    // color: (obj.fill as string) !== 'transparent' ? obj.fill : obj.stroke, // Don't default indiscriminately
                    rotation: obj.angle || 0,
                    baseZoom: (obj as any).baseZoom,
                };

                // Helper to get color
                const getColor = () => {
                    if (obj instanceof fabric.Image) {
                        // Only from filter
                        if (obj.filters) {
                            const blendFilter: any = obj.filters.find((f: any) => f.type === 'BlendColor');
                            return blendFilter ? blendFilter.color : undefined;
                        }
                        return undefined;
                    }
                    return (obj.fill as string) !== 'transparent' ? obj.fill : obj.stroke;
                };

                properties.color = getColor();

                if (obj instanceof fabric.IText) {
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                    properties.type = 'text';
                    properties.textContent = (obj as fabric.IText).text;
                    properties.color = obj.fill;
                } else if (obj instanceof fabric.Image) {
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                    properties.type = 'symbol';
                    // Retrieve URL? activeSymbol logic.
                    // We need to store original URL on the object to save it. 
                    // or use obj.getSrc() if available
                    properties.url = (obj as any)._element?.src;
                    // Note: src might be dataURI if using some loaders, but here we used fromURL.
                    properties.colorizable = (obj as any).colorizable;
                    properties.iconName = (obj as any).iconName;
                } else if (obj instanceof fabric.Circle) {
                    // Circle as Point with radius property or Polygon? 
                    // Point + Radius is better for "Circle" semantics.
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                    properties.type = 'circle';
                    properties.radius = (obj as fabric.Circle).radius! * (obj.scaleX || 1);
                    properties.strokeWidth = obj.strokeWidth;
                } else if (obj instanceof fabric.Rect) {
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                    properties.type = 'polygon'; // maintain compatibility
                    properties.width = (obj as fabric.Rect).width! * (obj.scaleX || 1);
                    properties.height = (obj as fabric.Rect).height! * (obj.scaleY || 1);
                    properties.strokeWidth = obj.strokeWidth;
                } else if (obj instanceof fabric.Line) {
                    properties.type = 'line';
                    properties.strokeWidth = obj.strokeWidth;
                    properties.length = Math.sqrt(
                        Math.pow(((obj as fabric.Line).x2 || 0) - ((obj as fabric.Line).x1 || 0), 2) +
                        Math.pow(((obj as fabric.Line).y2 || 0) - ((obj as fabric.Line).y1 || 0), 2)
                    );
                    properties.color = obj.stroke;
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                } else if (obj instanceof fabric.Group && (obj as any).isArrow) {
                    const lineChild = (obj as any)._objects?.find((c: any) => c instanceof fabric.Line) as fabric.Line | undefined;
                    properties.type = 'arrow';
                    properties.strokeWidth = lineChild?.strokeWidth || 4;
                    const derivedLength = lineChild
                        ? Math.sqrt(Math.pow((lineChild.x2 || 0) - (lineChild.x1 || 0), 2) + Math.pow((lineChild.y2 || 0) - (lineChild.y1 || 0), 2))
                        : obj.width || 80;
                    properties.length = (obj as any).arrowLength ?? derivedLength;
                    properties.color = (obj as any).strokeColor || lineChild?.stroke;
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                } else if (obj instanceof fabric.Polygon) {
                    properties.type = 'polygon';
                    properties.points = (obj as fabric.Polygon).points;
                    properties.strokeWidth = obj.strokeWidth;
                    properties.color = obj.stroke;
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                } else if (obj instanceof fabric.Path) {
                    properties.type = 'freehand';
                    geometry = { type: 'Point', coordinates: [fabricObj.geoPosition.lng, fabricObj.geoPosition.lat] };
                    properties.path = (obj as fabric.Path).path;
                    properties.strokeWidth = obj.strokeWidth;
                    properties.scaleX = obj.scaleX;
                    properties.scaleY = obj.scaleY;
                    properties.color = obj.stroke;
                }

                // If we have minimal data, push.
                if (obj instanceof fabric.Object) { // Ensure generic object push
                    features.push({
                        type: 'Feature',
                        properties: properties,
                        geometry: geometry
                    });
                }
            });

            // Update Store + history (for undo/redo)
            const next = { type: 'FeatureCollection', features: features };
            const prev = useSitacStore.getState().geoJSON;
            if (JSON.stringify(prev) === JSON.stringify(next)) return;
            syncingFromFabric.current = true;
            useSitacStore.getState().setGeoJSON(next as any, true);
            setTimeout(() => {
                syncingFromFabric.current = false;
            }, 0);
        };

        canvas.on('object:modified', saveToStore);
        canvas.on('object:added', saveToStore);
        canvas.on('object:removed', saveToStore);
        canvas.on('text:changed', saveToStore);
        canvas.on('editing:exited', saveToStore);

        return () => {
            canvas.off('selection:created', updateSelection);
            canvas.off('selection:updated', updateSelection);
            canvas.off('selection:cleared', updateSelection);
            canvas.off('object:modified', saveToStore);
            canvas.off('object:added', saveToStore);
            canvas.off('object:removed', saveToStore);
            canvas.off('text:changed', saveToStore);
            canvas.off('editing:exited', saveToStore);
        };
    }, [map]); // map dependency for Line calc if needed

    // Handle Property Updates from Store (e.g. Color change from menu)
    const selectedFabricProperties = useSitacStore(s => s.selectedFabricProperties);
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (!canvas || !selectedFabricProperties) return;

        const active = canvas.getActiveObject();
        if (active) {
            // Apply color
            if (selectedFabricProperties.color) {
                if (active instanceof fabric.Line || active instanceof fabric.Path) {
                    active.set({ stroke: selectedFabricProperties.color });
                } else {
                    if (active.fill && active.fill !== 'transparent') {
                        active.set({ fill: selectedFabricProperties.color });
                    }
                    if (active.stroke) {
                        active.set({ stroke: selectedFabricProperties.color });
                    }
                    if (active instanceof fabric.IText) {
                        active.set({ fill: selectedFabricProperties.color });
                    }

                    if (active instanceof fabric.Group && (active as any).isArrow) {
                        active._objects.forEach((child) => {
                            if (child instanceof fabric.Line) {
                                child.set({ stroke: selectedFabricProperties.color });
                            }
                            if (child instanceof fabric.Triangle) {
                                child.set({ fill: selectedFabricProperties.color });
                            }
                        });
                        (active as any).strokeColor = selectedFabricProperties.color;
                    } else if (active instanceof fabric.Image) {
                        const canColorize = (active as any).colorizable === true || flagIfMonochrome(active);
                        if (canColorize) {
                            const filter = new fabric.filters.BlendColor({
                                color: selectedFabricProperties.color,
                                mode: 'tint',
                                alpha: 1
                            });
                            active.filters = [filter];
                            active.applyFilters();
                            (active as any).colorizable = true;
                        } else {
                            active.filters = [];
                            active.applyFilters();
                        }
                    }
                }
            }

            // Apply Line Style
            if (selectedFabricProperties.lineStyle) {
                let dashArray: number[] = [];
                switch (selectedFabricProperties.lineStyle) {
                    case 'dashed':
                        dashArray = [15, 10];
                        break;
                    case 'dot-dash':
                        dashArray = [15, 5, 2, 5];
                        break;
                    case 'solid':
                    default:
                        dashArray = [];
                }
                if (active instanceof fabric.Group && (active as any).isArrow) {
                    active._objects.forEach((child) => {
                        if (child instanceof fabric.Line) {
                            child.set({ strokeDashArray: dashArray });
                        }
                    });
                } else {
                    active.set({ strokeDashArray: dashArray });
                }
            }

            // Apply Rotation
            if (selectedFabricProperties.rotation !== undefined) {
                active.set({ angle: selectedFabricProperties.rotation });
                active.setCoords();
            }

            canvas.requestRenderAll();
        }
    }, [selectedFabricProperties]);

    // Allow palette color changes to recolor selected B&W symbols
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        if (!(active instanceof fabric.Image)) return;

        const canColorize = (active as any).colorizable === true || flagIfMonochrome(active);
        if (!canColorize) return;

        const filter = new fabric.filters.BlendColor({
            color: drawingColor,
            mode: 'tint',
            alpha: 1,
        });
        active.filters = [filter];
        active.applyFilters();
        (active as any).colorizable = true;
        canvas.requestRenderAll();
        canvas.fire('object:modified', { target: active }); // Persist new color to store/GeoJSON
    }, [drawingColor]);

    // Handle Fabric Actions (Delete from menu)
    const fabricAction = useSitacStore(s => s.fabricAction);
    useEffect(() => {
        if (!fabricAction) return;
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        if (fabricAction.type === 'delete') {
            const active = canvas.getActiveObject();
            if (active && !(active instanceof fabric.IText && (active as fabric.IText).isEditing)) {
                canvas.remove(active);
                canvas.discardActiveObject();
                canvas.requestRenderAll();
            }
            // Reset action
            useSitacStore.getState().setFabricAction(null);
        }
    }, [fabricAction]);

    // Handle Keyboard Delete & Eraser Mode
    useEffect(() => {
        const canvas = fabricCanvas.current;
        if (!canvas) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const active = canvas.getActiveObject();
                if (active && !(active instanceof fabric.IText && (active as fabric.IText).isEditing)) {
                    canvas.remove(active);
                    canvas.discardActiveObject();
                    canvas.requestRenderAll();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Eraser Mode Click
        if ((mode as any) === 'erase') {
            canvas.selection = false;
            canvas.defaultCursor = 'not-allowed'; // displayed as eraser hint
            canvas.on('mouse:down', (o) => {
                if (o.target) {
                    canvas.remove(o.target);
                    canvas.requestRenderAll();
                }
            });
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if ((mode as any) === 'erase') {
                canvas.off('mouse:down');
            }
        };
    }, [mode]);


    // Handle Map Synchronization (The Sandwich)
    useEffect(() => {
        if (!map || !fabricCanvas.current) return;

        const sync = () => {
            const canvas = fabricCanvas.current;
            if (!canvas) return;

            canvas.getObjects().forEach((obj) => {
                syncObjectPosition(obj as FabricGeoObject, map);
            });
            canvas.requestRenderAll();
        };

        map.on('move', sync);
        map.on('zoom', sync);
        map.on('rotate', sync);
        map.on('pitch', sync);

        return () => {
            map.off('move', sync);
            map.off('zoom', sync);
            map.off('rotate', sync);
            map.off('pitch', sync);
        };
    }, [map]);


    return (
        <div
            className={`absolute inset-0 z-10 ${locked ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            <canvas ref={canvasEl} />
        </div>
    );
};

export default SitacFabricCanvas;
