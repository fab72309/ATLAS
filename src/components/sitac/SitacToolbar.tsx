import React from 'react';
import { useSitacStore } from '../../stores/useSitacStore';
import { Undo2, Redo2, Trash2, Search, Target, Layers, Lock, Unlock, Home } from 'lucide-react';
import type { BaseLayerKey } from '../../types/sitac';

interface SitacToolbarProps {
    mapRef: React.MutableRefObject<any>;
    baseLayer: BaseLayerKey;
    setBaseLayer: (layer: BaseLayerKey) => void;
    cycleBaseLayer: () => void;
    searchValue: string;
    setSearchValue: (val: string) => void;
    handleSearch: () => void;
    handleHome: () => void;
}

const SitacToolbar: React.FC<SitacToolbarProps> = ({
    mapRef,
    baseLayer,
    cycleBaseLayer,
    searchValue,
    setSearchValue,
    handleSearch,
    handleHome,
}) => {
    const undo = useSitacStore((s) => s.undo);
    const redoAction = useSitacStore((s) => s.redoAction);
    const clear = useSitacStore((s) => s.clear);
    const locked = useSitacStore((s) => s.locked);
    const toggleLock = useSitacStore((s) => s.toggleLock);

    const handleGPS = () => {
        const map = mapRef.current;
        if (!map) return;
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 16, speed: 0.9 });
            });
        }
    };

    return (
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center gap-3 pointer-events-auto">
            <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-2xl px-3 py-2 backdrop-blur">
                <button
                    onClick={undo}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    aria-label="Annuler"
                >
                    <Undo2 className="w-4 h-4" />
                </button>
                <button
                    onClick={redoAction}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    aria-label="Rétablir"
                >
                    <Redo2 className="w-4 h-4" />
                </button>
                <button
                    onClick={clear}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
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
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white/90 placeholder:text-gray-400 w-52 md:w-72"
                    />
                    <button
                        onClick={handleSearch}
                        className="px-3 py-2 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white text-sm font-semibold"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <button
                    onClick={handleGPS}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    aria-label="GPS"
                >
                    <Target className="w-4 h-4" />
                </button>
                <button
                    onClick={cycleBaseLayer}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-sm flex items-center gap-2"
                >
                    <Layers className="w-4 h-4" />
                    {baseLayer === 'plan'
                        ? 'Plan'
                        : baseLayer === 'satellite'
                            ? 'Satellite'
                            : baseLayer === 'whiteboard'
                                ? 'Tableau blanc'
                                : 'Offline'}
                </button>
                <button
                    onClick={toggleLock}
                    className={`p-2 rounded-xl border text-white ${locked ? 'bg-amber-500/20 border-amber-400/50' : 'bg-white/5 border-white/10'
                        }`}
                    aria-label="Verrouillage de la navigation"
                >
                    {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>
                <button
                    onClick={handleHome}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
                    aria-label="Vue initiale"
                >
                    <Home className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default SitacToolbar;
