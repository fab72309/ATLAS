import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import { Menu, Home, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import { telemetryBuffer } from '../utils/telemetryBuffer';
import { EMPLOYMENT_LEVEL_OPTIONS } from '../constants/profile';
import RoleBadgeIcon from './RoleBadgeIcon';

const Layout = () => {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile } = useProfile();
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);

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

  React.useEffect(() => {
    const cleanup = telemetryBuffer.bindLifecycleHandlers();
    return () => cleanup();
  }, []);

  React.useEffect(() => {
    telemetryBuffer.flushAll();
  }, [location.pathname, location.search, location.hash]);

  React.useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (profileMenuRef.current && profileMenuRef.current.contains(target)) return;
      setProfileMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur déconnexion', error);
    } finally {
      setProfileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      <SideMenu open={open} onClose={() => setOpen(false)} />
      <main className="relative min-h-screen overflow-x-hidden">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="atlas-grid absolute inset-0 opacity-70 dark:opacity-60" />
          <div className="absolute left-[-14rem] top-[-10rem] h-[22rem] w-[22rem] rounded-full bg-sky-300/18 blur-3xl dark:bg-sky-500/12" />
          <div className="absolute bottom-[-12rem] right-[-10rem] h-[24rem] w-[24rem] rounded-full bg-red-300/16 blur-3xl dark:bg-red-500/12" />
        </div>

        <div className="fixed left-0 top-0 z-30 safe-left safe-top">
          <div className="flex gap-3">
          <button
            onClick={() => setOpen(true)}
            className="atlas-panel rounded-2xl p-3 text-slate-900 dark:text-white transition-all duration-200 hover:scale-[1.03] active:scale-95"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              className="atlas-panel rounded-2xl p-3 text-slate-900 dark:text-white transition-all duration-200 hover:scale-[1.03] active:scale-95"
              aria-label="Accueil"
            >
              <Home className="w-6 h-6" />
            </button>
          )}
        </div>
        </div>

        <div className="fixed right-0 top-0 z-30 safe-right safe-top">
          <div className="flex items-start gap-3">
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              className="atlas-panel flex max-w-[280px] items-center gap-3 rounded-2xl px-3.5 py-2.5 text-slate-700 dark:text-gray-200 transition-colors"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
            >
              {roleBadge && (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-200/80 dark:border-white/10 dark:bg-black/40">
                  <RoleBadgeIcon role={roleBadge} className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 text-left leading-snug">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                  Session active
                </div>
                <div className="truncate text-[11px] font-semibold sm:text-xs">
                  {profileName}
                </div>
                <div className="truncate text-[11px] text-slate-500 dark:text-gray-400">
                  {employmentLabel}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-gray-300 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileMenuOpen && (
              <div
                role="menu"
                className="atlas-panel absolute right-0 mt-2 w-52 rounded-2xl p-2 text-sm text-slate-700 dark:text-gray-200"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    navigate('/settings?section=profile');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                >
                  <User className="w-4 h-4" />
                  Éditer le profil
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
        <div className="fixed bottom-0 right-0 z-30 safe-bottom safe-right">
          <div className="atlas-panel rounded-2xl px-3 py-2 text-[11px] text-slate-500 dark:text-gray-400">
          {APP_NAME} — {APP_VERSION}
        </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
