
import React, { useMemo } from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import {
    RotateCcw, RotateCw, Trash2, Download, Camera
} from 'lucide-react';
import { rotateGeometry } from '../../utils/sitacUtils';
import type { Snapshot } from '../../types/sitac';

interface SitacEditControlsProps {
    handleSnapshot: () => void;
    handleExport: () => void;
    restoreSnapshot: (snap: Snapshot) => void;
}

const SitacEditControls: React.FC<SitacEditControlsProps> = ({
    handleSnapshot,
    handleExport,
    restoreSnapshot,
}) => {
    const selectedFeatureId = useSitacStore((s) => s.selectedFeatureId);
    const selectedFabricProperties = useSitacStore((s) => s.selectedFabricProperties);
    const geoJSON = useSitacStore((s) => s.geoJSON);
    const updateFeature = useSitacStore((s) => s.updateFeature);
    const updateFabricObject = useSitacStore((s) => s.updateFabricObject); // New action
    // const deleteFeature = useSitacStore((s) => s.deleteFeature); // Unused for now as we handle delete via Fabric logic or keyboard
    // For fabric delete, we might need a signal or just use keyboard. 
    // Actually, buttons in menu should work too. 
    // I can add deleteFabricObject to store or just trigger via special prop update?
    // Let's rely on keyboard for now for Fabric delete, or better, add 'delete' to updateFabricObject? No.
    // I need a way to delete from button.
    // Let's add deleteFabricObject action to store temporarily or use a hack.
    // Actually, I can use window event or similar? No, store action is cleaner.
    // I'll skip button delete for Fabric for a second and focus on Color/Rotate.

    const snapshots = useSitacStore((s) => s.snapshots);

    const selectedFeature = useMemo(
        () => geoJSON.features.find((f) => f.id === selectedFeatureId),
        [geoJSON.features, selectedFeatureId]
    );

    // Unified Props
    const activeProps = selectedFabricProperties || (selectedFeature?.properties);
    const isFabric = !!selectedFabricProperties;

    const handleColorChange = (val: string) => {
        if (isFabric) {
            updateFabricObject({ color: val });
        } else if (selectedFeature) {
            updateFeature(selectedFeature.id as string, (f) => ({ ...f, properties: { ...f.properties, color: val } }));
        }
    };

    const handleRotate = (angle: number) => {
        if (isFabric) {
            // Fabric handles rotation natively via box, but slider is requested?
            // Fabric object stores angle.
            updateFabricObject({ rotation: angle }); // Need to sync this property from canvas
        } else if (selectedFeature) {
            updateFeature(selectedFeature.id as string, (feat) => ({
                ...feat,
                properties: { ...feat.properties, rotation: angle },
                geometry: feat.geometry.type === 'Point' ? feat.geometry : rotateGeometry(feat.geometry, angle),
            }));
        }
    };

    // Scale and Delete need special handling.
    // For now, let's just make Color work perfectly for Fabric.

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center gap-3 w-full max-w-3xl px-4">

            {/* Selection Editor Bar */}
            {activeProps && (
                <div className="bg-[#1a1a1a]/90 border border-white/10 rounded-2xl p-2 backdrop-blur-md shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="flex items-center gap-2 pl-2 border-r border-white/10 pr-4">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            {(activeProps.type === 'polygon' || activeProps.type === 'rect') ? 'RECTANGLE' : activeProps.type || 'Element'}
                        </span>
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 p-1">
                        <input
                            type="color"
                            value={activeProps.color || '#3b82f6'}
                            onChange={(e) => handleColorChange(e.target.value)}
                            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                    </div>

                    <div className="w-px h-6 bg-white/10 mx-1" />

                    {/* Line Style (only for shapes/lines) */}
                    {activeProps.type !== 'text' && activeProps.type !== 'symbol' && (
                        <select
                            value={activeProps.lineStyle || 'solid'}
                            onChange={(e) => isFabric ? updateFabricObject({ lineStyle: e.target.value as any }) : null}
                            className="bg-white/5 border border-white/5 text-xs text-gray-300 rounded-lg h-7 px-1 outline-none focus:bg-white/10"
                        >
                            <option value="solid">Trait plein</option>
                            <option value="dashed">Pointillés</option>
                            <option value="dot-dash">Mixte</option>
                        </select>
                    )}

                    <div className="w-px h-6 bg-white/10 mx-1" />                  {!isFabric && (
                        <div className="flex items-center gap-2">
                            <RotateCcw className="w-4 h-4 text-gray-400" />
                            <input
                                type="range"
                                min={0}
                                max={360}
                                value={activeProps.rotation ?? 0}
                                onChange={(e) => handleRotate(Number(e.target.value))}
                                className="w-24 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    )}

                    {/* For Fabric, user uses handles for rotation/scale. */}

                    {/* Delete & Rotate for Fabric */}
                    {isFabric && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                            <button
                                onClick={() => {
                                    // Robust delete via store action
                                    useSitacStore.getState().setFabricAction({ type: 'delete' });
                                }}
                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                title="Supprimer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => {
                                    // Rotate -15 degrees
                                    const currentRot = activeProps.rotation || 0;
                                    updateFabricObject({ rotation: (currentRot - 15) % 360 });
                                }}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                                title="Pivoter -15°"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => {
                                    // Rotate +15 degrees
                                    const currentRot = activeProps.rotation || 0;
                                    updateFabricObject({ rotation: (currentRot + 15) % 360 });
                                }}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                                title="Pivoter +15°"
                            >
                                <RotateCw className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Global Bottom Bar (Snapshots & Export) */}
            <div className="flex items-center justify-between w-full">
                {/* Snapshots Mini-Gallery */}
                <div className="flex gap-2 bg-black/50 p-1.5 rounded-xl border border-white/5 backdrop-blur-sm">
                    <button
                        onClick={handleSnapshot}
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/10 transition"
                        title="Prendre un snapshot"
                    >
                        <Camera className="w-4 h-4" />
                    </button>
                    {snapshots.map((snap, i) => (
                        <button
                            key={snap.id}
                            onClick={() => restoreSnapshot(snap)}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] text-gray-300"
                        >
                            Snap {i + 1}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 hover:bg-blue-600 rounded-xl text-white text-xs font-semibold shadow-lg backdrop-blur-sm transition-all hover:scale-105"
                >
                    <Download className="w-3 h-3" />
                    Export
                </button>
            </div>
        </div>
    );
};

export default SitacEditControls;
