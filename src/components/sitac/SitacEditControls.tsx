
import React, { useMemo } from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import {
    RotateCcw,
    RotateCw,
    Trash2,
    Download,
    Image as ImageIcon,
    FileText,
    Maximize2,
    Minimize2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Camera,
    Copy
} from 'lucide-react';
import { rotateGeometry } from '../../utils/sitacUtils';

const COLOR_OPTIONS = ['#ef4444', '#111111', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

interface SitacEditControlsProps {
    handleExport: () => void;
    onExportImage?: () => void;
    onExportPDF?: () => void;
    onSnapshot?: () => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
}

const SitacEditControls: React.FC<SitacEditControlsProps> = ({
    handleExport,
    onExportImage,
    onExportPDF,
    onSnapshot,
    onToggleFullscreen,
    isFullscreen,
}) => {
    const selectedFeatureId = useSitacStore((s) => s.selectedFeatureId);
    const selectedFabricProperties = useSitacStore((s) => s.selectedFabricProperties);
    const geoJSON = useSitacStore((s) => s.geoJSON);
    const updateFeature = useSitacStore((s) => s.updateFeature);
    const duplicateFeature = useSitacStore((s) => s.duplicateFeature);
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

    const [isExportOpen, setIsExportOpen] = React.useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = React.useState(false);

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
    const activeColor = activeProps?.color || COLOR_OPTIONS[0];

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
        <div className="absolute inset-0 z-20 pointer-events-none">
            {/* Selection Editor Bar */}
            {activeProps && (
                <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#1a1a1a]/90 border border-white/10 rounded-2xl p-2 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className="flex items-center gap-2 pl-2 border-r border-white/10 pr-4">
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                            {(activeProps.type === 'polygon' || activeProps.type === 'rect') ? 'RECTANGLE' : activeProps.type || 'Element'}
                        </span>
                    </div>

                    {/* Color */}
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 p-1">
                        {COLOR_OPTIONS.map((color) => (
                            <button
                                key={color}
                                onClick={() => handleColorChange(color)}
                                style={{ backgroundColor: color }}
                                className={`w-5 h-5 rounded border ${activeColor === color ? 'border-white' : 'border-white/20'
                                    }`}
                                aria-label={`Couleur ${color}`}
                            />
                        ))}
                    </div>

                    <div className="w-px h-6 bg-white/10 mx-1" />

                    {/* Line Style (only for shapes/lines) */}
                    {activeProps.type !== 'text' && activeProps.type !== 'symbol' && (
                        <select
                            value={activeProps.lineStyle || 'solid'}
                            onChange={(e) => {
                                const nextStyle = e.target.value as 'solid' | 'dashed' | 'dot-dash';
                                if (isFabric) {
                                    updateFabricObject({ lineStyle: nextStyle });
                                } else if (selectedFeature) {
                                    updateFeature(selectedFeature.id as string, (f) => ({
                                        ...f,
                                        properties: { ...f.properties, lineStyle: nextStyle },
                                    }));
                                }
                            }}
                            className="bg-white/5 border border-white/5 text-xs text-gray-300 rounded-lg h-7 px-1 outline-none focus:bg-white/10"
                        >
                            <option value="solid">Trait plein</option>
                            <option value="dashed">Pointillés</option>
                            <option value="dot-dash">Mixte</option>
                        </select>
                    )}

                    <div className="w-px h-6 bg-white/10 mx-1" />
                    {!isFabric && (
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

                    {/* Delete & Rotate for Fabric */}
                    {isFabric && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                            <button
                                onClick={() => {
                                    useSitacStore.getState().setFabricAction({ type: 'duplicate' });
                                }}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                                title="Dupliquer — Shift+Alt+D"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    useSitacStore.getState().setFabricAction({ type: 'delete' });
                                }}
                                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                title="Supprimer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <button
                                onClick={() => {
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
                    {!isFabric && selectedFeature && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-2">
                            <button
                                onClick={() => duplicateFeature(String(selectedFeature.id))}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-colors"
                                title="Dupliquer — Shift+Alt+D"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Right Bar (Save / Export / Fullscreen) */}
            <div className="pointer-events-auto absolute top-4 right-4 flex items-center gap-2">
                <div
                    className={`relative flex items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-300 ${isRightCollapsed
                        ? 'w-16 bg-white/10 border border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 overflow-hidden'
                        : 'bg-white/10 border border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150'
                        }`}
                >
                    {isRightCollapsed && (
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-70" />
                    )}
                    <div className={`relative z-10 flex items-center gap-2 ${isRightCollapsed ? 'w-full justify-center' : ''}`}>
                        <button
                            onClick={() => {
                                setIsExportOpen(false);
                                setIsRightCollapsed((prev) => !prev);
                            }}
                            className={`p-2 rounded-lg border transition-colors ${isRightCollapsed
                                ? 'bg-black/80 border-white/40 text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)] hover:bg-black/90'
                                : 'bg-black/45 border-white/25 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] hover:bg-black/55'
                                }`}
                            aria-label={isRightCollapsed ? 'Afficher la barre de droite' : 'Masquer la barre de droite'}
                            title={isRightCollapsed ? 'Afficher la barre de droite' : 'Masquer la barre de droite'}
                        >
                            {isRightCollapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        {!isRightCollapsed && (
                            <>
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setIsExportOpen((prev) => !prev);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/90 hover:bg-blue-600 rounded-xl text-white text-xs font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all hover:scale-105"
                                        aria-label="Exporter"
                                    >
                                        <Download className="w-3 h-3" />
                                        Export
                                        <ChevronDown className="w-3 h-3 opacity-80" />
                                    </button>
                                    {isExportOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 flex flex-col gap-1">
                                            <button
                                                onClick={() => {
                                                    onExportImage?.();
                                                    setIsExportOpen(false);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg transition-colors text-left"
                                            >
                                                <ImageIcon className="w-4 h-4 text-blue-400" />
                                                Exporter image
                                            </button>
                                            <button
                                                onClick={() => {
                                                    (onExportPDF || handleExport)();
                                                    setIsExportOpen(false);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg transition-colors text-left"
                                            >
                                                <FileText className="w-4 h-4 text-orange-400" />
                                                Exporter PDF
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={onToggleFullscreen}
                                    className="flex items-center gap-2 px-3 py-2 bg-black/45 hover:bg-black/55 border border-white/25 rounded-xl text-white text-xs font-semibold shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all hover:scale-105"
                                    title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                                    aria-label={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                                >
                                    {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                    {isFullscreen ? 'Quitter' : 'Plein écran'}
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => {
                                            setIsExportOpen(false);
                                            onSnapshot?.();
                                        }}
                                        className="p-2 bg-black/45 hover:bg-black/55 text-white border border-white/25 rounded-xl shadow-[0_6px_18px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-all hover:scale-105"
                                        aria-label="Snapshot"
                                        title="Snapshot"
                                    >
                                        <Camera className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SitacEditControls;
