import React from 'react';
import { useNavigate } from 'react-router-dom';
import RoleBadgeIcon from '../components/RoleBadgeIcon';

const topRoles: Array<{ key: 'group' | 'column' | 'site'; label: string }> = [
  { key: 'group', label: 'Chef de groupe' },
  { key: 'column', label: 'Chef de colonne' },
  { key: 'site', label: 'Chef de site' },
];

const bottomRoles: Array<{ key: 'security' | 'supply'; label: string }> = [
  { key: 'security', label: 'Officier sécurité' },
  { key: 'supply', label: 'Officier alimentation' },
];

const OperationalFunctions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] text-white overflow-hidden relative">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12 pt-12">
          <div className="flex flex-col items-center mb-12 animate-fade-in-down">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
              A.T.L.A.S
            </h1>
            <p className="text-gray-400 text-center text-sm md:text-base font-light tracking-wide max-w-md">
              Aide Tactique et Logique pour l'Action des Secours
            </p>
          </div>

          <div className="w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
              {/* Top Row */}
              {topRoles.map((r) => (
                <button
                  key={r.key}
                  onClick={() => navigate(`/command-type/${r.key}`)}
                  className="group relative w-full max-w-[280px] aspect-square flex flex-col items-center justify-center bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 hover:border-red-500/50 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10 flex flex-col items-center gap-6 p-6">
                    <div className="w-24 h-24 md:w-28 md:h-28 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <RoleBadgeIcon role={r.key} className="w-full h-full" />
                    </div>
                    <span className="text-lg md:text-xl font-semibold text-gray-200 group-hover:text-white tracking-wide text-center">
                      {r.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 place-items-center mt-6 max-w-3xl mx-auto">
              {/* Bottom Row */}
              {bottomRoles.map((r) => (
                <button
                  key={r.key}
                  onClick={() => navigate(`/command-type/${r.key}`)}
                  className="group relative w-full max-w-[280px] aspect-square flex flex-col items-center justify-center bg-[#151515] hover:bg-[#1A1A1A] border border-white/10 hover:border-red-500/50 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:-translate-y-1 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <div className="relative z-10 flex flex-col items-center gap-6 p-6">
                    <div className="w-24 h-24 md:w-28 md:h-28 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <RoleBadgeIcon role={r.key} className="w-full h-full" />
                    </div>
                    <span className="text-lg md:text-xl font-semibold text-gray-200 group-hover:text-white tracking-wide text-center">
                      {r.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalFunctions;
