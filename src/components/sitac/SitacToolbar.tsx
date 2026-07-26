import React from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import { Undo2, Redo2, Trash2, Search, Layers, Lock, Unlock, ChevronLeft, ChevronRight, LocateFixed, MapPin, Loader2 } from 'lucide-react';
import type { BaseLayerKey } from '../../types/sitac';

interface SitacToolbarProps {
    baseLayer: BaseLayerKey;
    cycleBaseLayer: () => void;
    searchValue: string;
    setSearchValue: (val: string) => void;
    handleSearch: () => void;
    onLocateUser: () => void;
    onToggleInterventionPlacement: () => void;
    isLocating?: boolean;
    isMarking?: boolean;
    isPlacingIntervention?: boolean;
}

const SitacToolbar: React.FC<SitacToolbarProps> = ({
    baseLayer,
    cycleBaseLayer,
    searchValue,
    setSearchValue,
    handleSearch,
    onLocateUser,
    onToggleInterventionPlacement,
    isLocating = false,
    isMarking = false,
    isPlacingIntervention = false,
}) => {
    const undo = useSitacStore((s) => s.undo);
    const redoAction = useSitacStore((s) => s.redoAction);
    const clear = useSitacStore((s) => s.clear);
    const locked = useSitacStore((s) => s.locked);
    const toggleLock = useSitacStore((s) => s.toggleLock);
    const [isCollapsed, setIsCollapsed] = React.useState(false);

    return (
        <div className="absolute left-3 right-3 top-3 z-20 pointer-events-none lg:left-4 lg:right-[20.5rem] lg:top-4">
            <div
                className={`pointer-events-auto relative max-w-full rounded-2xl p-1.5 transition-all duration-300 ${isCollapsed
                    ? 'w-16 bg-white/10 border border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 overflow-hidden'
                    : 'w-full overflow-x-auto bg-white/10 border border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150'
                    }`}
            >
                {isCollapsed && (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/35 via-white/10 to-transparent opacity-70" />
                )}
                <div className={`relative z-10 flex items-center gap-1.5 ${isCollapsed ? 'w-full justify-center' : 'min-w-max'}`}>
                    {!isCollapsed && (
                        <>
                        <button
                            onClick={undo}
                            className="p-1.5 rounded-lg bg-black/45 hover:bg-black/55 text-white border border-white/25 shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                            aria-label="Annuler"
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={redoAction}
                            className="p-1.5 rounded-lg bg-black/45 hover:bg-black/55 text-white border border-white/25 shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                            aria-label="Rétablir"
                        >
                            <Redo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={clear}
                            className="p-1.5 rounded-lg bg-black/45 hover:bg-black/55 text-white border border-white/25 shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                            aria-label="Tout effacer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="h-6 w-px bg-white/10" />
                        <div className="flex items-center gap-2">
                            <input
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder="Recherche adresse ou lat,lng"
                                className="h-8 w-40 rounded-lg border border-white/25 bg-black/35 px-3 text-xs text-white/90 shadow-[0_6px_16px_rgba(0,0,0,0.25)] placeholder:text-gray-300 sm:w-48 xl:w-52"
                            />
                        <button
                            onClick={handleSearch}
                            className="p-1.5 rounded-lg bg-blue-500/90 hover:bg-blue-500 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                            aria-label="Rechercher l’adresse"
                            title="Rechercher l’adresse"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onLocateUser}
                            className="p-1.5 rounded-lg bg-black/45 hover:bg-black/55 text-white border border-white/25 shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                            aria-label="Se localiser"
                            title="Se localiser"
                        >
                            {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onToggleInterventionPlacement}
                            className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${isPlacingIntervention
                                ? 'bg-emerald-600/90 hover:bg-emerald-600'
                                : 'bg-emerald-500/90 hover:bg-emerald-500'
                                }`}
                            aria-label={isPlacingIntervention ? "Valider la position d'intervention" : "Positionner l'intervention"}
                            title={isPlacingIntervention ? "Valider la position d'intervention" : "Positionner l'intervention"}
                        >
                            {isMarking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                            {isPlacingIntervention ? 'Valider position' : 'Position intervention'}
                        </button>
                    </div>
                    <button
                        onClick={cycleBaseLayer}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-white/25 bg-black/45 px-2.5 text-xs text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] hover:bg-black/55"
                    >
                            <Layers className="w-4 h-4" />
                            {baseLayer === 'plan'
                                ? 'Plan'
                                : baseLayer === 'satellite'
                                    ? 'Satellite'
                                    : baseLayer === 'hybrid'
                                        ? 'Hybride'
                                    : baseLayer === 'whiteboard'
                                        ? 'Tableau blanc'
                                        : 'Offline'}
                        </button>
                        <button
                            onClick={toggleLock}
                            className={`p-1.5 rounded-lg border text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] ${locked
                                ? 'bg-red-600/80 hover:bg-red-600 border-red-400/70'
                                : 'bg-black/45 hover:bg-black/55 border-white/25'
                                }`}
                            aria-label={locked ? 'Déverrouiller la carte' : 'Verrouiller la carte'}
                            title={locked ? 'Déverrouiller la carte' : 'Verrouiller la carte'}
                        >
                            {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        </>
                    )}
                    <button
                        onClick={() => setIsCollapsed((prev) => !prev)}
                        className={`p-1.5 rounded-lg border transition-colors ${isCollapsed
                            ? 'bg-black/80 border-white/40 text-white shadow-[0_10px_28px_rgba(0,0,0,0.5)] hover:bg-black/90'
                            : 'bg-black/45 border-white/25 text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] hover:bg-black/55'
                            }`}
                        aria-label={isCollapsed ? 'Afficher la barre d’outils' : 'Masquer la barre d’outils'}
                        title={isCollapsed ? 'Afficher la barre d’outils' : 'Masquer la barre d’outils'}
                    >
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SitacToolbar;
