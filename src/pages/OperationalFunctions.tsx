import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock3 } from 'lucide-react';
import RoleBadgeIcon from '../components/RoleBadgeIcon';

const topRoles: Array<{ key: 'group' | 'column' | 'site'; label: string; description: string }> = [
  { key: 'group', label: 'Chef de groupe', description: 'Ordre initial et conduite de secteur.' },
  { key: 'column', label: 'Chef de colonne', description: 'Cadre SAOIECL pour commandement élargi.' },
  { key: 'site', label: 'Chef de site', description: 'Synthèse et coordination multi-secteurs.' },
];

const upcomingRoles = [
  { label: 'Officier sécurité', description: 'Suivi sécurité et points sensibles.' },
  { label: 'Officier alimentation', description: 'Ressources eau et soutien logistique.' },
];

const OperationalFunctions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900 dark:text-white">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-28 safe-left safe-right safe-bottom sm:px-6 lg:px-8">
        <div className="flex flex-1 flex-col justify-center gap-8">
          <div className="max-w-2xl space-y-3 animate-fade-in-down">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              <Clock3 className="h-3.5 w-3.5" />
              Fonctions opérationnelles
            </div>
            <h1 className="text-4xl font-black leading-tight text-slate-950 dark:text-white md:text-5xl">
              Choisir le niveau de commandement
            </h1>
            <p className="text-base leading-7 text-slate-600 dark:text-gray-300">
              Sélectionnez le cadre adapté à la mission pour ouvrir le parcours de saisie correspondant.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
              {topRoles.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => navigate(`/command-type/${r.key}`)}
                  className="atlas-panel group flex min-h-[210px] flex-col justify-between rounded-2xl p-5 text-left hover:border-slate-300/80 dark:hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-black/35">
                      <RoleBadgeIcon role={r.key} className="h-12 w-12" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-0.5 dark:text-gray-500" />
                  </div>
                  <div className="space-y-3 pt-6">
                    <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">
                      {r.label}
                    </h2>
                    <p className="text-sm leading-6 text-slate-600 dark:text-gray-400">
                      {r.description}
                    </p>
                  </div>
                </button>
              ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {upcomingRoles.map((role) => (
              <div
                key={role.label}
                className="rounded-2xl border border-dashed border-slate-300 bg-white/55 px-5 py-4 text-slate-500 backdrop-blur dark:border-white/15 dark:bg-white/5 dark:text-gray-500"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-700 dark:text-gray-300">{role.label}</h2>
                    <p className="mt-1 text-sm leading-6">{role.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:bg-white/10 dark:text-gray-400">
                    Bientôt
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalFunctions;
