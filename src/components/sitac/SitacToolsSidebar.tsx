import React from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import {
    Minus, Square, Circle, Type, Eraser, Hexagon, ArrowRight,
    Wand2, Save, Image as ImageIcon, FileText, Trash2, Hand, PenLine, Palette
} from 'lucide-react';
import type { BaseLayerKey, SymbolAsset } from '../../types/sitac';

interface SitacToolsSidebarProps {
    className?: string;
    onReset?: () => void;
    onExportImage?: () => void;
    onExportPDF?: () => void;
    baseLayer: BaseLayerKey;
    setBaseLayer: (layer: BaseLayerKey) => void;
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
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${active ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
            }`}
    >
        <span className="w-4 h-4">{icon}</span>
        <span>{label}</span>
    </button>
);

const SitacToolsSidebar: React.FC<SitacToolsSidebarProps> = ({
    baseLayer,
    setBaseLayer,
    symbolAssets,
    activeSymbol,
    setActiveSymbol,
    onReset,
    onExportImage,
    onExportPDF
}) => {
    const mode = useSitacStore((s) => s.mode);
    const setMode = useSitacStore((s) => s.setMode);
    const lineStyle = useSitacStore((s) => s.lineStyle);
    const setLineStyle = useSitacStore((s) => s.setLineStyle);
    const drawingColor = useSitacStore((s) => s.drawingColor);
    const setColor = useSitacStore((s) => s.setColor);

    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    return (
        <div className="absolute top-24 left-4 bottom-28 z-20 pointer-events-auto">
            <div className="w-80 h-full bg-black/70 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-md p-4 flex flex-col gap-4 overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                        <Wand2 className="w-4 h-4 text-blue-300" />
                        Easy Draw
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setBaseLayer('plan')}
                            className={`px-2 py-1 rounded-lg text-xs border ${baseLayer === 'plan' ? 'bg-white/20 text-white border-white/40' : 'bg-white/5 text-gray-300 border-white/10'
                                }`}
                        >
                            Plan
                        </button>
                        <button
                            onClick={() => setBaseLayer('satellite')}
                            className={`px-2 py-1 rounded-lg text-xs border ${baseLayer === 'satellite' ? 'bg-white/20 text-white border-white/40' : 'bg-white/5 text-gray-300 border-white/10'
                                }`}
                        >
                            Sat
                        </button>
                        <button
                            onClick={() => setBaseLayer('whiteboard')}
                            className={`px-2 py-1 rounded-lg text-xs border ${baseLayer === 'whiteboard' ? 'bg-white/20 text-white border-white/40' : 'bg-white/5 text-gray-300 border-white/10'
                                }`}
                        >
                            Tableau
                        </button>
                    </div>
                </div>

                {/* Export / Reset Menu */}
                <div className="absolute top-4 right-2 z-20">
                    <div className="relative">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 flex flex-col gap-1">
                                <button
                                    onClick={() => { onExportImage?.(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg transition-colors text-left"
                                >
                                    <ImageIcon className="w-4 h-4 text-blue-400" />
                                    Sauver Image
                                </button>
                                <button
                                    onClick={() => { onExportPDF?.(); setIsMenuOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg transition-colors text-left"
                                >
                                    <FileText className="w-4 h-4 text-orange-400" />
                                    Sauver PDF
                                </button>
                                <div className="h-px bg-white/10 my-1" />
                                <button
                                    onClick={() => {
                                        if (confirm('Êtes-vous sûr de vouloir tout effacer ? Cette action est irréversible.')) {
                                            onReset?.();
                                            setIsMenuOpen(false);
                                        }
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-left"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Tout effacer
                                </button>
                            </div>
                        )}
                    </div>
                </div>

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
                        />        <ToolButton icon={<Type className="w-4 h-4" />} label="Texte" active={mode === 'draw_text'} onClick={() => setMode('draw_text')} />
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
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'solid' ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-200'
                                }`}
                        >
                            Plein
                        </button>
                        <button
                            onClick={() => setLineStyle('dashed')}
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'dashed' ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-200'
                                }`}
                        >
                            Pointillé
                        </button>
                        <button
                            onClick={() => setLineStyle('dot-dash')}
                            className={`flex-1 px-3 py-2 rounded-xl border text-sm ${lineStyle === 'dot-dash' ? 'bg-white/20 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-200'
                                }`}
                        >
                            Dot-dash
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
                        {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#111111'].map((color) => (
                            <button
                                key={color}
                                onClick={() => setColor(color)}
                                style={{ backgroundColor: color }}
                                className={`w-8 h-8 rounded-xl border ${drawingColor === color ? 'border-white' : 'border-white/20'
                                    }`}
                            />
                        ))}
                        <input
                            type="color"
                            value={drawingColor}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-12 h-8 rounded-xl border border-white/20 bg-transparent"
                        />
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
                                    ? 'border-blue-400/60 bg-blue-500/10 text-white'
                                    : 'border-white/10 bg-white/5 text-gray-200'
                                    } cursor-grab active:cursor-grabbing hover:bg-white/10 transition-colors`}
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
        </div>
    );
};

export default SitacToolsSidebar;
