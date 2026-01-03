import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSupabaseClient } from '../utils/supabaseClient';
import { useInterventionStore } from '../stores/useInterventionStore';
import { hydrateIntervention } from '../utils/interventionHydration';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';

type CommandLevel = 'group' | 'column' | 'site';
type CommandLevelChoice = CommandLevel | '';

type InvitePreview = {
  intervention_id: string;
  title: string | null;
  incident_number: string | null;
  address_line1: string | null;
  street_number: string | null;
  street_name: string | null;
  postal_code: string | null;
  city: string | null;
};

const COMMAND_OPTIONS: Array<{ value: CommandLevel; label: string }> = [
  { value: 'group', label: 'Chef de groupe' },
  { value: 'column', label: 'Chef de colonne' },
  { value: 'site', label: 'Chef de site' }
];

const ROLE_LABELS: Record<CommandLevel, string> = {
  group: 'Chef de groupe',
  column: 'Chef de colonne',
  site: 'Chef de site'
};

const getTokenFromSearch = (search: string) => {
  const params = new URLSearchParams(search);
  const token = params.get('token');
  return token ? token.trim() : '';
};

const JoinIntervention: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setCurrentIntervention = useInterventionStore((s) => s.setCurrentIntervention);
  const setRole = useInterventionStore((s) => s.setRole);
  const [commandLevel, setCommandLevel] = React.useState<CommandLevelChoice>('');
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<InvitePreview | null>(null);

  const token = React.useMemo(() => getTokenFromSearch(location.search), [location.search]);

  React.useEffect(() => {
    if (!token) {
      setPreviewStatus('error');
      setPreviewError('Token d’invitation manquant.');
      setPreview(null);
      return;
    }
    setPreviewStatus('loading');
    setPreviewError(null);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setPreviewStatus('error');
      setPreviewError('Configuration Supabase manquante.');
      setPreview(null);
      return;
    }
    const fetchPreview = async () => {
      try {
        const { data, error: previewErr } = await supabase.rpc('preview_invite', { p_token: token });
        if (previewErr) throw previewErr;
        const payload = Array.isArray(data) ? data[0] : data;
        setPreview(payload ?? null);
        setPreviewStatus(payload ? 'ready' : 'error');
        if (!payload) setPreviewError('Invitation introuvable.');
      } catch (err: unknown) {
        console.error('Erreur preview invite', err);
        const message = err instanceof Error ? err.message : 'Impossible de vérifier l’invitation.';
        setPreviewError(message);
        setPreviewStatus('error');
        setPreview(null);
      }
    };
    void fetchPreview();
  }, [token]);

  const handleJoin = async () => {
    if (!token) {
      setError('Token manquant.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Configuration Supabase manquante.');
      setStatus('error');
      return;
    }
    if (!commandLevel) {
      setError('Veuillez sélectionner une fonction.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const selectedLevel = commandLevel as CommandLevel;
      const { data, error: joinError } = await supabase.rpc('join_by_token', {
        p_token: token,
        p_command_level: selectedLevel
      });
      if (joinError) throw joinError;
      const interventionId = typeof data === 'string' ? data : null;
      if (!interventionId) {
        throw new Error('Intervention introuvable.');
      }
      let startedAtMs = Date.now();
      try {
        const hydration = await hydrateIntervention(interventionId);
        startedAtMs = hydration.startedAtMs ?? startedAtMs;
      } catch (error) {
        console.error('Hydratation intervention échouée', error);
        setCurrentIntervention(interventionId, startedAtMs);
      }
      setRole(ROLE_LABELS[selectedLevel]);
      navigate(`/situation/${selectedLevel}/dictate`, {
        state: { mode: 'resume', interventionId, startedAtMs }
      });
    } catch (err) {
      console.error('Erreur join intervention', err);
      const message = err instanceof Error ? err.message : 'Impossible de rejoindre.';
      setError(message);
      setStatus('error');
    } finally {
      setStatus('idle');
    }
  };

  const previewAddressLine = preview?.address_line1?.trim()
    || [preview?.street_number, preview?.street_name].filter(Boolean).join(' ').trim();
  const previewCityLine = [preview?.postal_code, preview?.city].filter(Boolean).join(' ').trim();
  const previewTitle = preview?.incident_number
    ? `Intervention #${preview.incident_number}`
    : (preview?.title || 'Intervention ATLAS');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Rejoindre une intervention</h2>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Choisissez votre fonction, puis confirmez l&apos;invitation.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 px-4 py-3 space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">Vous rejoignez</div>
          {previewStatus === 'loading' && (
            <div className="text-sm text-slate-600 dark:text-gray-300">Chargement de l’invitation…</div>
          )}
          {previewStatus === 'error' && (
            <div className="text-sm text-red-500 dark:text-red-300">{previewError || 'Invitation invalide.'}</div>
          )}
          {previewStatus === 'ready' && (
            <>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{previewTitle}</div>
              {(previewAddressLine || previewCityLine) && (
                <div className="text-sm text-slate-600 dark:text-gray-300">
                  {[previewAddressLine, previewCityLine].filter(Boolean).join(', ')}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-slate-500 dark:text-gray-400">
            Fonction
          </label>
          <select
            value={commandLevel}
            onChange={(e) => setCommandLevel(e.target.value as CommandLevelChoice)}
            className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <option value="">Sélectionner une fonction</option>
            {COMMAND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {!token && (
          <div className="text-sm text-red-500 dark:text-red-300">
            Token d&apos;invitation manquant dans l&apos;URL.
          </div>
        )}
        {error && (
          <div className="text-sm text-red-500 dark:text-red-300">{error}</div>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={!token || !commandLevel || status === 'loading'}
          className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition disabled:opacity-60"
        >
          {status === 'loading' ? 'Connexion...' : 'Rejoindre'}
        </button>
      </div>
      <div className="fixed right-4 bottom-4 z-30 text-[11px] text-slate-500 dark:text-gray-400 bg-white/80 dark:bg-black/50 border border-black/10 dark:border-white/10 px-3 py-2 rounded-xl backdrop-blur-md">
        {APP_NAME} — {APP_VERSION}
      </div>
    </div>
  );
};

export default JoinIntervention;
