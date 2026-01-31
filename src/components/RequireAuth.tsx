import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isProfileComplete, useProfile } from '../contexts/ProfileContext';

const RequireAuth = ({ children }: { children: React.ReactElement }) => {
  const { user, initializing, initError, retryInit } = useAuth();
  const { profile, loading: profileLoading, error: profileError, refresh } = useProfile();
  const location = useLocation();

  if (initError) {
    const missingEnv = initError.kind === 'missing-env';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-xl font-semibold">Connexion impossible</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">{initError.message}</div>
          {missingEnv && (
            <div className="text-xs text-slate-500 dark:text-gray-500">
              Consultez `README.md` et configurez l&apos;environnement. Settings est disponible après connexion.
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={retryInit}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm"
            >
              Réessayer
            </button>
            {missingEnv && (
              <a
                href="#/settings"
                className="text-sm text-slate-700 dark:text-gray-300 underline"
              >
                Ouvrir Settings
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

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

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
        <div className="text-center space-y-3">
          <div className="animate-pulse text-xl font-semibold">Chargement du profil...</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">Synchronisation des informations utilisateur</div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
        <div className="text-center space-y-3 max-w-md">
          <div className="text-xl font-semibold">Profil indisponible</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">{profileError}</div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const isOnboardingRoute = location.pathname === '/onboarding';
  if (!isProfileComplete(profile) && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

export default RequireAuth;
