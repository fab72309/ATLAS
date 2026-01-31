import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Radio, Map } from 'lucide-react';
import ShieldFlameIcon from '../components/ShieldFlameIcon';
import HistoryDialog from '../components/HistoryDialog';

const Home = () => {
  const navigate = useNavigate();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-200/60 dark:bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8 flex flex-col h-full">
        {/* Header Actions */}
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="p-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 rounded-full transition-all duration-300 hover:scale-110 group"
            title="Historique"
          >
            <History className="w-6 h-6 text-slate-500 group-hover:text-slate-900 dark:text-gray-400 dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col items-center justify-center mb-12 animate-fade-in-down">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-gray-200 dark:to-gray-500 mb-4 drop-shadow-2xl">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-lg md:text-xl font-light tracking-wide max-w-2xl leading-relaxed">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto pb-12">
          {/* Operational Functions Card */}
          <div
            onClick={() => navigate('/functions')}
            className="gyro-glow group relative bg-white/90 dark:bg-[#151515] p-8 rounded-3xl cursor-pointer border border-slate-200 dark:border-white/10 hover:border-red-400/40 dark:hover:border-red-500/50 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-slate-200 dark:bg-black/50 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/5 group-hover:border-red-400/40 dark:group-hover:border-red-500/30 transition-colors duration-500 shadow-xl">
                <ShieldFlameIcon className="w-14 h-14 glossy-blue-icon transition-transform duration-500 group-hover:scale-110" />
              </div>
              <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Fonctions<br />Opérationnelles
              </h2>
            </div>
          </div>

          {/* Communication OPS Card */}
          <div
            onClick={() => navigate('/command-type/communication')}
            className="gyro-glow group relative bg-white/90 dark:bg-[#151515] p-8 rounded-3xl cursor-pointer border border-slate-200 dark:border-white/10 hover:border-red-400/40 dark:hover:border-red-500/50 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-slate-200 dark:bg-black/50 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/5 group-hover:border-red-400/40 dark:group-hover:border-red-500/30 transition-colors duration-500 shadow-xl">
                <Radio className="w-14 h-14 glossy-blue-icon transition-all duration-500 group-hover:scale-110" />
              </div>
              <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Communication<br />OPS
              </h2>
            </div>
          </div>

          {/* Operational Zoning Card */}
          <div
            onClick={() => navigate('/operational-zoning')}
            className="gyro-glow group relative bg-white/90 dark:bg-[#151515] p-8 rounded-3xl cursor-pointer border border-slate-200 dark:border-white/10 hover:border-red-400/40 dark:hover:border-red-500/50 transition-all duration-500 hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10 flex flex-col items-center gap-6">
              <div className="w-24 h-24 bg-slate-200 dark:bg-black/50 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-white/5 group-hover:border-red-400/40 dark:group-hover:border-red-500/30 transition-colors duration-500 shadow-xl">
                <Map className="w-14 h-14 glossy-blue-icon transition-all duration-500 group-hover:scale-110" />
              </div>
              <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                Zonage<br />Opérationnel
              </h2>
            </div>
          </div>

        </div>
      </div>

      <HistoryDialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

export default Home;
