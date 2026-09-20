import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3, History, Map, Radio } from 'lucide-react';
import ShieldFlameIcon from '../components/ShieldFlameIcon';
import HistoryDialog from '../components/HistoryDialog';

const Home = () => {
  const navigate = useNavigate();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const primaryActions = [
    {
      title: 'Fonctions opérationnelles',
      eyebrow: 'Commandement',
      description: 'Cadres et outils de commandement.',
      icon: <ShieldFlameIcon className="h-9 w-9 glossy-blue-icon" />,
      action: () => navigate('/functions'),
      ariaLabel: 'Ouvrir fonctions opérationnelles',
    },
    {
      title: 'Communication OPS',
      eyebrow: 'Message',
      description: 'Préparer les échanges sans perdre le fil tactique.',
      icon: <Radio className="h-9 w-9 glossy-blue-icon" />,
      action: () => navigate('/command-type/communication'),
      ariaLabel: 'Ouvrir communication OPS',
    },
    {
      title: 'Zonage opérationnel',
      eyebrow: 'Terrain',
      description: 'Visualiser secteurs, repères et appuis à la manoeuvre.',
      icon: <Map className="h-9 w-9 glossy-blue-icon" />,
      action: () => navigate('/operational-zoning'),
      ariaLabel: 'Ouvrir zonage opérationnel',
    },
  ];

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-white">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-24 pt-36 safe-left safe-right safe-bottom sm:px-6 sm:pt-28 lg:px-8">
        <section className="grid flex-1 content-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(560px,1.1fr)] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <Clock3 className="h-3.5 w-3.5" />
                Session opérationnelle
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-gray-400">
                  A.T.L.A.S
                </p>
                <h1 className="max-w-xl text-4xl font-black leading-[0.98] text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
                  Poste de commandement ATLAS
                </h1>
                <p className="max-w-lg text-base leading-7 text-slate-600 dark:text-gray-300">
                  Accès direct aux modules tactiques, aux communications et aux repères terrain.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              aria-label="Ouvrir l'historique"
              className="inline-flex w-full items-center justify-between rounded-2xl border border-dashed border-slate-300/80 bg-white/55 px-4 py-3 text-left text-sm font-semibold text-slate-600 backdrop-blur transition-colors hover:border-slate-400 hover:text-slate-950 dark:border-white/15 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/30 dark:hover:text-white sm:w-auto"
            >
              <span className="inline-flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique des opérations
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {primaryActions.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={card.action}
                aria-label={card.ariaLabel}
                className="atlas-panel group flex min-h-[190px] flex-col justify-between rounded-2xl p-5 text-left hover:border-slate-300/80 dark:hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-black/35 dark:text-white">
                    {card.icon}
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:bg-white/10 dark:text-gray-400">
                    {card.eyebrow}
                  </span>
                </div>
                <div className="space-y-3 pt-6">
                  <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">
                    {card.title}
                  </h2>
                  <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
                    {card.description}
                  </p>
                </div>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  Ouvrir le module
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <HistoryDialog isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

export default Home;
