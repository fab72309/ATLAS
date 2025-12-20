import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFavorites, toggleFavorite, NAV_ITEMS, FavoriteKey } from '../utils/favorites';
import { Star, Settings, Search, X, ChevronRight } from 'lucide-react';
import RoleBadgeIcon from './RoleBadgeIcon';
import ThemeSelector from './ThemeSelector';

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [favorites, setFav] = React.useState<FavoriteKey[]>(getFavorites());
  const [query, setQuery] = React.useState('');
  const [opsOpen, setOpsOpen] = React.useState(true);

  const filtered = React.useMemo(() => {
    const list = NAV_ITEMS;
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((n) => n.label.toLowerCase().includes(q));
  }, [query]);

  const handleToggle = (key: FavoriteKey) => setFav(toggleFavorite(key));

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className={`fixed inset-y-0 left-0 z-50 w-[300px] bg-white/95 dark:bg-[#0E1A2B]/95 backdrop-blur-xl border-r border-black/10 dark:border-white/10 flex flex-col transition-transform duration-300 ease-out shadow-2xl ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Header */}
        <div className="p-4 flex items-center gap-3 border-b border-black/10 dark:border-white/10">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 text-slate-500 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-slate-200 text-slate-900 placeholder-slate-500 dark:bg-white/5 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:text-white dark:placeholder-gray-500 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400/40 dark:focus:ring-white/20 transition-all"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          {/* Favorites Section */}
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">Favoris</div>
            <div className="space-y-1">
              {favorites.length === 0 && (
                <div className="text-slate-500 dark:text-gray-500 text-sm px-2 italic">Aucun favori épinglé</div>
              )}
              {favorites.map((key) => {
                const item = NAV_ITEMS.find((n) => n.key === key);
                if (!item) return null;
                return (
                  <div key={key} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${isActive(item.path) ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-white/5 dark:text-gray-300 dark:hover:text-white'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex-1 text-left flex items-center gap-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Operational Functions Section */}
          <div>
            <button
              onClick={() => setOpsOpen(v => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3 px-2 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <span>Fonctions opérationnelles</span>
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${opsOpen ? 'rotate-90' : ''}`} />
            </button>

            <div className={`space-y-1 overflow-hidden transition-all duration-300 ${opsOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {['group', 'column', 'site'].map((k) => {
                const item = NAV_ITEMS.find(n => n.key === k);
                if (!item) return null;
                const active = isActive(item.path);
                return (
                  <div key={k} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${active ? 'bg-blue-50 border border-blue-200 dark:bg-blue-600/20 dark:border-blue-500/30' : 'hover:bg-slate-100 border border-transparent dark:hover:bg-white/5'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex items-center gap-3 flex-1 text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-black/40 dark:group-hover:bg-black/60'}`}>
                        <RoleBadgeIcon role={k as any} className="w-6 h-6" />
                      </div>
                      <span className={`font-medium ${active ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 group-hover:text-slate-900 dark:text-gray-300 dark:group-hover:text-white'}`}>{item.label}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(item.key as FavoriteKey); }}
                      className={`p-1.5 rounded-lg transition-colors ${favorites.includes(item.key as FavoriteKey) ? 'text-yellow-500 hover:bg-yellow-200/40 dark:text-yellow-400 dark:hover:bg-yellow-400/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-white/5'}`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(item.key as FavoriteKey) ? 'fill-yellow-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Other Navigation Section */}
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">Navigation</div>
            <div className="space-y-1">
              {filtered.filter(n => !['group', 'column', 'site'].includes(n.key as any)).map((item) => {
                const active = isActive(item.path);
                return (
                  <div key={item.key} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-white/5 dark:text-gray-300 dark:hover:text-white'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex-1 text-left font-medium">{item.label}</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggle(item.key); }}
                      className={`p-1.5 rounded-lg transition-colors ${favorites.includes(item.key) ? 'text-yellow-500 hover:bg-yellow-200/40 dark:text-yellow-400 dark:hover:bg-yellow-400/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-white/5'}`}
                    >
                      <Star className={`w-4 h-4 ${favorites.includes(item.key) ? 'fill-yellow-400' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Theme Section */}
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">Apparence</div>
            <ThemeSelector variant="compact" className="px-2" />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 bg-slate-100/80 dark:bg-black/20">
          <button
            onClick={() => { navigate('/settings'); onClose(); }}
            className="w-full flex items-center gap-3 bg-slate-200/70 hover:bg-slate-300/80 active:bg-slate-300 rounded-xl px-4 py-3 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:active:bg-white/15 dark:text-gray-300 dark:hover:text-white transition-all duration-200 group"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            <span className="font-medium">Paramètres</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SideMenu;
