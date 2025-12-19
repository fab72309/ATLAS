import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type { FeatureCollection } from 'geojson';
import { Share } from '@capacitor/share';
import {
  Camera,
  Layers,
  MapPin,
  PenLine,
  Shapes,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Target,
  Trash2,
  Crosshair,
  Droplets,
  Wind as WindIcon,
  ThermometerSun,
  ChevronLeft,
  Palette,
  Maximize2,
} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';

// Ensure worker is bundled correctly for Capacitor / file:// schemes
(maplibregl as any).workerClass = MapLibreWorker;

type BaseLayerKey = 'streets' | 'light' | 'maptiler3d';
type BaseStyle = StyleSpecification | string;

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || 'Mj3FpNheBXK65loEjjn5';

const BASE_STYLES: Record<BaseLayerKey, BaseStyle> = {
  streets: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm-tiles',
        type: 'raster',
        source: 'osm',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  },
  light: {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap, © CARTO',
      },
    },
    layers: [
      {
        id: 'carto-tiles',
        type: 'raster',
        source: 'carto',
        minzoom: 0,
        maxzoom: 20,
      },
    ],
  },
  maptiler3d: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
};

type LogoAsset = {
  key: string;
  label: string;
  url: string;
};

type LogoPlacement = {
  id: string;
  assetKey: string;
  label: string;
  url: string;
  position: [number, number];
  size: number;
  color: string;
};

const formatLogoLabel = (raw: string) => {
  return raw
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(\w)/g, (_, char: string) => char.toUpperCase());
};

const logoModules = import.meta.glob('../assets/logos/*.{png,jpg,jpeg,svg,webp}', {
  eager: true,
  import: 'default',
});

const LOGO_ASSETS: LogoAsset[] = Object.entries(logoModules).map(([path, url]) => {
  const fileName = path.split('/').pop() || 'Logo';
  const label = formatLogoLabel(fileName.replace(/\.[^.]+$/, ''));
  return { key: path, label, url: url as string };
});


const createId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

// --- Universal logo recolor pipeline (Canvas -> Data URL) ---
// Replaces CSS mask-image (which is unreliable in iOS/WKWebView).

type ColorizedKey = string;

const __logoDataUrlCache = new Map<ColorizedKey, string>();
const __logoInFlight = new Map<ColorizedKey, Promise<string>>();

const makeColorizedKey = (url: string, color: string) => `${url}__${color.toLowerCase()}`;

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    // In iOS/WKWebView (and Capacitor file://), setting crossOrigin can cause the load to fail.
    // Only set it for http(s) URLs.
    if (/^https?:\/\//i.test(url)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });

const rasterizeAndTint = async (url: string, color: string) => {
  const img = await loadImage(url);

  // Fallback sizes if natural size is missing
  const w = img.naturalWidth || 128;
  const h = img.naturalHeight || 128;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Draw original
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, 0, 0, w, h);

  // Many exported icons include a solid background (white/black/etc.), which makes the whole
  // canvas opaque and turns tinting into a colored square. To fix this reliably, we sample
  // the 4 corners (likely background) and remove pixels close to that background color.
  try {
    const imageData = ctx.getImageData(0, 0, w, h);
    const d = imageData.data;

    const idx = (x: number, y: number) => ((y * w + x) * 4);
    const corners = [
      idx(0, 0),
      idx(w - 1, 0),
      idx(0, h - 1),
      idx(w - 1, h - 1),
    ];

    // Average background color from corners (ignore fully transparent corners)
    let br = 0, bg = 0, bb = 0, count = 0;
    for (const i of corners) {
      const a = d[i + 3];
      if (a === 0) continue;
      br += d[i];
      bg += d[i + 1];
      bb += d[i + 2];
      count++;
    }

    // If all corners are transparent, we keep the original alpha mask.
    if (count > 0) {
      br = Math.round(br / count);
      bg = Math.round(bg / count);
      bb = Math.round(bb / count);

      // Tolerance for background color matching
      const tol = 18;

      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        if (a === 0) continue;

        const dr = Math.abs(r - br);
        const dg = Math.abs(g - bg);
        const db = Math.abs(b - bb);

        // If pixel is close to sampled background color, make it transparent.
        if (dr <= tol && dg <= tol && db <= tol) {
          d[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }
  } catch {
    // Some browsers may block getImageData if the canvas becomes tainted; ignore.
  }

  // Tint using alpha mask
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);

  // Export as PNG for maximum compatibility
  return canvas.toDataURL('image/png');
};

const getColorizedLogoDataUrl = async (url: string, color: string) => {
  // SSR safety
  if (typeof document === 'undefined') return url;

  const key = makeColorizedKey(url, color);
  const cached = __logoDataUrlCache.get(key);
  if (cached) return cached;

  const inFlight = __logoInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = rasterizeAndTint(url, color)
    .then((dataUrl) => {
      __logoDataUrlCache.set(key, dataUrl);
      __logoInFlight.delete(key);
      return dataUrl;
    })
    .catch((err) => {
      __logoInFlight.delete(key);
      throw err;
    });

  __logoInFlight.set(key, promise);
  return promise;
};

const preloadColorizedLogos = (items: Array<{ url: string; color: string }>) => {
  if (typeof document === 'undefined') return;
  items.forEach(({ url, color }) => {
    void getColorizedLogoDataUrl(url, color).catch(() => {
      // ignore preload failures
    });
  });
};

const useColorizedLogo = (url?: string, color?: string) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  React.useEffect(() => {
    if (!url || !color) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    getColorizedLogoDataUrl(url, color)
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(url); // fallback: original
      });

    return () => {
      cancelled = true;
    };
  }, [url, color]);

  return dataUrl;
};

const LogoPreview: React.FC<{ url: string; color?: string; className?: string }> = ({ url, color, className }) => {
  const tinted = useColorizedLogo(url, color);
  const src = color ? tinted || url : url;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage:
          'linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%),' +
          'linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%),' +
          'linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.06) 75%),' +
          'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.06) 75%)',
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
      }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
};

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}> = ({ icon, label, onClick, active, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border
      ${active ? 'bg-white/15 border-white/30 text-white' : 'bg-black/40 border-white/10 text-gray-200 hover:bg-white/10'}
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'shadow-lg hover:scale-[1.02] active:scale-95'}
    `}
  >
    <span className="w-4 h-4">{icon}</span>
    <span>{label}</span>
  </button>
);

interface SitacMapProps {
  embedded?: boolean;
}

const SitacMap: React.FC<SitacMapProps> = ({ embedded = false }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const geolocateRef = useRef<maplibregl.GeolocateControl | null>(null);
  const historyRef = useRef<FeatureCollection[]>([EMPTY_FC]);
  const redoRef = useRef<FeatureCollection[]>([]);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});

  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>('light');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [logoPlacements, setLogoPlacements] = useState<LogoPlacement[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [pendingLogo, setPendingLogo] = useState<LogoAsset | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [weather, setWeather] = useState<{
    temperature: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
  } | null>(null);

  const syncUndoRedo = useCallback(() => {
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(redoRef.current.length > 0);
  }, []);


  const pushHistory = useCallback(() => {
    if (!drawRef.current) return;
    const snapshot = JSON.parse(JSON.stringify(drawRef.current.getAll())) as FeatureCollection;
    historyRef.current = [...historyRef.current, snapshot];
    redoRef.current = [];
    syncUndoRedo();
  }, [syncUndoRedo]);

  const restoreFeatures = useCallback((fc: FeatureCollection) => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    if (fc.features.length) {
      drawRef.current.set(fc);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (!drawRef.current || historyRef.current.length <= 1) return;
    const current = historyRef.current.pop();
    if (!current) return;
    redoRef.current = [current, ...redoRef.current];
    const previous = historyRef.current[historyRef.current.length - 1] || EMPTY_FC;
    restoreFeatures(previous);
    syncUndoRedo();
  }, [restoreFeatures, syncUndoRedo]);

  const handleRedo = useCallback(() => {
    if (!drawRef.current || redoRef.current.length === 0) return;
    const [next, ...rest] = redoRef.current;
    redoRef.current = rest;
    historyRef.current = [...historyRef.current, next];
    restoreFeatures(next);
    syncUndoRedo();
  }, [restoreFeatures, syncUndoRedo]);

  const handleClear = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    historyRef.current = [...historyRef.current, EMPTY_FC];
    redoRef.current = [];
    setLogoPlacements([]);
    setSelectedLogoId(null);
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};
    syncUndoRedo();
  }, [syncUndoRedo]);

  const fetchWeather = useCallback(async (lng: number, lat: number) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const current = data?.current;
      if (!current) return;
      setWeather({
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
      });
    } catch (error) {
      console.error('Weather fetch failed', error);
    }
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASE_STYLES[baseLayer],
      center: [2.3377, 48.8589],
      zoom: 14,
      pitch: baseLayer === 'maptiler3d' ? 45 : 0,
      bearing: baseLayer === 'maptiler3d' ? -17 : 0,
      attributionControl: false,
    });

    mapRef.current = map;

    const navControl = new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false });
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 16 },
    });
    geolocateRef.current = geolocate;

    map.addControl(navControl, 'bottom-right');
    map.addControl(geolocate, 'top-left');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        point: true,
        line_string: true,
        polygon: true,
        trash: false,
        combine_features: false,
        uncombine_features: false,
      },
      boxSelect: false,
      touchEnabled: true,
      userProperties: true,
      mapboxgl: maplibregl as any,
    });

    drawRef.current = draw;
    map.addControl(draw, 'top-left');

    const handleDrawEvents = () => pushHistory();
    map.on('draw.create', handleDrawEvents);
    map.on('draw.update', handleDrawEvents);
    map.on('draw.delete', handleDrawEvents);

    const last = historyRef.current[historyRef.current.length - 1];
    if (last?.features.length) {
      draw.set(last);
    }

    map.on('load', () => {
      syncUndoRedo();
      const center = map.getCenter();
      fetchWeather(center.lng, center.lat);

      if (baseLayer === 'maptiler3d') {
        if (!map.getSource('terrain-dem')) {
          map.addSource('terrain-dem', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
            tileSize: 256,
            maxzoom: 14,
          });
        }

        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 });

        if (!map.getLayer('sky')) {
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun-intensity': 15,
            },
          });
        }

        if (!map.getLayer('3d-buildings')) {
          const beforeLayer = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
          map.addLayer(
            {
              id: '3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              filter: ['==', ['get', 'extrude'], 'true'],
              type: 'fill-extrusion',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': '#d1d5db',
                'fill-extrusion-height': [
                  'coalesce',
                  ['get', 'render_height'],
                  ['get', 'height'],
                  10,
                ],
                'fill-extrusion-base': [
                  'coalesce',
                  ['get', 'render_min_height'],
                  ['get', 'min_height'],
                  0,
                ],
                'fill-extrusion-opacity': 0.9,
              },
            },
            beforeLayer,
          );
        }
      }
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      fetchWeather(center.lng, center.lat);
    });

    geolocate.on('geolocate', (e) => {
      fetchWeather(e.coords.longitude, e.coords.latitude);
    });

    return () => {
      map.off('draw.create', handleDrawEvents);
      map.off('draw.update', handleDrawEvents);
      map.off('draw.delete', handleDrawEvents);
      geolocateRef.current = null;
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [fetchWeather, pushHistory, syncUndoRedo]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    map.setStyle(BASE_STYLES[baseLayer]);
    map.once('style.load', () => {
      const latest = historyRef.current[historyRef.current.length - 1];
      restoreFeatures(latest || EMPTY_FC);

      if (baseLayer === 'maptiler3d') {
        if (!map.getSource('terrain-dem')) {
          map.addSource('terrain-dem', {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
            tileSize: 256,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.0 });

        if (!map.getLayer('sky')) {
          map.addLayer({
            id: 'sky',
            type: 'sky',
            paint: {
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun-intensity': 15,
            },
          });
        }

        if (!map.getLayer('3d-buildings')) {
          const beforeLayer = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;
          map.addLayer(
            {
              id: '3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              filter: ['==', ['get', 'extrude'], 'true'],
              type: 'fill-extrusion',
              minzoom: 12,
              paint: {
                'fill-extrusion-color': '#d1d5db',
                'fill-extrusion-height': [
                  'coalesce',
                  ['get', 'render_height'],
                  ['get', 'height'],
                  10,
                ],
                'fill-extrusion-base': [
                  'coalesce',
                  ['get', 'render_min_height'],
                  ['get', 'min_height'],
                  0,
                ],
                'fill-extrusion-opacity': 0.9,
              },
            },
            beforeLayer,
          );
        }

        map.easeTo({ pitch: 45, bearing: -17, duration: 500 });
      } else {
        map.setTerrain(null as any);
        if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings');
        if (map.getLayer('sky')) map.removeLayer('sky');
      }
    });
  }, [baseLayer, restoreFeatures]);

  const handleBaseSwitch = useCallback((key: BaseLayerKey) => {
    setBaseLayer(key);
  }, []);

  const handleSnapshot = useCallback(async () => {
    if (!mapContainerRef.current) return;
    setIsCapturing(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(mapContainerRef.current, { useCORS: true, backgroundColor: null });
      const dataUrl = canvas.toDataURL('image/png');

      try {
        await Share.share({
          title: 'Snapshot SITAC',
          text: 'Capture de la SITAC',
          url: dataUrl,
          dialogTitle: 'Partager la SITAC',
        });
      } catch {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'sitac.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Snapshot error', error);
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const startDrawMode = useCallback((mode: string) => {
    if (!drawRef.current) return;
    drawRef.current.changeMode(mode as any);
  }, []);

  const recenterToUser = useCallback(() => {
    geolocateRef.current?.trigger();
  }, []);

  const weatherDirection = useMemo(() => {
    if (!weather?.windDirection) return '';
    const sectors = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    const index = Math.round(weather.windDirection / 22.5) % 16;
    return sectors[index];
  }, [weather?.windDirection]);

  const updatePlacement = useCallback((id: string, updates: Partial<LogoPlacement>) => {
    setLogoPlacements((prev) => prev.map((placement) => (placement.id === id ? { ...placement, ...updates } : placement)));
  }, []);

  const removePlacement = useCallback((id: string) => {
    setLogoPlacements((prev) => prev.filter((placement) => placement.id !== id));
    setSelectedLogoId((prev) => (prev === id ? null : prev));
  }, []);


  const applyMarkerStyles = useCallback((el: HTMLElement, placement: LogoPlacement, selected: boolean) => {
    el.style.width = `${placement.size}px`;
    el.style.height = `${placement.size}px`;
    el.style.borderRadius = '9999px';
    el.style.border = selected ? '2px solid rgba(59, 130, 246, 0.8)' : '2px solid transparent';
    el.style.backgroundColor = 'transparent';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.padding = '6px';
    el.style.cursor = 'grab';
    el.style.boxShadow = '0 12px 30px rgba(3, 7, 18, 0.45)';
    el.style.transition = 'border 0.2s ease, transform 0.2s ease';
    el.style.transform = selected ? 'scale(1.05)' : 'scale(1)';

    let inner = el.querySelector<HTMLDivElement>('[data-logo-inner="true"]');
    if (!inner) {
      inner = document.createElement('div');
      inner.dataset.logoInner = 'true';
      inner.style.width = '100%';
      inner.style.height = '100%';
      inner.style.borderRadius = '9999px';
      el.appendChild(inner);
    }

    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.opacity = '0.95';

    // Always use the Canvas recolor pipeline for consistency across browsers (incl. iOS/WKWebView)
    inner.style.backgroundColor = 'transparent';
    inner.style.backgroundRepeat = 'no-repeat';
    inner.style.backgroundSize = 'contain';
    inner.style.backgroundPosition = 'center';

    // Remove any legacy mask properties in case they were applied before
    inner.style.removeProperty('mask-image');
    inner.style.removeProperty('mask-repeat');
    inner.style.removeProperty('mask-size');
    inner.style.removeProperty('mask-position');
    inner.style.removeProperty('-webkit-mask-image');
    inner.style.removeProperty('-webkit-mask-repeat');
    inner.style.removeProperty('-webkit-mask-size');
    inner.style.removeProperty('-webkit-mask-position');

    // Set a quick fallback first (original image), then swap to tinted data URL when ready
    inner.style.backgroundImage = `url(${placement.url})`;

    // Avoid spamming recolor if marker is re-styled rapidly
    const currentKey = makeColorizedKey(placement.url, placement.color);
    void getColorizedLogoDataUrl(placement.url, placement.color)
      .then((dataUrl) => {
        // Marker can be removed while the promise resolves
        if (!inner?.isConnected) return;
        // If placement changed while async work was running, ignore
        if (makeColorizedKey(placement.url, placement.color) !== currentKey) return;
        inner.style.backgroundImage = `url(${dataUrl})`;
      })
      .catch(() => {
        // Keep original
      });
  }, []);


  // --- Placement preview marker for Option A (Pick & Place with live preview) ---
  const placementPreviewRef = useRef<maplibregl.Marker | null>(null);
  const placementPreviewPlacementRef = useRef<LogoPlacement | null>(null);
  const placementRafRef = useRef<number | null>(null);
  const placementLastLngLatRef = useRef<maplibregl.LngLat | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const markers = markersRef.current;

    // Preload tinted icons for instant updates
    preloadColorizedLogos(logoPlacements.map((p) => ({ url: p.url, color: p.color })));

    logoPlacements.forEach((placement) => {
      if (!markers[placement.id]) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'logo-marker focus:outline-none';
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedLogoId(placement.id);
        });

        const marker = new maplibregl.Marker({ element, draggable: true })
          .setLngLat(placement.position)
          .addTo(map);

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          updatePlacement(placement.id, { position: [lngLat.lng, lngLat.lat] });
        });

        markers[placement.id] = marker;
      } else {
        markers[placement.id].setLngLat(placement.position);
      }

      const el = markers[placement.id].getElement() as HTMLElement;
      applyMarkerStyles(el, placement, placement.id === selectedLogoId);
    });

    Object.keys(markers).forEach((id) => {
      if (!logoPlacements.find((placement) => placement.id === id)) {
        markers[id].remove();
        delete markers[id];
      }
    });
  }, [logoPlacements, selectedLogoId, updatePlacement, applyMarkerStyles]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Cleanup helper
    const cleanup = () => {
      if (placementRafRef.current) {
        cancelAnimationFrame(placementRafRef.current);
        placementRafRef.current = null;
      }
      placementLastLngLatRef.current = null;
      placementPreviewPlacementRef.current = null;

      if (placementPreviewRef.current) {
        placementPreviewRef.current.remove();
        placementPreviewRef.current = null;
      }

      map.getCanvas().style.cursor = '';

      // Re-enable interactions
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.doubleClickZoom.enable();

      window.removeEventListener('keydown', onKeyDown);
      map.off('mousemove', onMove as any);
      map.off('touchmove', onMove as any);
      map.off('click', onPlace as any);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingLogo(null);
      }
    };

    const schedulePreviewUpdate = () => {
      if (!placementPreviewRef.current || !placementLastLngLatRef.current) return;

      if (placementRafRef.current) return;
      placementRafRef.current = requestAnimationFrame(() => {
        placementRafRef.current = null;
        const ll = placementLastLngLatRef.current;
        if (!ll || !placementPreviewRef.current) return;
        placementPreviewRef.current.setLngLat(ll);
      });
    };

    const onMove = (event: any) => {
      // MapLibre mouse/touch events expose lngLat
      if (!event?.lngLat) return;
      placementLastLngLatRef.current = event.lngLat;
      schedulePreviewUpdate();
    };

    const onPlace = (event: any) => {
      if (!pendingLogo) return;
      const lngLat = event?.lngLat;
      if (!lngLat) return;

      const id = createId();
      const coords: [number, number] = [lngLat.lng, lngLat.lat];

      setLogoPlacements((prev) => [
        ...prev,
        {
          id,
          assetKey: pendingLogo.key,
          label: pendingLogo.label,
          url: pendingLogo.url,
          position: coords,
          size: 72,
          color: '#ffffff',
        },
      ]);

      setSelectedLogoId(id);
      setPendingLogo(null);
    };

    // If we are not in placement mode, ensure cleanup and exit.
    if (!pendingLogo) {
      cleanup();
      return;
    }

    // Enter placement mode
    map.getCanvas().style.cursor = 'crosshair';

    // Disable gestures that conflict with placement
    map.dragPan.disable();
    map.touchZoomRotate.disable();
    map.doubleClickZoom.disable();

    // Create preview marker if needed
    if (!placementPreviewRef.current) {
      const element = document.createElement('div');
      element.style.pointerEvents = 'none';

      const previewPlacement: LogoPlacement = {
        id: 'preview',
        assetKey: pendingLogo.key,
        label: pendingLogo.label,
        url: pendingLogo.url,
        position: [map.getCenter().lng, map.getCenter().lat],
        size: 72,
        color: '#ffffff',
      };

      placementPreviewPlacementRef.current = previewPlacement;

      // Reuse the same styling pipeline as real markers
      applyMarkerStyles(element, previewPlacement, false);
      element.style.opacity = '0.75';
      element.style.border = '2px dashed rgba(59, 130, 246, 0.8)';
      element.style.transform = 'scale(1.0)';

      placementPreviewRef.current = new maplibregl.Marker({ element })
        .setLngLat(previewPlacement.position)
        .addTo(map);
    } else {
      // Update preview asset if user picked another logo
      const prev = placementPreviewPlacementRef.current;
      if (prev) {
        prev.assetKey = pendingLogo.key;
        prev.label = pendingLogo.label;
        prev.url = pendingLogo.url;
        const el = placementPreviewRef.current.getElement() as HTMLElement;
        applyMarkerStyles(el, prev, false);
        el.style.opacity = '0.75';
        el.style.border = '2px dashed rgba(59, 130, 246, 0.8)';
        el.style.transform = 'scale(1.0)';
      }
    }

    // Start following cursor/finger
    map.on('mousemove', onMove as any);
    map.on('touchmove', onMove as any);

    // Place on click/tap
    map.on('click', onPlace as any);

    // Escape cancels placement
    window.addEventListener('keydown', onKeyDown);

    // Cleanup when effect re-runs/unmounts
    return cleanup;
  }, [pendingLogo, applyMarkerStyles]);

  const containerHeightClass = embedded ? 'h-[70vh]' : 'h-screen';
  const mapDecorationClass = embedded ? 'rounded-2xl overflow-hidden border border-white/10' : '';
  const toolbarStyle = embedded
    ? { top: '48px', left: '12px', bottom: '32px' }
    : { top: '120px', left: '20px', bottom: '140px' };
  const infoStyle = embedded
    ? { top: '12px', right: '12px' }
    : { top: '24px', right: '24px' };
  const toolbarSlideStyle = toolbarOpen ? undefined : { transform: 'translateX(calc(-100% + 64px))' };
  const panelScrollStyle = { maxHeight: embedded ? '60vh' : 'calc(100vh - 16rem)' };

  return (
    <div className={`relative text-white ${embedded ? 'bg-transparent' : 'bg-[#0A0A0A] min-h-screen'}`}>
      <div
        ref={mapContainerRef}
        className={`w-full ${containerHeightClass} ${mapDecorationClass}`}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute z-20 flex pointer-events-none" style={toolbarStyle}>
          <div className="relative h-full pointer-events-none">
            <div className="pointer-events-auto h-full transition-all duration-300 ease-out" style={toolbarSlideStyle}>
              <div className="bg-black/70 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl w-80 h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                    <Layers className="w-4 h-4 text-blue-300" />
                    <span>Outils SITAC</span>
                  </div>
                  {toolbarOpen && (
                    <button
                      onClick={() => setToolbarOpen(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                      aria-label="Réduire le panneau"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6" style={panelScrollStyle}>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Navigation</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ToolbarButton
                        icon={<Layers className="w-4 h-4" />}
                        label={
                          baseLayer === 'maptiler3d'
                            ? '3D (MapTiler)'
                            : baseLayer === 'light'
                              ? 'Fond clair'
                              : 'Fond OSM'
                        }
                        onClick={() => {
                          if (baseLayer === 'maptiler3d') handleBaseSwitch('light');
                          else if (baseLayer === 'light') handleBaseSwitch('streets');
                          else handleBaseSwitch('maptiler3d');
                        }}
                        active
                      />
                      <ToolbarButton icon={<Target className="w-4 h-4" />} label="Me localiser" onClick={recenterToUser} />
                      <ToolbarButton icon={<Crosshair className="w-4 h-4" />} label="Zoom +" onClick={() => mapRef.current?.zoomIn()} />
                      <ToolbarButton icon={<Crosshair className="w-4 h-4 rotate-180" />} label="Zoom -" onClick={() => mapRef.current?.zoomOut()} />
                      <ToolbarButton
                        icon={<RotateCcw className="w-4 h-4" />}
                        label="Rotation -"
                        onClick={() => mapRef.current?.easeTo({ bearing: (mapRef.current?.getBearing() ?? 0) - 15 })}
                      />
                      <ToolbarButton
                        icon={<RotateCw className="w-4 h-4" />}
                        label="Rotation +"
                        onClick={() => mapRef.current?.easeTo({ bearing: (mapRef.current?.getBearing() ?? 0) + 15 })}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Dessin</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ToolbarButton icon={<MapPin className="w-4 h-4" />} label="Symbole" onClick={() => startDrawMode('draw_point')} />
                      <ToolbarButton icon={<PenLine className="w-4 h-4" />} label="Ligne" onClick={() => startDrawMode('draw_line_string')} />
                      <ToolbarButton icon={<Shapes className="w-4 h-4" />} label="Zone" onClick={() => startDrawMode('draw_polygon')} />
                      <ToolbarButton icon={<Undo2 className="w-4 h-4" />} label="Annuler" onClick={handleUndo} disabled={!canUndo} />
                      <ToolbarButton icon={<Redo2 className="w-4 h-4" />} label="Rétablir" onClick={handleRedo} disabled={!canRedo} />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Captures & nettoyage</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ToolbarButton
                        icon={<Camera className="w-4 h-4" />}
                        label={isCapturing ? 'Capture...' : 'Snapshot'}
                        onClick={handleSnapshot}
                        disabled={isCapturing}
                      />
                      <ToolbarButton icon={<Trash2 className="w-4 h-4" />} label="Tout effacer" onClick={handleClear} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400">
                      <span>Bibliothèque logos</span>
                      <span className="text-[10px] text-gray-500">{LOGO_ASSETS.length}</span>
                    </div>
                    {LOGO_ASSETS.length === 0 ? (
                      <div className="mt-3 text-sm text-gray-400 border border-dashed border-white/10 rounded-2xl px-3 py-4 bg-white/5">
                        Glissez vos images dans <span className="font-semibold text-white">src/assets/logos</span> puis rechargez la page pour les voir ici.
                        <br />
                        <span className="text-xs text-gray-500">
                          Sur desktop : glissez-déposez un logo sur la carte. Sur mobile : touchez un logo puis touchez la carte.
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {LOGO_ASSETS.map((asset) => {
                          const selected = pendingLogo?.key === asset.key;
                          return (
                            <button
                              key={asset.key}
                              onClick={() => setPendingLogo(asset)}
                              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-[11px] font-medium transition cursor-grab ${selected ? 'border-blue-400/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 hover:bg-white/10 text-gray-200'}`}
                            >
                              <div className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden flex items-center justify-center">
                                <LogoPreview url={asset.url} className="w-full h-full" />
                              </div>
                              <span className="text-center leading-tight">{asset.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {pendingLogo && (
                      <div className="mt-3 text-xs text-amber-200 bg-amber-500/10 border border-amber-200/40 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                        <span>Cliquez sur la carte pour placer «&nbsp;{pendingLogo.label}&nbsp;»</span>
                        <button onClick={() => setPendingLogo(null)} className="text-[11px] font-semibold text-amber-100 hover:text-white transition-colors">
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">Logos placés</div>
                    {logoPlacements.length === 0 ? (
                      <div className="mt-3 text-sm text-gray-400 border border-dashed border-white/10 rounded-2xl px-3 py-4 bg-white/5">
                        Aucun logo n'est encore visible.
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {logoPlacements.map((placement) => {
                          const isSelected = placement.id === selectedLogoId;
                          return (
                            <div
                              key={placement.id}
                              className={`rounded-2xl border px-3 py-3 transition ${isSelected ? 'border-blue-400/70 bg-blue-500/10 shadow-lg' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedLogoId(placement.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedLogoId(placement.id);
                                  }
                                }}
                                className="w-full flex items-center gap-3 text-left cursor-pointer"
                              >
                              <div
                                className="w-10 h-10 rounded-xl overflow-hidden"
                              >
                                <LogoPreview url={placement.url} color={placement.color} className="w-full h-full" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-semibold text-white">{placement.label}</div>
                                <div className="text-xs text-gray-400">
                                  {placement.position[1].toFixed(4)} / {placement.position[0].toFixed(4)}
                                </div>
                                </div>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removePlacement(placement.id);
                                  }}
                                  className="text-xs font-semibold text-red-300 hover:text-red-200 transition"
                                >
                                  Supprimer
                                </button>
                              </div>

                              {isSelected && (
                                <div className="mt-3 space-y-3">
                                  <div>
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                                      <Maximize2 className="w-3.5 h-3.5" />
                                      <span>Taille</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-3">
                                      <input
                                        type="range"
                                        className="flex-1 accent-blue-400"
                                        min={32}
                                        max={160}
                                        step={2}
                                        value={placement.size}
                                        onChange={(event) => updatePlacement(placement.id, { size: Number(event.target.value) })}
                                      />
                                      <span className="w-12 text-right text-xs text-gray-300">{placement.size}px</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                                      <Palette className="w-3.5 h-3.5" />
                                      <span>Couleur</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-3">
                                      <input
                                        type="color"
                                        value={placement.color}
                                        onChange={(event) => updatePlacement(placement.id, { color: event.target.value })}
                                        className="h-10 w-16 rounded-xl border border-white/10 bg-transparent cursor-pointer"
                                      />
                                      <span className="text-xs text-gray-300 font-mono">{placement.color.toUpperCase()}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setToolbarOpen(true)}
              className={`pointer-events-auto absolute top-4 -left-3 rounded-2xl border border-white/10 bg-black/70 text-white shadow-xl p-2 transition ${toolbarOpen ? 'hidden' : 'flex'}`}
              aria-label="Ouvrir les outils"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>

        <div className="absolute z-20" style={infoStyle}>
          {weather && (
            <div className="pointer-events-auto bg-black/55 border border-white/10 rounded-2xl px-4 py-3 shadow-xl backdrop-blur-md inline-flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ThermometerSun className="w-4 h-4 text-orange-300" />
                <span>{Math.round(weather.temperature)}°C</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-200">
                <Droplets className="w-4 h-4 text-blue-300" />
                <span>{Math.round(weather.humidity)}% HR</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-200">
                <WindIcon className="w-4 h-4 text-cyan-300" />
                <span>{Math.round(weather.windSpeed)} km/h {weatherDirection}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SitacMap;
