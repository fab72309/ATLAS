import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS, type FavoriteKey } from '../utils/favorites';
import { Star, Settings, Search, X, ChevronRight, LogOut } from 'lucide-react';
import RoleBadgeIcon from './RoleBadgeIcon';
import { useProfile } from '../contexts/ProfileContext';
import { EMPLOYMENT_LEVEL_OPTIONS, SHORTCUT_OPTIONS, type ShortcutKey } from '../constants/profile';
import { useAuth } from '../contexts/AuthContext';

const SHORTCUT_TO_NAV_KEY: Record<ShortcutKey, FavoriteKey> = {
  functions: 'functions',
  communication: 'communication',
  operational_zoning: 'zoning',
  sitac: 'sitac',
  oct: 'oct'
};

const NAV_TO_SHORTCUT_KEY: Partial<Record<FavoriteKey, ShortcutKey>> = {
  functions: 'functions',
  communication: 'communication',
  zoning: 'operational_zoning',
  sitac: 'sitac',
  oct: 'oct'
};

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState('');
  const [opsOpen, setOpsOpen] = React.useState(true);
  const [shortcutSaving, setShortcutSaving] = React.useState(false);
  const opsKeys = ['group', 'column', 'site'] as const;
  const { profile, updateProfile } = useProfile();
  const { logout, user } = useAuth();

  const filtered = React.useMemo(() => {
    const list = NAV_ITEMS;
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((n) => n.label.toLowerCase().includes(q));
  }, [query]);

  const isActive = (path: string) => location.pathname === path;

  const shortcutKeys = React.useMemo(() => {
    const keys = (profile?.shortcut_keys || []) as string[];
    return keys.filter((key): key is ShortcutKey => SHORTCUT_OPTIONS.some((option) => option.key === key));
  }, [profile]);

  const favoriteKeySet = React.useMemo(() => {
    const mapped = shortcutKeys.map((key) => SHORTCUT_TO_NAV_KEY[key]);
    return new Set<FavoriteKey>(mapped);
  }, [shortcutKeys]);

  const favoriteItems = React.useMemo(
    () => NAV_ITEMS.filter((item) => favoriteKeySet.has(item.key)),
    [favoriteKeySet]
  );

  const profileName = React.useMemo(() => {
    const parts = [profile?.first_name, profile?.last_name].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    return user?.email || 'Utilisateur';
  }, [profile?.first_name, profile?.last_name, user?.email]);

  const employmentLabel = React.useMemo(() => {
    const match = EMPLOYMENT_LEVEL_OPTIONS.find((option) => option.value === profile?.employment_level);
    return match?.label || 'Fonction non définie';
  }, [profile?.employment_level]);

  const roleBadge = React.useMemo((): 'group' | 'column' | 'site' | null => {
    switch (profile?.employment_level) {
      case 'chef_de_groupe':
        return 'group';
      case 'chef_de_colonne':
        return 'column';
      case 'chef_de_site':
        return 'site';
      default:
        return null;
    }
  }, [profile?.employment_level]);

  const handleToggleShortcut = async (key: FavoriteKey) => {
    const shortcutKey = NAV_TO_SHORTCUT_KEY[key];
    if (!shortcutKey || !profile || shortcutSaving) return;
    const next = new Set(shortcutKeys);
    if (next.has(shortcutKey)) {
      next.delete(shortcutKey);
    } else {
      next.add(shortcutKey);
    }
    setShortcutSaving(true);
    await updateProfile({ shortcut_keys: Array.from(next) });
    setShortcutSaving(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      onClose();
    } catch (error) {
      console.error('Erreur déconnexion', error);
    }
  };

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
              {favoriteItems.length === 0 && (
                <div className="text-slate-500 dark:text-gray-500 text-sm px-2 italic">Aucun favori épinglé</div>
              )}
              {favoriteItems.map((item) => {
                return (
                  <div key={item.key} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${isActive(item.path) ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-white/5 dark:text-gray-300 dark:hover:text-white'}`}>
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
              {opsKeys.map((k) => {
                const item = NAV_ITEMS.find(n => n.key === k);
                if (!item) return null;
                const active = isActive(item.path);
                return (
                  <div key={k} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${active ? 'bg-blue-50 border border-blue-200 dark:bg-blue-600/20 dark:border-blue-500/30' : 'hover:bg-slate-100 border border-transparent dark:hover:bg-white/5'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex items-center gap-3 flex-1 text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-black/40 dark:group-hover:bg-black/60'}`}>
                        <RoleBadgeIcon role={k} className="w-6 h-6" />
                      </div>
                      <span className={`font-medium ${active ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 group-hover:text-slate-900 dark:text-gray-300 dark:group-hover:text-white'}`}>{item.label}</span>
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
              {filtered.filter((n) => !opsKeys.includes(n.key as (typeof opsKeys)[number])).map((item) => {
                const active = isActive(item.path);
                return (
                  <div key={item.key} className={`group flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 ${active ? 'bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:hover:bg-white/5 dark:text-gray-300 dark:hover:text-white'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex-1 text-left font-medium">{item.label}</button>
                    {NAV_TO_SHORTCUT_KEY[item.key] && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleToggleShortcut(item.key); }}
                        disabled={shortcutSaving}
                        className={`p-1.5 rounded-lg transition-colors ${favoriteKeySet.has(item.key) ? 'text-yellow-500 hover:bg-yellow-200/40 dark:text-yellow-400 dark:hover:bg-yellow-400/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-white/5'} ${shortcutSaving ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <Star className={`w-4 h-4 ${favoriteKeySet.has(item.key) ? 'fill-yellow-400' : ''}`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-black/10 dark:border-white/10 bg-slate-100/80 dark:bg-black/20 space-y-3">
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/30 px-3 py-2 text-[11px] text-slate-600 dark:text-gray-300 flex items-center gap-2">
            {roleBadge && (
              <div className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-black/40 flex items-center justify-center border border-slate-200 dark:border-white/10">
                <RoleBadgeIcon role={roleBadge} className="w-6 h-6" />
              </div>
            )}
            <div className="leading-snug">
              <span className="font-semibold">Connecté en tant que </span>
              <span className="font-semibold">{profileName}</span>
              <span className="text-slate-500 dark:text-gray-400"> / {employmentLabel}</span>
            </div>
          </div>
          <button
            onClick={() => { navigate('/settings'); onClose(); }}
            className="w-full flex items-center gap-3 bg-slate-200/70 hover:bg-slate-300/80 active:bg-slate-300 rounded-xl px-4 py-3 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:active:bg-white/15 dark:text-gray-300 dark:hover:text-white transition-all duration-200 group"
          >
            <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            <span className="font-medium">Paramètres</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-300 dark:hover:text-white transition-all duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SideMenu;
