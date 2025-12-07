import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import { Menu, Home } from 'lucide-react';

const Layout = () => {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
