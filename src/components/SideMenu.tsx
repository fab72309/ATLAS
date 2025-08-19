import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getFavorites, toggleFavorite, NAV_ITEMS, FavoriteKey } from '../utils/favorites';
import { Star, Settings, Search, X, ChevronRight } from 'lucide-react';
import RoleBadgeIcon from './RoleBadgeIcon';

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
    <div className={`fixed inset-y-0 left-0 z-40 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="h-full w-[280px] bg-[#0E1A2B] border-r border-white/10 flex flex-col">
        <div className="p-3 flex items-center gap-2 border-b border-white/10">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white absolute left-2 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Rechercher" className="w-full bg-white/10 text-white placeholder-white/60 rounded pl-7 pr-2 py-1.5 text-sm focus:outline-none" />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-3 text-white text-sm">
          <div className="mb-2 font-semibold">Favoris</div>
          <div className="space-y-2 mb-4">
            {favorites.length === 0 && (
              <div className="text-white/60">Aucun favori</div>
            )}
            {favorites.map((key) => {
              const item = NAV_ITEMS.find((n)=>n.key===key);
              if (!item) return null;
              return (
                <button key={key} onClick={()=>navigate(item.path)} className={`w-full flex items-center justify-between bg-white/10 hover:bg-white/15 rounded-full px-2 py-1.5 ${isActive(item.path)?'ring-2 ring-white/50':''}`}>
                  <span className="inline-flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mb-2 font-semibold">Fonctions opérationnelles</div>
          <button onClick={()=>setOpsOpen(v=>!v)} className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded px-2 py-1.5 mb-2">
            <ChevronRight className={`w-4 h-4 transition-transform ${opsOpen?'rotate-90':''}`} />
            <span>Fonctions opérationnelles</span>
          </button>
          {opsOpen && (
            <div className="space-y-1 mb-4">
              {['group','column','site','security','supply'].map((k)=>{
                const item = NAV_ITEMS.find(n=>n.key===k);
                if (!item) return null;
                return (
                  <div key={k} className={`flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-full px-2 py-1.5 ${isActive(item.path)?'ring-2 ring-white/50':''}`}>
                    <button onClick={()=>navigate(item.path)} className="flex items-center gap-2 flex-1 text-left">
                      <div className="w-6 h-5 bg-black rounded flex items-center justify-center">
                        {k==='group' && <RoleBadgeIcon role="group" className="w-5 h-5" />}
                        {k==='column' && <RoleBadgeIcon role="column" className="w-5 h-5" />}
                        {k==='site' && <RoleBadgeIcon role="site" className="w-5 h-5" />}
                        {k==='security' && <img src="/icons/Officier_securite.png" alt="" className="w-5 h-5 object-contain" />}
                        {k==='supply' && <img src="/icons/Officier_alimentation.png" alt="" className="w-5 h-5 object-contain" />}
                      </div>
                      <span>{item.label}</span>
                    </button>
                    <button onClick={()=>handleToggle(item.key as FavoriteKey)} className="p-1 hover:bg-white/10 rounded">
                      <Star className={`w-4 h-4 ${favorites.includes(item.key as FavoriteKey)?'text-yellow-300 fill-yellow-300':'text-white'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-2 font-semibold">Navigation</div>
          <div className="space-y-1">
            {filtered.filter(n=>!['group','column','site','security','supply'].includes(n.key as any)).map((item) => (
              <div key={item.key} className={`flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-full px-2 py-1.5 ${isActive(item.path)?'ring-2 ring-white/50':''}`}>
                <button onClick={()=>navigate(item.path)} className="flex-1 text-left">{item.label}</button>
                <button onClick={()=>handleToggle(item.key)} className="p-1 hover:bg-white/10 rounded">
                  <Star className={`w-4 h-4 ${favorites.includes(item.key)?'text-yellow-300 fill-yellow-300':'text-white'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto p-3 border-t border-white/10">
          <button onClick={()=>navigate('/settings')} className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded px-2 py-1.5 text-white">
            <Settings className="w-4 h-4" />
            Paramètres
          </button>
        </div>
      </div>
    </div>
  );
};

export default SideMenu;


