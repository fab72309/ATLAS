import React, { useCallback, useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapLibreWorker from 'maplibre-gl/dist/maplibre-gl-csp-worker?worker';

import { useSitacStore } from '../stores/useSitacStore';
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

(maplibregl as any).workerClass = MapLibreWorker;

const DEFAULT_VIEW = { center: [2.3522, 48.8566] as [number, number], zoom: 13 };

interface SitacMapProps {
  embedded?: boolean;
}

const SitacMap: React.FC<SitacMapProps> = ({ embedded = false }) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State from Store
  const geoJSON = useSitacStore((s) => s.geoJSON);
  const mode = useSitacStore((s) => s.mode);
  const selectedFeatureId = useSitacStore((s) => s.selectedFeatureId);
  const locked = useSitacStore((s) => s.locked);
  const addSnapshot = useSitacStore((s) => s.addSnapshot);
  const snapshots = useSitacStore((s) => s.snapshots);

  // Local State
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>('plan');
  const [searchValue, setSearchValue] = useState('');
  const [activeSymbol, setActiveSymbol] = useState<SymbolAsset | null>(SYMBOL_ASSETS[0] || null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);

  // Map Init Helper ---
  const cycleBaseLayer = () => {
    const baseOrder: BaseLayerKey[] = ['plan', 'satellite', 'whiteboard', 'offline'];
    const current = baseOrder.indexOf(baseLayer);
    const next = baseOrder[(current + 1) % baseOrder.length];
    setBaseLayer(next);
  };

  // --- Hook Integration ---
  useSitacDraw({ map: mapInstance, activeSymbol });

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
                  (f.properties as any).iconName === asset.id &&
                  (f.properties as any).colorizable !== true
              );
              if (needsUpdate) {
                const patched = {
                  ...state.geoJSON,
                  features: state.geoJSON.features.map((f) => {
                    if (
                      f.properties?.type === 'symbol' &&
                      (f.properties as any).iconName === asset.id &&
                      (f.properties as any).colorizable !== true
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
            map.addImage(imageId, sdf as any, { sdf: true });
          }
        } else {
          const imgEl = await loadImageElement(asset.url);
          if (!map.hasImage(imageId)) {
            map.addImage(imageId, imgEl as any, { sdf: false });
          }
        }
      } catch (err) {
        console.error('Icon load failure', err);
      }
    }
  }, []);

  const syncGeoJSONToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureLayers(map);
    const source = map.getSource(DRAW_SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(geoJSON);
      // Force repaint to prevent visibility flickering
      map.triggerRepaint();
    }
    setSelectionFilter(map, selectedFeatureId);
  }, [selectedFeatureId, geoJSON]);

  // Sync when GeoJSON changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncGeoJSONToMap();
  }, [geoJSON, selectedFeatureId, syncGeoJSONToMap]);

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
    if (!containerRef.current) return;
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
      syncGeoJSONToMap();
      ensureIcons();
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
      syncGeoJSONToMap();
      ensureIcons();
    });
  }, [baseLayer, ensureIcons, syncGeoJSONToMap]);

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

  // --- Handlers ---
  const handleHome = () => {
    mapRef.current?.flyTo({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, speed: 0.8 });
  };

  const handleSearch = () => {
    const map = mapRef.current;
    if (!map) return;
    const match = searchValue.match(/(-?\\d+(?:\\.\\d+)?)[,\\s]+(-?\\d+(?:\\.\\d+)?)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      map.flyTo({ center: [lng, lat], zoom: 15, speed: 0.9 });
    }
  };

  const handleSnapshot = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    addSnapshot({
      id: `S${snapshots.length + 1}`,
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
    });
  };

  const containerHeightClass = embedded ? 'h-[70vh]' : 'h-screen';

  return (
    <div className={`relative ${embedded ? 'rounded-2xl overflow-hidden border border-white/5' : ''}`}>
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
          mapRef={mapRef}
          baseLayer={baseLayer}
          setBaseLayer={setBaseLayer}
          cycleBaseLayer={cycleBaseLayer}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          handleSearch={handleSearch}
          handleHome={handleHome}
        />

        <SitacToolsSidebar
          baseLayer={baseLayer}
          setBaseLayer={setBaseLayer}
          symbolAssets={SYMBOL_ASSETS}
          activeSymbol={activeSymbol}
          className="z-20"
          onReset={() => {
            useSitacStore.getState().setGeoJSON({ type: 'FeatureCollection', features: [] });
            window.location.reload();
          }}
          onExportImage={async () => {
            const mapCanvas = mapInstance?.getCanvas();
            // Fabric canvas is overlaid. We need to find it.
            // We can find the canvas element inside the component's container.
            // But simpler: capture the whole screen logic? No, sidebar is there.
            // Let's composite.
            const fabricCvs = document.querySelector('.lower-canvas') as HTMLCanvasElement;

            if (mapCanvas && fabricCvs) {
              const width = mapCanvas.width;
              const height = mapCanvas.height;

              const composite = document.createElement('canvas');
              composite.width = width;
              composite.height = height;
              const ctx = composite.getContext('2d');
              if (!ctx) return;

              // Draw Map
              ctx.drawImage(mapCanvas, 0, 0);

              // Draw Fabric (which should be same size)
              // Fabric canvas might be scaled by devicePixelRatio.
              // MapLibre handle it too.
              // Just draw it on top.
              ctx.drawImage(fabricCvs, 0, 0);

              // Download
              const link = document.createElement('a');
              link.download = `sitac-atlas-${Date.now()}.png`;
              link.href = composite.toDataURL('image/png');
              link.click();
            }
          }}
          onExportPDF={async () => {
            // Reuse Image logic then Print
            const mapCanvas = mapInstance?.getCanvas();
            const fabricCvs = document.querySelector('.lower-canvas') as HTMLCanvasElement;

            if (mapCanvas && fabricCvs) {
              const composite = document.createElement('canvas');
              composite.width = mapCanvas.width;
              composite.height = mapCanvas.height;
              const ctx = composite.getContext('2d');
              if (!ctx) return;
              ctx.drawImage(mapCanvas, 0, 0);
              ctx.drawImage(fabricCvs, 0, 0);

              const imgData = composite.toDataURL('image/png');

              // Open Print Window
              const win = window.open('', '_blank');
              if (win) {
                win.document.write(`<html><head><title>SITAC Export</title></head><body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;"><img src="${imgData}" style="max-width:100%; max-height:100%;" /></body></html>`);
                win.document.close();
                setTimeout(() => {
                  win.focus();
                  win.print();
                  // win.close(); // Optional
                }, 500);
              }
            }
          }}
          setActiveSymbol={setActiveSymbol}
        />

        <SitacEditControls
          handleSnapshot={handleSnapshot}
          restoreSnapshot={(snap) => {
            if (!mapInstance) return;
            mapInstance.jumpTo({ center: snap.center, zoom: snap.zoom });
            useSitacStore.setState({ geoJSON: snap.data });
          }}
        />
      </div>
    </div>
  );
};

export default SitacMap;
