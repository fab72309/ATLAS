import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import { Menu, Home, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';

const Layout = () => {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Erreur déconnexion', err);
    }
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <SideMenu open={open} onClose={() => setOpen(false)} />
      <main className="relative min-h-screen">
        <div className="fixed left-4 top-4 z-30 flex gap-3">
          <button
            onClick={() => setOpen(true)}
            className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
              aria-label="Accueil"
            >
              <Home className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="fixed right-4 top-4 z-30">
          <button
            onClick={handleLogout}
            className="p-2.5 bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
            aria-label="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Déconnexion</span>
          </button>
        </div>
        <div className="fixed right-4 bottom-4 z-30 text-[11px] text-gray-400 bg-black/50 border border-white/10 px-3 py-2 rounded-xl backdrop-blur-md">
          {APP_NAME} — {APP_VERSION}
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
