import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CommandIcon from '../components/CommandIcon';

const CommandTypeChoice = () => {
  const navigate = useNavigate();
  const { type } = useParams();
  const validTypes = ['group', 'column', 'site', 'communication'] as const;
  const isValidType = (value: string | undefined): value is (typeof validTypes)[number] =>
    !!value && validTypes.includes(value as (typeof validTypes)[number]);
  const currentType = isValidType(type) ? type : null;
  const [showInterventionModal, setShowInterventionModal] = React.useState(false);
  const [showMetadataModal, setShowMetadataModal] = React.useState(false);
  const [interventionMeta, setInterventionMeta] = React.useState({
    address: '',
    city: '',
    date: '',
    time: ''
  });

  // If the type is invalid (e.g., security/supply), redirect to home to avoid blank states
  React.useEffect(() => {
    if (!currentType) {
      // Small timeout to allow initial paint, then redirect
      const t = setTimeout(() => navigate('/', { replace: true }), 0);
      return () => clearTimeout(t);
    }
  }, [currentType, navigate]);

  const handlePrimaryAction = () => {
    if (!currentType) return;
    if (type === 'communication') {
      navigate(`/situation/${currentType}/dictate`);
      return;
    }
    setShowInterventionModal(true);
  };

  const resetMeta = () => {
    const now = new Date();
    const defaultDate = now.toISOString().slice(0, 10);
    const defaultTime = now.toISOString().slice(11, 16);
    setInterventionMeta((prev) => ({
      address: prev.address || '',
      city: prev.city || '',
      date: defaultDate,
      time: defaultTime
    }));
  };

  const handleCreateIntervention = () => {
    if (!currentType) return;
    resetMeta();
    setShowInterventionModal(false);
    setShowMetadataModal(true);
  };

  const handleMetadataChange = (field: keyof typeof interventionMeta, value: string) => {
    setInterventionMeta((prev) => ({ ...prev, [field]: value }));
  };

  const handleResumeIntervention = () => {
    if (!currentType) return;
    setShowInterventionModal(false);
    navigate(`/situation/${currentType}/dictate`, { state: { mode: 'resume' } });
  };

  const handleConfirmMetadata = () => {
    if (!currentType) return;
    const now = new Date();
    const date = interventionMeta.date || now.toISOString().slice(0, 10);
    const time = interventionMeta.time || now.toISOString().slice(11, 16);
    const payload = {
      ...interventionMeta,
      date,
      time
    };
    setShowMetadataModal(false);
    navigate(`/situation/${currentType}/dictate`, { state: { mode: 'create', meta: payload } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/70 dark:bg-blue-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-200/60 dark:bg-red-900/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-8 flex flex-col items-center h-full">
        <div className="flex flex-col items-center mb-8 animate-fade-in-down">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-gray-400 mb-2">
            A.T.L.A.S
          </h1>
          <p className="text-slate-600 dark:text-gray-400 text-center text-sm md:text-base font-light tracking-wide">
            Aide Tactique et Logique pour l'Action des Secours
          </p>
        </div>

        {currentType ? (
          <div className="w-full max-w-[180px] mb-8 animate-fade-in-down" style={{ animationDelay: '0.1s' }}>
            <CommandIcon type={currentType} />
          </div>
        ) : (
          <div className="text-red-700 dark:text-white bg-red-100/80 dark:bg-red-500/20 border border-red-200 dark:border-red-500/40 rounded-xl p-4 mb-8 text-sm backdrop-blur-sm">
            Type non supporté. Redirection en cours vers l'accueil…
          </div>
        )}

        <div className="w-full max-w-xl space-y-6 animate-fade-in-down" style={{ animationDelay: '0.2s' }}>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={!currentType}
              className="group w-full bg-white/90 hover:bg-slate-100 dark:bg-[#151515] dark:hover:bg-[#1A1A1A] transition-all duration-300 text-slate-900 dark:text-white p-6 rounded-3xl border border-slate-200 dark:border-white/10 hover:border-red-400/40 dark:hover:border-red-500/50 hover:-translate-y-1"
            >
            <h2 className="text-2xl font-bold mb-2 group-hover:text-red-400 transition-colors">
              {type === 'communication' ? 'Dicter un Point de Situation' : 'Gérer une intervention'}
            </h2>
            <p className="text-slate-600 dark:text-gray-400 group-hover:text-slate-700 dark:group-hover:text-gray-300 transition-colors">
              {type === 'communication'
                ? 'Utilisez la reconnaissance vocale pour dicter votre point de situation'
                : 'Utilisez la reconnaissance vocale pour dicter votre ordre initial'}
            </p>
          </button>

        </div>
      </div>

      {showInterventionModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Gestion d&apos;intervention</p>
                <h3 className="text-2xl font-bold">Que souhaitez-vous faire ?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInterventionModal(false)}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                <h4 className="text-lg font-semibold mb-1">Créer une nouvelle intervention</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Démarrer un nouveau raisonnement SOIEC et configurer vos moyens.
                </p>
                <button
                  type="button"
                  onClick={handleCreateIntervention}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white transition font-semibold"
                >
                  Créer une intervention
                </button>
              </div>
              <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                <h4 className="text-lg font-semibold mb-1">Reprendre une intervention existante</h4>
                <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                  Charger une intervention enregistrée et poursuivre la mise à jour.
                </p>
                <button
                  type="button"
                  onClick={handleResumeIntervention}
                  className="w-full py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition font-semibold"
                >
                  Reprendre une intervention
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMetadataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-2xl bg-white dark:bg-[#101010] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-slate-500 dark:text-gray-400 tracking-[0.3em]">Nouvelle intervention</p>
                <h3 className="text-2xl font-bold">Renseignements initiaux</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowMetadataModal(false);
                  setShowInterventionModal(true);
                }}
                className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Fermer la fenêtre"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Adresse</label>
                <input
                  value={interventionMeta.address}
                  onChange={(e) => handleMetadataChange('address', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  placeholder="12 rue des Secours"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Ville</label>
                <input
                  value={interventionMeta.city}
                  onChange={(e) => handleMetadataChange('city', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  placeholder="Paris"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Date</label>
                <input
                  type="date"
                  value={interventionMeta.date}
                  onChange={(e) => handleMetadataChange('date', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Heure</label>
                <input
                  type="time"
                  value={interventionMeta.time}
                  onChange={(e) => handleMetadataChange('time', e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowMetadataModal(false);
                    setShowInterventionModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition"
                >
                  Retour
                </button>
              <button
                type="button"
                onClick={handleConfirmMetadata}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommandTypeChoice;
