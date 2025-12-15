import React, { useRef, useEffect, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import { useSitacStore } from '../../stores/useSitacStore';
import { createId, simplifyLine } from '../../utils/sitacUtils';
import type { SITACFeature } from '../../types/sitac';

interface SitacDrawingCanvasProps {
    width: number;
    height: number;
    map: maplibregl.Map | null;
}

const SitacDrawingCanvas: React.FC<SitacDrawingCanvasProps> = ({ width, height, map }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Store State
    const mode = useSitacStore((s) => s.mode);
    const drawingColor = useSitacStore((s) => s.drawingColor);
    const lineStyle = useSitacStore((s) => s.lineStyle); // 'solid' | 'dashed' | 'dot-dash'
    const setMode = useSitacStore((s) => s.setMode);
    const addFeature = useSitacStore((s) => s.addFeature);
    const setSelectedFeatureId = useSitacStore((s) => s.setSelectedFeatureId);

    // Local Drawing State
    const isDrawing = useRef(false);
    const points = useRef<[number, number][]>([]); // Screen coordinates [x, y]
    const startPoint = useRef<[number, number] | null>(null);

    // Check if current mode is a "drawing" mode handled by canvas
    const isCanvasMode = ['draw_freehand', 'draw_line', 'draw_rect', 'draw_circle'].includes(mode);

    // --- Rendering ---
    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, width, height);

        if (points.current.length < 2 && !startPoint.current) return;

        // Style
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = drawingColor;
        ctx.lineWidth = 3;

        // Dash styles
        if (lineStyle === 'dashed') ctx.setLineDash([10, 10]);
        else if (lineStyle === 'dot-dash') ctx.setLineDash([15, 5, 2, 5]);
        else ctx.setLineDash([]);

        ctx.beginPath();

        if (mode === 'draw_freehand' || mode === 'draw_line') {
            if (points.current.length > 0) {
                ctx.moveTo(points.current[0][0], points.current[0][1]);
                for (let i = 1; i < points.current.length; i++) {
                    ctx.lineTo(points.current[i][0], points.current[i][1]);
                }
            }
        } else if (mode === 'draw_rect' && startPoint.current && points.current.length > 0) {
            const [startX, startY] = startPoint.current;
            const [currX, currY] = points.current[points.current.length - 1];
            ctx.fillStyle = drawingColor + '33'; // 20% opacity hex
            ctx.fillRect(startX, startY, currX - startX, currY - startY);
            ctx.strokeRect(startX, startY, currX - startX, currY - startY);
        } else if (mode === 'draw_circle' && startPoint.current && points.current.length > 0) {
            const [startX, startY] = startPoint.current;
            const [currX, currY] = points.current[points.current.length - 1];
            const radius = Math.sqrt(Math.pow(currX - startX, 2) + Math.pow(currY - startY, 2));

            ctx.fillStyle = drawingColor + '33';
            ctx.beginPath();
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        ctx.stroke();
    };

    // --- Logic ---
    const finalizeShape = () => {
        if (!map) return;

        const id = createId();
        let feature: SITACFeature | null = null;

        // Helper: Screen -> LngLat
        const toLngLat = (p: [number, number]) => {
            const ll = map.unproject(p);
            return [ll.lng, ll.lat];
        };

        if (mode === 'draw_freehand' && points.current.length > 2) {
            // 1. Convert all points to LngLat
            const rawCoords = points.current.map(toLngLat);
            // 2. Simplify (optional but good for performance)
            const simplified = simplifyLine(rawCoords as [number, number][]);

            feature = {
                type: 'Feature',
                id,
                properties: { id, type: 'freehand', color: drawingColor, strokeWidth: 3, lineStyle },
                geometry: { type: 'LineString', coordinates: simplified },
            };
        } else if (mode === 'draw_line' && points.current.length >= 2) {
            const coords = points.current.map(toLngLat);
            feature = {
                type: 'Feature',
                id,
                properties: { id, type: 'line', color: drawingColor, strokeWidth: 3, lineStyle },
                geometry: { type: 'LineString', coordinates: coords as [number, number][] },
            };
        } else if ((mode === 'draw_rect' || mode === 'draw_circle') && startPoint.current && points.current.length > 0) {
            const [startX, startY] = startPoint.current;
            const [endX, endY] = points.current[points.current.length - 1];

            const startLngLat = toLngLat([startX, startY]);
            const endLngLat = toLngLat([endX, endY]);

            if (mode === 'draw_rect') {
                feature = {
                    type: 'Feature',
                    id,
                    properties: { id, type: 'polygon', color: drawingColor },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [startLngLat[0], startLngLat[1]],
                            [endLngLat[0], startLngLat[1]],
                            [endLngLat[0], endLngLat[1]],
                            [startLngLat[0], endLngLat[1]],
                            [startLngLat[0], startLngLat[1]]
                        ]]
                    }
                };
            } else {
                // Circle approximation
                const radiusDeg = Math.sqrt(Math.pow(endLngLat[0] - startLngLat[0], 2) + Math.pow(endLngLat[1] - startLngLat[1], 2));
                const center = startLngLat;
                const steps = 64;
                const circleCoords: [number, number][] = [];
                for (let i = 0; i <= steps; i++) {
                    const theta = (i / steps) * 2 * Math.PI;
                    // Simple approx for visual circle on map (not geodesic perfect but good enough for SITAC)
                    circleCoords.push([
                        center[0] + radiusDeg * Math.cos(theta),
                        center[1] + radiusDeg * Math.sin(theta) * 0.65 // adjust for latitude distortion roughly at 45deg
                    ]);
                }
                feature = {
                    type: 'Feature',
                    id,
                    properties: { id, type: 'polygon', color: drawingColor },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [circleCoords]
                    }
                };
            }
        }

        if (feature) {
            addFeature(feature);
            setSelectedFeatureId(id);
        }

        // Reset
        points.current = [];
        startPoint.current = null;
        isDrawing.current = false;
        setMode('select'); // Return to select mode

        // Clear canvas
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        ctx?.clearRect(0, 0, width, height);
    };

    // --- Event Handlers ---
    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isCanvasMode) return;
        e.preventDefault();
        isDrawing.current = true;

        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).nativeEvent.offsetX;
        const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).nativeEvent.offsetY;

        startPoint.current = [x, y];
        points.current = [[x, y]];
        render();
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isCanvasMode || !isDrawing.current) return;

        const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).nativeEvent.offsetX;
        const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).nativeEvent.offsetY;

        points.current.push([x, y]);
        requestAnimationFrame(render);
    };

    const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isCanvasMode || !isDrawing.current) return;
        finalizeShape();
    };

    // Reset/Redraw when resizing or mode changing
    useEffect(() => {
        render();
    }, [width, height, mode, drawingColor, lineStyle]);


    if (!isCanvasMode) return null;

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`absolute inset-0 z-10 cursor-crosshair touch-none ${!isCanvasMode ? 'pointer-events-none' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
        />
    );
};

export default SitacDrawingCanvas;
