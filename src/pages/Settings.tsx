import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, Bell, Shield, LogOut, Sun } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { useAuth } from '../contexts/AuthContext';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import ThemeSelector from '../components/ThemeSelector';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { logout } = useAuth();
  const { theme, resolvedTheme } = useTheme();

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-slate-200/70 dark:bg-gray-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-2">
            Paramètres
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-sm font-light tracking-wide">
            Gérez vos préférences et consultez les informations de l'application
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-4 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          {/* Theme Section */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl p-6 transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200/60 dark:bg-amber-500/20 rounded-lg">
                  <Sun className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                </div>
                <div>
                  <div className="font-medium text-lg">Apparence</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    Mode actuel : {resolvedTheme === 'dark' ? 'Sombre' : 'Clair'}{theme === 'system' ? ' (auto)' : ''}
                  </div>
                </div>
              </div>
            </div>
            <ThemeSelector />
          </div>

          {/* Release Notes Section */}
          <div className="bg-white/80 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-white/20">
            <button
              onClick={() => toggleSection('release-notes')}
              className="w-full px-6 py-4 flex items-center justify-between bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="font-medium text-lg">Nouveautés</span>
              </div>
              {openSection === 'release-notes' ? (
                <ChevronUp className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-500 dark:text-gray-400" />
              )}
            </button>

            {openSection === 'release-notes' && (
              <div className="px-6 py-4 space-y-6 bg-slate-50/80 dark:bg-[#0A0A0A]/50">
                {RELEASE_NOTES.map((release, index) => (
                  <div key={index} className="border-l-2 border-blue-300 dark:border-blue-500/30 pl-4 ml-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-blue-600 dark:text-blue-400 text-lg">Version {release.version}</h3>
                      <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">{release.date}</span>
                    </div>
                    <ul className="space-y-2">
                      {release.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="text-slate-600 dark:text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-gray-500 mt-1.5 flex-shrink-0" />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Other Settings Placeholders */}
          <div className="bg-white/70 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="font-medium text-lg">Notifications</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <div className="bg-white/70 border border-slate-200 dark:bg-[#151515] dark:border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-medium text-lg">Sécurité</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-500 bg-white/70 dark:bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-8 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-600 hover:text-red-500 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:border-red-500/20 dark:hover:border-red-500/40 dark:text-red-400 dark:hover:text-red-300 py-4 rounded-2xl text-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Se déconnecter
          </button>
        </div>

        <div className="w-full max-w-2xl mt-8 mb-[calc(env(safe-area-inset-bottom,0)+12px)] animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/80 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-300 dark:hover:text-white py-4 rounded-2xl text-lg font-medium transition-all duration-200"
          >
            Retour à l'accueil
          </button>
        </div>

        <div className="mt-8 text-center text-slate-500 dark:text-gray-600 text-xs animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <p>{APP_NAME} v{APP_VERSION}</p>
          <p className="mt-1">© 2024 Brigade de Sapeurs-Pompiers de Paris</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
