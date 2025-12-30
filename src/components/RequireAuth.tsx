import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const RequireAuth = ({ children }: { children: React.ReactElement }) => {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
        <div className="text-center space-y-3">
          <div className="animate-pulse text-xl font-semibold">Connexion...</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">Vérification de la session en cours</div>
        </div>
      </div>
    );
  }

  if (!user) {
    const nextPath = `${location.pathname}${location.search || ''}`;
    return <Navigate to="/login" state={{ from: nextPath }} replace />;
  }

  return children;
};

export default RequireAuth;
