import React from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import {
    Minus, Square, Circle, Type, Eraser, Hexagon, ArrowRight,
    Image as ImageIcon, Hand, PenLine, Palette, ChevronLeft, ChevronRight
} from 'lucide-react';
import type { SymbolAsset } from '../../types/sitac';

interface SitacToolsSidebarProps {
    className?: string;
    symbolAssets: SymbolAsset[];
    activeSymbol: SymbolAsset | null;
    setActiveSymbol: (s: SymbolAsset) => void;
}

const ToolButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${active ? 'bg-black/60 border-white/40 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]' : 'bg-black/45 border-white/25 text-white/90 hover:bg-black/55 shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
            }`}
    >
        <span className="w-4 h-4">{icon}</span>
        <span>{label}</span>
    </button>
);

const SitacToolsSidebar: React.FC<SitacToolsSidebarProps> = ({
    symbolAssets,
    activeSymbol,
    setActiveSymbol
}) => {
    const mode = useSitacStore((s) => s.mode);
    const setMode = useSitacStore((s) => s.setMode);
    const lineStyle = useSitacStore((s) => s.lineStyle);
    const setLineStyle = useSitacStore((s) => s.setLineStyle);
    const drawingColor = useSitacStore((s) => s.drawingColor);
    const setColor = useSitacStore((s) => s.setColor);
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    return (
        <div className="absolute top-24 left-4 bottom-28 z-20 pointer-events-none">
            <div
                className={`pointer-events-auto relative h-full rounded-3xl transition-all duration-300 overflow-hidden flex flex-col ${isCollapsed
                    ? 'w-16 p-2 bg-white/10 border border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150'
                    : 'w-80 p-4 bg-white/10 border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150'
                    }`}
                aria-hidden={isCollapsed}
            >
                {isCollapsed && (
                    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-70" />
                )}
                {/* Header */}
                <div className={`relative z-10 flex items-center flex-shrink-0 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                    <div className={`text-sm font-semibold text-gray-900 ${isCollapsed ? 'sr-only' : ''}`}>SITAC</div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsCollapsed((prev) => !prev)}
                            className={`rounded-lg border transition-colors ${isCollapsed
                                ? 'p-2 bg-black/80 border-white/40 text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)] hover:bg-black/90'
                                : 'p-1.5 bg-black/45 border-white/25 text-white shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-black/55'
                                }`}
                            aria-label={isCollapsed ? 'Afficher le menu' : 'Masquer le menu'}
                            aria-expanded={!isCollapsed}
                            aria-controls="sitac-tools-content"
                            title={isCollapsed ? 'Afficher le menu' : 'Masquer le menu'}
                        >
                            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {!isCollapsed && (
                    <div id="sitac-tools-content" className="mt-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
                        {/* Tools */}
                        <div className="space-y-3">
                            <div className="text-xs uppercase tracking-widest text-gray-400">Outils</div>
                            <div className="grid grid-cols-2 gap-2">
                                <ToolButton icon={<Hand className="w-4 h-4" />} label="Sélection" active={mode === 'select' || mode === 'view'} onClick={() => setMode('select')} />
                                <ToolButton icon={<PenLine className="w-4 h-4" />} label="Pinceau" active={mode === 'draw_freehand'} onClick={() => setMode('draw_freehand')} />
                                <ToolButton icon={<Minus className="w-4 h-4" />} label="Ligne" active={mode === 'draw_line'} onClick={() => setMode('draw_line')} />
                                <ToolButton icon={<ArrowRight className="w-4 h-4" />} label="Flèche" active={mode === 'draw_arrow'} onClick={() => setMode('draw_arrow')} />
                                <ToolButton
                                    icon={<Square className="w-4 h-4" />}
                                    label="Rectangle"
                                    active={mode === 'draw_rect'}
                                    onClick={() => setMode('draw_rect')}
                                />
                                <ToolButton
                                    icon={<Circle className="w-4 h-4" />}
                                    label="Cercle"
                                    active={mode === 'draw_circle'}
                                    onClick={() => setMode('draw_circle')}
                                />
                                <ToolButton
                                    icon={<Hexagon className="w-4 h-4" />}
                                    label="Polygone"
                                    active={mode === 'draw_polygon'}
                                    onClick={() => setMode('draw_polygon')}
                                />
                                <ToolButton icon={<Type className="w-4 h-4" />} label="Texte" active={mode === 'draw_text'} onClick={() => setMode('draw_text')} />
                                <ToolButton icon={<ImageIcon className="w-4 h-4" />} label="Symbole" active={mode === 'draw_symbol'} onClick={() => setMode('draw_symbol')} />
                                <ToolButton icon={<Eraser className="w-4 h-4" />} label="Gomme" active={mode === 'erase'} onClick={() => setMode('erase')} />
                            </div>
                        </div>

                        {/* Line Style */}
                        <div className="space-y-2">
                            <div className="text-xs uppercase tracking-widest text-gray-400">Style de ligne</div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setLineStyle('solid')}
                                    className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'solid' ? 'bg-black/60 border-white/40 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]' : 'bg-black/45 border-white/25 text-white/90 hover:bg-black/55 shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
                                        }`}
                                >
                                    Plein
                                </button>
                                <button
                                    onClick={() => setLineStyle('dashed')}
                                    className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'dashed' ? 'bg-black/60 border-white/40 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]' : 'bg-black/45 border-white/25 text-white/90 hover:bg-black/55 shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
                                        }`}
                                >
                                    Pointillé
                                </button>
                                <button
                                    onClick={() => setLineStyle('dot-dash')}
                                    className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'dot-dash' ? 'bg-black/60 border-white/40 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]' : 'bg-black/45 border-white/25 text-white/90 hover:bg-black/55 shadow-[0_6px_16px_rgba(0,0,0,0.25)]'
                                        }`}
                                >
                                    Mixte
                                </button>
                            </div>
                        </div>

                        {/* Colors */}
                        <div className="space-y-3">
                            <div className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <Palette className="w-4 h-4" />
                                Couleur active
                            </div>
                            <div className="flex items-center gap-2">
                                {['#ef4444', '#111111', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map((color) => (
                                    <button
                                        key={color}
                                        onClick={() => setColor(color)}
                                        style={{ backgroundColor: color }}
                                        className={`w-8 h-8 rounded-xl border shadow-[0_4px_12px_rgba(0,0,0,0.4)] ${drawingColor === color ? 'border-white' : 'border-white/60'
                                            }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Symbols */}
                        <div className="space-y-2">
                            <div className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" />
                                Bibliothèque de symboles
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {symbolAssets.map((asset) => (
                                    <button
                                        key={asset.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('sitac/symbol', JSON.stringify(asset));
                                            e.dataTransfer.effectAllowed = 'copy';
                                            setActiveSymbol(asset);
                                            setMode('draw_symbol'); // Auto-lock map for drop
                                        }}
                                        onClick={() => {
                                            setActiveSymbol(asset);
                                            setMode('draw_symbol');
                                        }}
                                        className={`rounded-xl border px-2 py-2 flex flex-col items-center gap-1 text-[11px] ${activeSymbol?.id === asset.id
                                            ? 'border-blue-300/80 bg-black/45 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]'
                                            : 'border-white/25 bg-black/35 text-white/90 shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-black/45'
                                            } cursor-grab active:cursor-grabbing transition-colors`}
                                    >
                                        <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex items-center justify-center pointer-events-none">
                                            <img
                                                src={asset.url}
                                                alt={asset.label}
                                                className={`w-10 h-10 object-contain ${asset.colorizable === true ? 'filter invert' : ''}`}
                                            />
                                        </div>
                                        <span className="text-center leading-tight pointer-events-none">{asset.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SitacToolsSidebar;
