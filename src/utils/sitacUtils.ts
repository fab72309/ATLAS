import type { Geometry } from 'geojson';

export const createId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const metersToDegrees = (meters: number, latitude: number) => {
    const earth = 6378137;
    const dLat = (meters / earth) * (180 / Math.PI);
    const dLng = (meters / (earth * Math.cos((Math.PI * latitude) / 180))) * (180 / Math.PI);
    return { dLat, dLng };
};

export const simplifyLine = (points: [number, number][], tolerance = 0.00005) => {
    if (points.length <= 2) return points;
    const sqTolerance = tolerance * tolerance;

    const getSqSegDist = (p: [number, number], p1: [number, number], p2: [number, number]) => {
        let x = p1[0];
        let y = p1[1];
        let dx = p2[0] - x;
        let dy = p2[1] - y;

        if (dx !== 0 || dy !== 0) {
            const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x = p2[0];
                y = p2[1];
            } else if (t > 0) {
                x += dx * t;
                y += dy * t;
            }
        }

        dx = p[0] - x;
        dy = p[1] - y;
        return dx * dx + dy * dy;
    };

    const sqDistToSegment = (p: [number, number], p1: [number, number], p2: [number, number]) => getSqSegDist(p, p1, p2);

    const simplifyDPStep = (pts: [number, number][], first: number, last: number, simplified: [number, number][]) => {
        let maxSqDist = sqTolerance;
        let index = -1;

        for (let i = first + 1; i < last; i += 1) {
            const sqDist = sqDistToSegment(pts[i], pts[first], pts[last]);
            if (sqDist > maxSqDist) {
                index = i;
                maxSqDist = sqDist;
            }
        }

        if (maxSqDist > sqTolerance && index !== -1) {
            if (index - first > 1) simplifyDPStep(pts, first, index, simplified);
            simplified.push(pts[index]);
            if (last - index > 1) simplifyDPStep(pts, index, last, simplified);
        }
    };

    const simplified: [number, number][] = [points[0]];
    simplifyDPStep(points, 0, points.length - 1, simplified);
    simplified.push(points[points.length - 1]);
    return simplified;
};

export const translateGeometry = (geometry: Geometry, delta: { dLng: number; dLat: number }) => {
    const moveCoords = (coords: any): any => {
        if (typeof coords[0] === 'number') {
            return [(coords[0] as number) + delta.dLng, (coords[1] as number) + delta.dLat];
        }
        return coords.map((c: any) => moveCoords(c));
    };
    return { ...geometry, coordinates: moveCoords((geometry as any).coordinates) };
};

export const centroid = (geometry: Geometry): [number, number] => {
    if (geometry.type === 'Point') return geometry.coordinates as [number, number];
    const coords = geometry.type === 'LineString'
        ? geometry.coordinates
        : geometry.type === 'Polygon'
            ? geometry.coordinates[0]
            : [];
    if (!Array.isArray(coords) || coords.length === 0) return [0, 0];
    const sum = coords.reduce(
        (acc: [number, number], curr: [number, number]): [number, number] => [acc[0] + curr[0], acc[1] + curr[1]],
        [0, 0] as [number, number],
    );
    return [sum[0] / coords.length, sum[1] / coords.length];
};

export const rotateGeometry = (geometry: Geometry, angleDeg: number) => {
    const center = centroid(geometry);
    const angle = (angleDeg * Math.PI) / 180;
    const rotate = (coords: any): any => {
        if (typeof coords[0] === 'number') {
            const x = coords[0] - center[0];
            const y = coords[1] - center[1];
            const nx = x * Math.cos(angle) - y * Math.sin(angle) + center[0];
            const ny = x * Math.sin(angle) + y * Math.cos(angle) + center[1];
            return [nx, ny];
        }
        return coords.map((c: any) => rotate(c));
    };
    return { ...geometry, coordinates: rotate((geometry as any).coordinates) };
};

export const scaleGeometry = (geometry: Geometry, factor: number) => {
    const center = centroid(geometry);
    const scale = (coords: any): any => {
        if (typeof coords[0] === 'number') {
            const x = coords[0];
            const y = coords[1];
            return [center[0] + (x - center[0]) * factor, center[1] + (y - center[1]) * factor];
        }
        return coords.map((c: any) => scale(c));
    };
    return { ...geometry, coordinates: scale((geometry as any).coordinates) };
};
