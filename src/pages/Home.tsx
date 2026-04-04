import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Radio, Map } from 'lucide-react';
import ShieldFlameIcon from '../components/ShieldFlameIcon';
import HistoryDialog from '../components/HistoryDialog';

const Home = () => {
  const navigate = useNavigate();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const entryCards = [
    {
      title: 'Fonctions\nOpérationnelles',
      description: 'Accéder rapidement aux cadres de commandement et aux outils de conduite.',
      icon: <ShieldFlameIcon className="w-14 h-14 glossy-blue-icon transition-transform duration-500 group-hover:scale-110" />,
      action: () => navigate('/functions'),
      accent: 'from-red-500/14 via-red-500/6 to-transparent',
    },
    {
      title: 'Communication\nOPS',
      description: 'Préparer et structurer les échanges opérationnels sans perdre le fil tactique.',
      icon: <Radio className="w-14 h-14 glossy-blue-icon transition-all duration-500 group-hover:scale-110" />,
      action: () => navigate('/command-type/communication'),
      accent: 'from-sky-500/14 via-sky-500/6 to-transparent',
    },
    {
      title: 'Zonage\nOpérationnel',
      description: 'Visualiser le terrain, les secteurs et les repères utiles à la manoeuvre.',
      icon: <Map className="w-14 h-14 glossy-blue-icon transition-all duration-500 group-hover:scale-110" />,
      action: () => navigate('/operational-zoning'),
      accent: 'from-amber-500/14 via-amber-500/6 to-transparent',
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="atlas-grid absolute inset-0 opacity-70 dark:opacity-60" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-200/60 dark:bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-28 safe-left safe-right safe-bottom sm:px-6 lg:px-8">
        {/* Header Actions */}
        <div className="absolute right-4 top-4 md:right-8 md:top-8">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="atlas-panel group rounded-2xl p-3 transition-all duration-300 hover:scale-105"
            title="Historique"
          >
            <History className="w-6 h-6 text-slate-500 group-hover:text-slate-900 dark:text-gray-400 dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* Hero Section */}
        <div className="flex flex-1 flex-col justify-center py-8 animate-fade-in-down">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 text-center">
            <div className="space-y-4">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-gray-200 dark:to-gray-500 drop-shadow-2xl">
            A.T.L.A.S
          </h1>
              <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed tracking-wide text-slate-600 dark:text-gray-400 md:text-xl">
                Aide Tactique et Logique pour l'Action des Secours
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 pb-4 md:grid-cols-2 xl:grid-cols-3">
          {entryCards.map((card) => (
            <button
              key={card.title}
              onClick={card.action}
              className="gyro-glow atlas-panel group relative flex min-h-[280px] flex-col overflow-hidden rounded-[28px] p-6 text-left transition-all duration-500 hover:-translate-y-1.5 hover:border-slate-300/70 dark:hover:border-white/20"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/15" />

              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-slate-200/90 bg-slate-200/85 shadow-xl transition-colors duration-500 group-hover:border-white/80 dark:border-white/5 dark:bg-black/45">
                    {card.icon}
                  </div>
                  <div className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                    Module
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <h2 className="whitespace-pre-line text-2xl font-bold leading-tight text-slate-800 transition-colors group-hover:text-slate-900 dark:text-gray-200 dark:group-hover:text-white">
                    {card.title}
                  </h2>
                  <p className="max-w-[28ch] text-sm leading-6 text-slate-600 dark:text-gray-400">
                    {card.description}
                  </p>
                </div>

                <div className="mt-auto pt-8">
                  <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors group-hover:border-slate-300 group-hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:group-hover:border-white/20 dark:group-hover:text-white">
                    Ouvrir le module
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <HistoryDialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

export default Home;
