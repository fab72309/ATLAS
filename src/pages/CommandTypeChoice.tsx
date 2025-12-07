import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import CommandIcon from '../components/CommandIcon';

const CommandTypeChoice = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const validTypes = ['group', 'column', 'site', 'communication'] as const;
  const currentType = validTypes.includes(type as any) ? (type as typeof validTypes[number]) : null;

  // If the type is invalid (e.g., security/supply), redirect to home to avoid blank states
  React.useEffect(() => {
    if (!currentType) {
      // Small timeout to allow initial paint, then redirect
      const t = setTimeout(() => navigate('/', { replace: true }), 0);
      return () => clearTimeout(t);
    }
  }, [currentType, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[#0A0A0A] text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
            A.T.L.A.S
          </h1>
          <p className="text-gray-400 text-center text-sm md:text-base font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        {currentType ? (
          <div className="w-full max-w-[180px] mb-8 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
            <CommandIcon type={currentType} />
          </div>
        ) : (
          <div className="text-white bg-red-500/20 border border-red-500/40 rounded-xl p-4 mb-8 text-sm backdrop-blur-sm">
            Type non supporté. Redirection en cours vers l'accueil…
          </div>
        )}

        <div className="w-full max-w-xl space-y-6 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={() => currentType && navigate(`/situation/${currentType}/dictate`)}
            disabled={!currentType}
            className="group w-full bg-[#151515] hover:bg-[#1A1A1A] transition-all duration-300 text-white p-6 rounded-3xl border border-white/10 hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:-translate-y-1"
          >
            <h2 className="text-2xl font-bold mb-2 group-hover:text-red-400 transition-colors">
              {type === 'communication' ? 'Dicter un Point de Situation' : 'Dicter un Ordre Initial'}
            </h2>
            <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
              {type === 'communication'
                ? 'Utilisez la reconnaissance vocale pour dicter votre point de situation'
                : 'Utilisez la reconnaissance vocale pour dicter votre ordre initial'}
            </p>
          </button>

          <button
            onClick={() => currentType && navigate(`/situation/${currentType}/ai`)}
            disabled={!currentType}
            className="group w-full bg-[#151515] hover:bg-[#1A1A1A] transition-all duration-300 text-white p-8 rounded-3xl border border-white/10 hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:-translate-y-1"
          >
            <h2 className="text-2xl font-bold mb-2 flex items-center justify-center gap-3 group-hover:text-red-400 transition-colors">
              {type === 'communication' ? 'Point de Situation' : 'Ordre Initial'} par Assistant IA
              <Sparkles className="w-6 h-6 text-red-400 group-hover:text-red-300 animate-pulse" />
            </h2>
            <p className="text-gray-400 group-hover:text-gray-300 transition-colors">
              {type === 'communication'
                ? 'Laissez l\'IA vous aider à structurer votre point de situation'
                : 'Laissez l\'IA vous aider à structurer votre ordre initial'}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommandTypeChoice;
