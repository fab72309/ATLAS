import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import RoleBadgeIcon from '../components/RoleBadgeIcon';
import {
  EMPLOYMENT_LEVEL_OPTIONS,
  normalizeEmploymentLevel,
  SHORTCUT_OPTIONS,
  type EmploymentLevel,
  type ShortcutKey
} from '../constants/profile';

const ROLE_BADGE_BY_LEVEL: Record<EmploymentLevel, 'group' | 'column' | 'site'> = {
  chef_de_groupe: 'group',
  chef_de_colonne: 'column',
  chef_de_site: 'site'
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading, error, updateProfile } = useProfile();
  const [employmentLevel, setEmploymentLevel] = useState<EmploymentLevel | ''>('');
  const [shortcutKeys, setShortcutKeys] = useState<ShortcutKey[]>([]);
  const [customized, setCustomized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const profileLabel = useMemo(() => {
    const parts = [profile?.first_name, profile?.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Profil utilisateur';
  }, [profile?.first_name, profile?.last_name]);

  useEffect(() => {
    if (!profile) return;
    setEmploymentLevel(normalizeEmploymentLevel(profile.employment_level) ?? '');
    setShortcutKeys((profile.shortcut_keys ?? []) as ShortcutKey[]);
    setCustomized((profile.shortcut_keys ?? []).length > 0);
  }, [profile]);

  const handleLevelChange = (value: EmploymentLevel) => {
    setEmploymentLevel(value);
    if (!customized) {
      const defaults = EMPLOYMENT_LEVEL_OPTIONS.find((option) => option.value === value)?.defaultShortcuts ?? [];
      setShortcutKeys(defaults as ShortcutKey[]);
    }
  };

  const toggleShortcut = (key: ShortcutKey) => {
    setCustomized(true);
    setShortcutKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!employmentLevel) {
      setFormError('Sélectionnez un niveau d’emploi pour continuer.');
      return;
    }
    setFormError(null);
    setSaving(true);
    const updated = await updateProfile({
      employment_level: employmentLevel,
      shortcut_keys: shortcutKeys
    });
    setSaving(false);
    if (updated) {
      navigate('/', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white">
        <div className="text-center space-y-3">
          <div className="animate-pulse text-xl font-semibold">Préparation de votre profil...</div>
          <div className="text-sm text-slate-600 dark:text-gray-400">Chargement des informations utilisateur</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[520px] h-[520px] bg-blue-200/70 dark:bg-blue-500/10 rounded-full blur-[140px] -top-32 -left-20" />
        <div className="absolute w-[520px] h-[520px] bg-emerald-200/60 dark:bg-emerald-500/10 rounded-full blur-[140px] bottom-[-40px] right-[-60px]" />
      </div>

      <div className="relative w-full max-w-2xl bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-slate-500 dark:text-gray-400">Bienvenue {profileLabel}</p>
          <h1 className="text-2xl font-bold">Finalisons votre onboarding</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            Indiquez votre niveau d’emploi pour adapter les raccourcis et la configuration initiale.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Niveau d’emploi</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {EMPLOYMENT_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleLevelChange(option.value)}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  employmentLevel === option.value
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                    : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 flex items-center justify-center">
                    <RoleBadgeIcon role={ROLE_BADGE_BY_LEVEL[option.value]} className="w-6 h-6" />
                  </div>
                  <span className="text-left">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Ce grade peut être modifié à tout moment dans Paramètres &gt; Profil.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-600 dark:text-gray-300">Raccourcis recommandés</label>
            <span className="text-xs text-slate-400">Personnalisables</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SHORTCUT_OPTIONS.map((shortcut) => (
              <label
                key={shortcut.key}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  shortcutKeys.includes(shortcut.key)
                    ? 'border-blue-500/40 bg-blue-500/10 text-slate-900 dark:text-white'
                    : 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={shortcutKeys.includes(shortcut.key)}
                  onChange={() => toggleShortcut(shortcut.key)}
                />
                <span>{shortcut.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-xs text-slate-500 dark:text-gray-400">
          Email associé : <span className="font-medium text-slate-700 dark:text-gray-200">{user?.email || '-'}</span>
        </div>

        {(error || formError) && (
          <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
            {formError || error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all bg-slate-900 text-white dark:bg-white dark:text-black hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
        >
          {saving ? 'Enregistrement...' : 'Terminer l’onboarding'}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
