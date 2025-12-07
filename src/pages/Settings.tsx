import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Info, Bell, Shield, LogOut } from 'lucide-react';
import { RELEASE_NOTES } from '../constants/releaseNotes';
import { auth } from '../utils/firebase';
import { signOut } from 'firebase/auth';

const Settings = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A] text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gray-900/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
            Paramètres
          </h1>
          <p className="text-gray-400 text-center text-sm font-light tracking-wide">
            Gérez vos préférences et consultez les informations de l'application
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-4 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
          {/* Release Notes Section */}
          <div className="bg-[#151515] border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20">
            <button
              onClick={() => toggleSection('release-notes')}
              className="w-full px-6 py-4 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <span className="font-medium text-lg">Nouveautés</span>
              </div>
              {openSection === 'release-notes' ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>

            {openSection === 'release-notes' && (
              <div className="px-6 py-4 space-y-6 bg-[#0A0A0A]/50">
                {RELEASE_NOTES.map((release, index) => (
                  <div key={index} className="border-l-2 border-blue-500/30 pl-4 ml-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-blue-400 text-lg">Version {release.version}</h3>
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">{release.date}</span>
                    </div>
                    <ul className="space-y-2">
                      {release.changes.map((change, changeIndex) => (
                        <li key={changeIndex} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5 flex-shrink-0" />
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
          <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Bell className="w-5 h-5 text-purple-400" />
              </div>
              <span className="font-medium text-lg">Notifications</span>
            </div>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <div className="bg-[#151515] border border-white/10 rounded-2xl p-6 flex items-center justify-between opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <span className="font-medium text-lg">Sécurité</span>
            </div>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-full">Bientôt disponible</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-8 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 py-4 rounded-2xl text-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Se déconnecter
          </button>
        </div>

        <div className="w-full max-w-2xl mt-8 mb-[calc(env(safe-area-inset-bottom,0)+12px)] animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white py-4 rounded-2xl text-lg font-medium transition-all duration-200"
          >
            Retour à l'accueil
          </button>
        </div>

        <div className="mt-8 text-center text-gray-600 text-xs animate-fade-in-down" style={{ animationDelay: '0.3s' }}>
          <p>A.T.L.A.S v{RELEASE_NOTES[0]?.version || '1.0.0'}</p>
          <p className="mt-1">© 2024 Brigade de Sapeurs-Pompiers de Paris</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
