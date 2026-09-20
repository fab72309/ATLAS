import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../utils/favorites';
import { Settings, Search, X, ChevronRight, LogOut } from 'lucide-react';
import RoleBadgeIcon from './RoleBadgeIcon';
import { useProfile } from '../contexts/ProfileContext';
import { EMPLOYMENT_LEVEL_OPTIONS } from '../constants/profile';
import { useAuth } from '../contexts/AuthContext';

interface SideMenuProps {
  open: boolean;
  onClose: () => void;
}

const SideMenu: React.FC<SideMenuProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState('');
  const [opsOpen, setOpsOpen] = React.useState(true);
  const opsKeys = ['group', 'column', 'site'] as const;
  const { profile } = useProfile();
  const { logout, user } = useAuth();

  const filtered = React.useMemo(() => {
    const list = NAV_ITEMS;
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((n) => n.label.toLowerCase().includes(q));
  }, [query]);

  const isActive = (path: string) => location.pathname === path;

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
      <div className={`fixed inset-y-0 left-0 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col border-r border-black/10 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-out dark:border-white/10 dark:bg-[#0E1A2B]/95 ${open ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-black/10 p-4 dark:border-white/10">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-slate-900 dark:text-gray-400 dark:group-focus-within:text-white" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une fonction..."
              className="min-h-11 w-full rounded-xl bg-slate-100 py-2 pl-9 pr-3 text-sm text-slate-900 transition-all placeholder:text-slate-500 hover:bg-slate-200 focus:bg-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400/40 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:hover:bg-white/10 dark:focus:bg-white/10 dark:focus:ring-white/20"
            />
          </div>
          <button
            onClick={onClose}
            className="atlas-action text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

          {/* Operational Functions Section */}
          <div>
            <button
              onClick={() => setOpsOpen(v => !v)}
              className="mb-3 flex min-h-9 w-full items-center justify-between rounded-lg px-2 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <span>Fonctions opérationnelles</span>
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${opsOpen ? 'rotate-90' : ''}`} />
            </button>

            <div className={`space-y-1 overflow-hidden transition-all duration-300 ${opsOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {opsKeys.map((k) => {
                const item = filtered.find(n => n.key === k);
                if (!item) return null;
                const active = isActive(item.path);
                return (
                  <div key={k} className={`group flex items-center gap-2 rounded-xl transition-all duration-200 ${active ? 'border border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-600/20' : 'border border-transparent hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                    <button onClick={() => { navigate(item.path); onClose(); }} className="flex min-h-12 flex-1 items-center gap-3 px-3 text-left">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${active ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-200 group-hover:bg-slate-300 dark:bg-black/40 dark:group-hover:bg-black/60'}`}>
                        <RoleBadgeIcon role={k} className="h-6 w-6" />
                      </div>
                      <span className={`font-medium ${active ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 group-hover:text-slate-900 dark:text-gray-300 dark:group-hover:text-white'}`}>{item.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="space-y-3 border-t border-black/10 bg-slate-100/80 p-4 dark:border-white/10 dark:bg-black/20">
          <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-[11px] text-slate-600 dark:border-white/10 dark:bg-black/30 dark:text-gray-300">
            {roleBadge && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-200/80 dark:border-white/10 dark:bg-black/40">
                <RoleBadgeIcon role={roleBadge} className="h-6 w-6" />
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
            className="group flex min-h-12 w-full items-center gap-3 rounded-xl bg-slate-200/70 px-4 py-3 text-slate-700 transition-all duration-200 hover:bg-slate-300/80 hover:text-slate-900 active:bg-slate-300 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white dark:active:bg-white/15"
          >
            <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-45" />
            <span className="font-medium">Paramètres</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default SideMenu;
