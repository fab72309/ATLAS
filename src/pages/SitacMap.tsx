import React, { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type LngLatLike } from 'maplibre-gl';
import type GeoJSON from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';
import { jsPDF } from 'jspdf';

import { useSitacStore } from '../stores/useSitacStore';
import { useInterventionStore } from '../stores/useInterventionStore';
import { useSitacDraw } from '../hooks/useSitacDraw';
import {
  BASE_STYLES,
  DRAW_SOURCE_ID,
  SYMBOL_ASSETS,
  buildSdfImageData,
  loadImageElement,
  ensureLayers,
  setSelectionFilter
} from '../utils/sitacLayers';
import type { BaseLayerKey, SymbolAsset } from '../types/sitac';

// Components
import SitacToolbar from '../components/sitac/SitacToolbar';
import SitacToolsSidebar from '../components/sitac/SitacToolsSidebar';
import SitacEditControls from '../components/sitac/SitacEditControls';
import SitacFabricCanvas from '../components/sitac/SitacFabricCanvas';

const maplibreWithWorker = maplibregl as typeof maplibregl & { workerClass?: typeof MapLibreWorker };
maplibreWithWorker.workerClass = MapLibreWorker;

const DEFAULT_VIEW = { center: [2.3522, 48.8566] as [number, number], zoom: 13 };

interface SitacMapProps {
  embedded?: boolean;
  interventionAddress?: string;
}

const SitacMap: React.FC<SitacMapProps> = ({ embedded = false, interventionAddress }) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State from Store
  const geoJSON = useSitacStore((s) => s.geoJSON);
  const mode = useSitacStore((s) => s.mode);
  const selectedFeatureId = useSitacStore((s) => s.selectedFeatureId);
  const locked = useSitacStore((s) => s.locked);
  const externalSearchQuery = useSitacStore((s) => s.externalSearchQuery);
  const externalSearchId = useSitacStore((s) => s.externalSearchId);
  const interventionLat = useInterventionStore((s) => s.lat);
  const interventionLng = useInterventionStore((s) => s.lng);
  const setInterventionLocation = useInterventionStore((s) => s.setLocation);

  // Local State
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>('plan');
  const [searchValue, setSearchValue] = useState('');
  const [activeSymbol, setActiveSymbol] = useState<SymbolAsset | null>(SYMBOL_ASSETS[0] || null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const lastExternalSearchId = useRef(0);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenOffset, setFullscreenOffset] = useState({ top: 0, left: 0 });
  const syncGeoJSONRef = useRef<() => void>(() => undefined);
  const ensureIconsRef = useRef<() => void>(() => undefined);
  const [isLocating, setIsLocating] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [isPlacingIntervention, setIsPlacingIntervention] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const isValidLngLat = (coord: unknown): coord is [number, number] =>
    Array.isArray(coord) &&
    coord.length >= 2 &&
    typeof coord[0] === 'number' &&
    Number.isFinite(coord[0]) &&
    typeof coord[1] === 'number' &&
    Number.isFinite(coord[1]);

  const isValidGeometry = (geometry: GeoJSON.Geometry): boolean => {
    switch (geometry.type) {
      case 'Point':
        return isValidLngLat(geometry.coordinates);
      case 'MultiPoint':
        return Array.isArray(geometry.coordinates) && geometry.coordinates.every(isValidLngLat);
      case 'LineString':
        return Array.isArray(geometry.coordinates) && geometry.coordinates.every(isValidLngLat);
      case 'MultiLineString':
        return Array.isArray(geometry.coordinates) && geometry.coordinates.every((line) => Array.isArray(line) && line.every(isValidLngLat));
      case 'Polygon':
        return Array.isArray(geometry.coordinates) && geometry.coordinates.every((ring) => Array.isArray(ring) && ring.every(isValidLngLat));
      case 'MultiPolygon':
        return Array.isArray(geometry.coordinates) &&
          geometry.coordinates.every((poly) => Array.isArray(poly) && poly.every((ring) => Array.isArray(ring) && ring.every(isValidLngLat)));
      case 'GeometryCollection':
        return geometry.geometries.every(isValidGeometry);
      default:
        return false;
    }
  };

  const sanitizeGeoJSON = (collection: SITACCollection): SITACCollection => {
    if (!collection || !Array.isArray(collection.features)) {
      return { type: 'FeatureCollection', features: [] };
    }
    const safeFeatures = collection.features.filter((feature) => {
      if (!feature || !feature.geometry) return false;
      try {
        return isValidGeometry(feature.geometry);
      } catch (err) {
        console.warn('Invalid SITAC geometry skipped', err);
        return false;
      }
    });
    return { ...collection, features: safeFeatures };
  };

  // Map Init Helper ---
  const cycleBaseLayer = () => {
    const baseOrder: BaseLayerKey[] = ['plan', 'satellite', 'whiteboard', 'offline'];
    const current = baseOrder.indexOf(baseLayer);
    const next = baseOrder[(current + 1) % baseOrder.length];
    setBaseLayer(next);
  };

  // --- Hook Integration ---
  useSitacDraw({ map: mapInstance, activeSymbol, interactionLock: isPlacingIntervention });

  // --- Logic ---
  const isMonochromeImage = useCallback(async (url: string) => {
    const img = await loadImageElement(url);
    const maxSize = 64;
    const scale = Math.min(maxSize / (img.naturalWidth || maxSize), maxSize / (img.naturalHeight || maxSize), 1);
    const width = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;

    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a < 10) continue; // ignore fully transparent pixels
      // Allow small anti-aliasing differences; consider "mono" if channels stay very close
      if (Math.abs(r - g) > 12 || Math.abs(r - b) > 12 || Math.abs(g - b) > 12) {
        return false; // found a colored pixel
      }
    }
    return true;
  }, []);

  const ensureIcons = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const asset of SYMBOL_ASSETS) {
      const imageId = asset.id;
      if (map.hasImage(imageId)) continue;
      try {
        let shouldUseSdf = asset.colorizable === true;
        if (!shouldUseSdf) {
          try {
            const isMono = await isMonochromeImage(asset.url);
            if (isMono) {
              shouldUseSdf = true;
              asset.colorizable = true;
              // Patch existing features for this icon to be colorizable
              const state = useSitacStore.getState();
              const needsUpdate = state.geoJSON.features.some(
                (f) =>
                  f.properties?.type === 'symbol' &&
                  f.properties?.iconName === asset.id &&
                  f.properties?.colorizable !== true
              );
              if (needsUpdate) {
                const patched = {
                  ...state.geoJSON,
                  features: state.geoJSON.features.map((f) => {
                    if (
                      f.properties?.type === 'symbol' &&
                      f.properties?.iconName === asset.id &&
                      f.properties?.colorizable !== true
                    ) {
                      return {
                        ...f,
                        properties: { ...f.properties, colorizable: true },
                      };
                    }
                    return f;
                  }),
                };
                state.setGeoJSON(patched, false);
              }
            }
          } catch (err) {
            console.warn('Monochrome detection failed', err);
          }
        }

        if (shouldUseSdf) {
          const sdf = await buildSdfImageData(asset.url);
          if (!map.hasImage(imageId)) {
            map.addImage(imageId, sdf as ImageData, { sdf: true });
          }
        } else {
          const imgEl = await loadImageElement(asset.url);
          if (!map.hasImage(imageId)) {
            map.addImage(imageId, imgEl, { sdf: false });
          }
        }
      } catch (err) {
        console.error('Icon load failure', err);
      }
    }
  }, [isMonochromeImage]);

  const syncGeoJSONToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureLayers(map);
    const source = map.getSource(DRAW_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      try {
        source.setData(sanitizeGeoJSON(geoJSON));
        // Force repaint to prevent visibility flickering
        map.triggerRepaint();
      } catch (err) {
        console.error('SITAC geoJSON sync failed', err);
      }
    }
    setSelectionFilter(map, selectedFeatureId);
  }, [selectedFeatureId, geoJSON]);

  // Sync when GeoJSON changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncGeoJSONToMap();
  }, [geoJSON, selectedFeatureId, syncGeoJSONToMap]);

  useEffect(() => {
    syncGeoJSONRef.current = syncGeoJSONToMap;
  }, [syncGeoJSONToMap]);

  useEffect(() => {
    ensureIconsRef.current = ensureIcons;
  }, [ensureIcons]);

  // Handle Mode Interaction locks
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // If drawing line, we disable double-click zoom to avoid conflict with "finish line" dblclick
    if (mode === 'draw_line') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [mode]);

  // Canvas Dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Update dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    // Initial size
    updateSize();

    // Observer
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_STYLES[baseLayer],
      center: DEFAULT_VIEW.center as LngLatLike,
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: false,
      preserveDrawingBuffer: true, // Required for export
    });
    mapRef.current = map;
    setMapInstance(map);
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'bottom-right');

    map.once('style.load', () => {
      ensureLayers(map);
      syncGeoJSONRef.current();
      ensureIconsRef.current();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Base Layer Switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(BASE_STYLES[baseLayer]);
    map.once('style.load', () => {
      ensureLayers(map);
      syncGeoJSONRef.current();
      ensureIconsRef.current();
    });
  }, [baseLayer]);

  // Lock changes (managed in useSitacDraw already, but we sync global lock state)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (locked) {
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
  }, [locked]);

  const getFullscreenElement = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    return doc.fullscreenElement || doc.webkitFullscreenElement;
  };

  const requestFullscreen = async () => {
    const el = fullscreenRef.current;
    if (!el) return;
    const webkitEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (webkitEl.webkitRequestFullscreen) {
        webkitEl.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed', err);
    }
  };

  const exitFullscreen = async () => {
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Exit fullscreen failed', err);
    }
  };

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      setIsFullscreen(false);
      if (getFullscreenElement()) {
        await exitFullscreen();
      }
      return;
    }

    const rect = fullscreenRef.current?.getBoundingClientRect();
    if (rect) {
      setFullscreenOffset({ top: rect.top, left: rect.left });
    }
    setIsFullscreen(true);
    await requestFullscreen();
  };

  useEffect(() => {
    const handleChange = () => {
      if (!getFullscreenElement() && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!mapInstance) return;
    const t = window.setTimeout(() => mapInstance.resize(), 50);
    return () => window.clearTimeout(t);
  }, [isFullscreen, mapInstance]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // --- Handlers ---
  const runSearch = useCallback(async (rawQuery: string) => {
    const map = mapRef.current;
    if (!map) return;
    const query = rawQuery.trim();
    if (!query) return;
    const match = query.match(/(-?\\d+(?:\\.\\d+)?)[,\\s]+(-?\\d+(?:\\.\\d+)?)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      map.flyTo({ center: [lng, lat], zoom: 15, speed: 0.9 });
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (data && data[0]) {
        const lon = parseFloat(data[0].lon);
        const lat = parseFloat(data[0].lat);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        map.flyTo({ center: [lon, lat], zoom: 15, speed: 0.9 });
      }
    } catch (err) {
      console.error('Erreur recherche adresse', err);
    }
  }, []);

  const handleSearch = () => {
    void runSearch(searchValue);
  };

  useEffect(() => {
    if (!externalSearchQuery || !mapInstance) return;
    if (externalSearchId === lastExternalSearchId.current) return;
    lastExternalSearchId.current = externalSearchId;
    setSearchValue(externalSearchQuery);
    void runSearch(externalSearchQuery);
  }, [externalSearchId, externalSearchQuery, mapInstance, runSearch]);

  useEffect(() => {
    if (!mapInstance) return;
    const lat = Number.isFinite(interventionLat) ? interventionLat : null;
    const lng = Number.isFinite(interventionLng) ? interventionLng : null;
    if (lat == null || lng == null) {
      if (!isPlacingIntervention && markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#ef4444' })
        .setLngLat([lng, lat])
        .addTo(mapInstance);
      return;
    }
    markerRef.current.setLngLat([lng, lat]);
  }, [mapInstance, interventionLat, interventionLng, isPlacingIntervention]);

  const handleLocateUser = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('La géolocalisation n’est pas supportée par ce navigateur.');
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    setIsLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setGeoError('Position actuelle non disponible.');
          setIsLocating(false);
          return;
        }
        map.flyTo({ center: [longitude, latitude], zoom: 15, speed: 0.9 });
        setIsLocating(false);
      },
      (error) => {
        console.error('Erreur de géolocalisation', error);
        let message = 'Une erreur est survenue lors de la géolocalisation.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Accès à la localisation refusé. Vous pouvez saisir l’adresse manuellement.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Position actuelle non disponible.';
            break;
          case error.TIMEOUT:
            message = 'Délai d’attente dépassé. Réessayez.';
            break;
        }
        setGeoError(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const applyInterventionLocation = useCallback(async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setGeoError('Position actuelle non disponible.');
      return;
    }
    setIsMarking(true);
    setGeoError(null);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`
      );
      const data = await response.json();
      const address = data?.address || {};
      const streetNumber = address.house_number || '';
      const streetName = address.road || '';
      const streetLine = [streetNumber, streetName].filter(Boolean).join(' ').trim();
      const cityValue = address.city || address.town || address.village || address.municipality || address.county || '';
      const addressValue = streetLine || data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const fullLabel = [addressValue, cityValue].filter(Boolean).join(', ');
      setInterventionLocation({
        lat,
        lng,
        address: addressValue || undefined,
        city: cityValue || undefined,
        streetNumber: streetNumber || undefined,
        streetName: streetName || undefined
      });
      if (fullLabel) {
        setSearchValue(fullLabel);
      }
    } catch (err) {
      console.error('Erreur de géocodage inverse', err);
      setGeoError('Impossible de récupérer l’adresse. Réessayez ou saisissez-la manuellement.');
      const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setInterventionLocation({
        lat,
        lng,
        address: fallback
      });
      setSearchValue(fallback);
    } finally {
      setIsMarking(false);
    }
  }, [setInterventionLocation]);

  const handleToggleInterventionPlacement = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (isPlacingIntervention) {
      setIsPlacingIntervention(false);
      const marker = markerRef.current;
      if (!marker) return;
      const pos = marker.getLngLat?.();
      if (!pos || !Number.isFinite(pos.lng) || !Number.isFinite(pos.lat)) return;
      const sameLat = Number.isFinite(interventionLat) && Math.abs((interventionLat as number) - pos.lat) < 1e-8;
      const sameLng = Number.isFinite(interventionLng) && Math.abs((interventionLng as number) - pos.lng) < 1e-8;
      if (!sameLat || !sameLng) {
        void applyInterventionLocation({ lat: pos.lat, lng: pos.lng });
      }
      return;
    }
    setGeoError(null);
    setIsPlacingIntervention(true);
    const hasStored = Number.isFinite(interventionLat) && Number.isFinite(interventionLng);
    const startLat = hasStored ? (interventionLat as number) : map.getCenter().lat;
    const startLng = hasStored ? (interventionLng as number) : map.getCenter().lng;
    if (!Number.isFinite(startLat) || !Number.isFinite(startLng)) return;
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#ef4444', draggable: true })
        .setLngLat([startLng, startLat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([startLng, startLat]);
    }
  }, [applyInterventionLocation, interventionLat, interventionLng, isPlacingIntervention]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (typeof marker.setDraggable === 'function') {
      marker.setDraggable(isPlacingIntervention);
    }
    if (!isPlacingIntervention) return;
    const handleDragEnd = () => {
      const pos = marker.getLngLat?.();
      if (!pos || !Number.isFinite(pos.lng) || !Number.isFinite(pos.lat)) return;
      void applyInterventionLocation({ lat: pos.lat, lng: pos.lng });
    };
    marker.on('dragend', handleDragEnd);
    return () => {
      marker.off('dragend', handleDragEnd);
    };
  }, [applyInterventionLocation, isPlacingIntervention]);

  const buildCompositeCanvas = useCallback(async () => {
    const map = mapRef.current;
    const fabricCvs = document.querySelector('.lower-canvas') as HTMLCanvasElement | null;
    if (!map || !fabricCvs) return null;

    await new Promise<void>((resolve) => {
      if (map.loaded()) {
        map.once('render', () => resolve());
        map.triggerRepaint();
        return;
      }
      map.once('idle', () => resolve());
    });

    const mapCanvas = map.getCanvas();
    const width = mapCanvas.width;
    const height = mapCanvas.height;

    const composite = document.createElement('canvas');
    composite.width = width;
    composite.height = height;
    const ctx = composite.getContext('2d');
    if (!ctx) return null;

    try {
      const mapDataUrl = mapCanvas.toDataURL('image/png');
      const img = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });
      img.src = mapDataUrl;
      await loaded;
      ctx.drawImage(img, 0, 0, width, height);
    } catch (err) {
      console.warn('Map capture failed, fallback to raw canvas', err);
      try {
        ctx.drawImage(mapCanvas, 0, 0, width, height);
      } catch (drawErr) {
        console.error('Map draw failed', drawErr);
      }
    }

    ctx.drawImage(fabricCvs, 0, 0, width, height);
    return { canvas: composite, fabricCanvas: fabricCvs };
  }, []);

  const applyExportMeta = (canvas: HTMLCanvasElement, address?: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const now = new Date();
    const dateLabel = now.toLocaleDateString('fr-FR');
    const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const lines: string[] = [];
    if (address) {
      lines.push(`Adresse: ${address}`);
    }
    lines.push(`Edition: ${dateLabel} ${timeLabel}`);
    const fontSize = Math.min(18, Math.max(12, Math.round(canvas.width * 0.012)));
    ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const lineHeight = Math.round(fontSize * 1.25);
    const padding = Math.round(fontSize * 0.8);
    const maxWidth = Math.round(canvas.width * 0.45);

    const wrapLine = (text: string) => {
      const words = text.split(' ');
      const wrapped: string[] = [];
      let current = '';
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth || !current) {
          current = next;
        } else {
          wrapped.push(current);
          current = word;
        }
      }
      if (current) wrapped.push(current);
      return wrapped;
    };

    const wrappedLines = lines.flatMap((line) => wrapLine(line));
    if (wrappedLines.length === 0) return;
    const maxLineWidth = Math.max(...wrappedLines.map((line) => ctx.measureText(line).width));
    const blockHeight = lineHeight * wrappedLines.length;
    const x = canvas.width - padding;
    const y = canvas.height - padding - blockHeight;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - maxLineWidth - padding, y - padding, maxLineWidth + padding * 2, blockHeight + padding * 2);
    ctx.restore();

    ctx.fillStyle = '#111111';
    wrappedLines.forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
  };

  const handleExport = () => {
    void handleExportPDF();
  };

  const handleExportImage = async () => {
    const result = await buildCompositeCanvas();
    if (!result) return;
    const link = document.createElement('a');
    link.download = `sitac-atlas-${Date.now()}.png`;
    const exportAddress = (interventionAddress || externalSearchQuery || searchValue || '').trim();
    applyExportMeta(result.canvas, exportAddress || undefined);
    try {
      link.href = result.canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Export image failed', err);
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = result.fabricCanvas.width;
      fallbackCanvas.height = result.fabricCanvas.height;
      const fallbackCtx = fallbackCanvas.getContext('2d');
      if (fallbackCtx) {
        fallbackCtx.drawImage(result.fabricCanvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
        applyExportMeta(fallbackCanvas, exportAddress || undefined);
      }
      link.href = fallbackCanvas.toDataURL('image/png');
    }
    link.click();
  };

  const handleSnapshot = async () => {
    const result = await buildCompositeCanvas();
    if (!result) return;
    const exportAddress = (interventionAddress || externalSearchQuery || searchValue || '').trim();
    const canvasToBlob = (canvas: HTMLCanvasElement) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));

    let targetCanvas = result.canvas;
    applyExportMeta(targetCanvas, exportAddress || undefined);

    let blob = await canvasToBlob(targetCanvas);
    if (!blob) {
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = result.fabricCanvas.width;
      fallbackCanvas.height = result.fabricCanvas.height;
      const fallbackCtx = fallbackCanvas.getContext('2d');
      if (fallbackCtx) {
        fallbackCtx.drawImage(result.fabricCanvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
        applyExportMeta(fallbackCanvas, exportAddress || undefined);
      }
      targetCanvas = fallbackCanvas;
      blob = await canvasToBlob(targetCanvas);
    }

    if (!blob) {
      console.error('Snapshot failed: unable to generate image data');
      return;
    }

    const fileName = `sitac-snapshot-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'SITAC Snapshot' });
        return;
      }
    } catch (err) {
      console.warn('Snapshot share failed, fallback to download', err);
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const result = await buildCompositeCanvas();
    if (!result) return;
    const exportAddress = (interventionAddress || externalSearchQuery || searchValue || '').trim();
    applyExportMeta(result.canvas, exportAddress || undefined);
    let imgData = '';
    let imgFormat: 'PNG' | 'JPEG' = 'JPEG';
    let exportWidth = result.canvas.width;
    let exportHeight = result.canvas.height;
    try {
      imgData = result.canvas.toDataURL('image/jpeg', 0.9);
    } catch (err) {
      console.error('Export PDF failed', err);
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = result.fabricCanvas.width;
      fallbackCanvas.height = result.fabricCanvas.height;
      const fallbackCtx = fallbackCanvas.getContext('2d');
      if (fallbackCtx) {
        fallbackCtx.drawImage(result.fabricCanvas, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
        applyExportMeta(fallbackCanvas, exportAddress || undefined);
      }
      imgData = fallbackCanvas.toDataURL('image/png');
      imgFormat = 'PNG';
      exportWidth = fallbackCanvas.width;
      exportHeight = fallbackCanvas.height;
    }
    const orientation = exportWidth > exportHeight ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format: [exportWidth, exportHeight],
    });
    pdf.addImage(imgData, imgFormat, 0, 0, exportWidth, exportHeight);
    pdf.save(`sitac-atlas-${Date.now()}.pdf`);
  };

  const containerHeightClass = isFullscreen ? 'h-full' : embedded ? 'h-[80vh]' : 'h-screen';
  const fullscreenStyle = isFullscreen
    ? {
        position: 'fixed' as const,
        top: -fullscreenOffset.top,
        left: -fullscreenOffset.left,
        width: '100vw',
        height: '100vh',
        zIndex: 70,
      }
    : undefined;

  return (
    <div
      ref={fullscreenRef}
      style={fullscreenStyle}
      className={`relative ${isFullscreen ? 'rounded-none bg-black overflow-hidden' : embedded ? 'rounded-2xl overflow-hidden border border-white/5' : ''}`}
    >
      <div ref={containerRef} className={`w-full ${containerHeightClass} ${embedded ? '' : 'min-h-screen'}`} />

      {/* Drawing Canvas Overlay */}
      <SitacFabricCanvas
        width={dimensions.width}
        height={dimensions.height}
        map={mapInstance}
        activeSymbol={activeSymbol}
      />

      {/* Main UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <SitacToolbar
          baseLayer={baseLayer}
          cycleBaseLayer={cycleBaseLayer}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          handleSearch={handleSearch}
          onLocateUser={handleLocateUser}
          onToggleInterventionPlacement={handleToggleInterventionPlacement}
          isLocating={isLocating}
          isMarking={isMarking}
          isPlacingIntervention={isPlacingIntervention}
        />

        <SitacToolsSidebar
          symbolAssets={SYMBOL_ASSETS}
          activeSymbol={activeSymbol}
          className="z-20"
          setActiveSymbol={setActiveSymbol}
        />

        <SitacEditControls
          handleExport={handleExport}
          onExportImage={handleExportImage}
          onExportPDF={handleExportPDF}
          onSnapshot={handleSnapshot}
          onToggleFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
        />
      </div>

      {geoError && (
        <div className="absolute top-20 left-4 z-30 pointer-events-none rounded-xl bg-black/70 border border-red-400/40 px-3 py-2 text-xs text-red-100 max-w-xs">
          {geoError}
        </div>
      )}
      {isPlacingIntervention && (
        <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 pointer-events-none rounded-full bg-black/70 border border-white/20 px-4 py-2 text-xs text-white/90 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
          Faites glisser l'indicateur pour positionner l'intervention
        </div>
      )}
    </div>
  );
};

export default SitacMap;
