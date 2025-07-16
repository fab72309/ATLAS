import React from 'react';
import { Outlet } from 'react-router-dom';

const Layout = () => {
  return (
    <div className="min-h-screen bg-[#00051E]">
      <main className="container mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;