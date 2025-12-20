import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'signup';

const errorMessageFromCode = (code?: string) => {
  switch (code) {
    case 'auth/invalid-email':
      return 'Email invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email ou mot de passe incorrect.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez plus tard.';
    case 'auth/email-already-in-use':
      return 'Un compte existe déjà avec cet email.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    default:
      return 'Connexion impossible. Merci de réessayer.';
  }
};

const LoginPage = () => {
  const { login, register, user, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [mode, setMode] = React.useState<Mode>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initializing && user) {
      navigate(from, { replace: true });
    }
  }, [initializing, user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(errorMessageFromCode(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0A0A0A] dark:text-white flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[520px] h-[520px] bg-blue-200/70 dark:bg-blue-500/10 rounded-full blur-[140px] -top-32 -left-20" />
        <div className="absolute w-[520px] h-[520px] bg-purple-200/60 dark:bg-purple-500/10 rounded-full blur-[140px] bottom-[-40px] right-[-60px]" />
      </div>

      <div className="relative w-full max-w-md bg-white/90 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-sm text-slate-500 dark:text-gray-400">A.T.L.A.S</p>
          <h1 className="text-2xl font-bold">Accès sécurisé</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {mode === 'login' ? 'Connectez-vous avec vos identifiants.' : 'Créez un compte pour accéder à l’application.'}
          </p>
        </div>

        <div className="flex mb-6 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'login' ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-black' : 'text-slate-500 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mode === 'signup' ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-black' : 'text-slate-500 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            Inscription
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-gray-300">Email</label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white/30"
              placeholder="prenom.nom@example.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-600 dark:text-gray-300">Mot de passe</label>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-white/30"
              placeholder="Au moins 6 caractères"
              required
            />
          </div>

          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all bg-slate-900 text-white dark:bg-white dark:text-black hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? 'En cours...' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
