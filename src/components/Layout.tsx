import React from 'react';
import { Outlet } from 'react-router-dom';
import SideMenu from './SideMenu';
import { Menu } from 'lucide-react';

const Layout = () => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="min-h-screen bg-[#00051E]">
      <SideMenu open={open} onClose={()=>setOpen(false)} />
      <main className="container mx-auto relative">
        <button onClick={()=>setOpen(true)} className="fixed left-3 top-3 z-30 p-2 bg-white/10 hover:bg-white/20 rounded text-white">
          <Menu className="w-5 h-5" />
        </button>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;