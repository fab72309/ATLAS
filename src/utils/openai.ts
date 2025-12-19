import { auth } from './firebase';

type CommandType = 'group' | 'column' | 'site' | 'communication';

type AnalyzeOptions = {
  dominante?: string;
  secondaryRisks?: string[];
  extraContext?: string;
  sections?: Record<string, string>;
};

const buildProxyUrl = (url: string) => url.endsWith('/analyze') ? url : `${url.replace(/\/$/, '')}/analyze`;

export const analyzeEmergency = async (
  situation: string,
  type: CommandType,
  opts?: AnalyzeOptions
) => {
  const proxy = import.meta.env.VITE_OPENAI_PROXY_URL;
  if (!proxy) throw new Error('URL du proxy IA manquante (VITE_OPENAI_PROXY_URL).');

  const user = auth.currentUser;
  if (!user) throw new Error('Authentification requise avant d\'appeler l’IA.');

  const idToken = await user.getIdToken();
  const response = await fetch(buildProxyUrl(proxy), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({
      situation,
      type,
      extra: {
        dominante: opts?.dominante,
        secondaryRisks: opts?.secondaryRisks,
        extraContext: opts?.extraContext,
        sections: opts?.sections
      }
    })
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // ignore JSON parse errors to surface a generic message below
  }

  if (!response.ok) {
    const message = data?.error || `Erreur lors de l'appel au proxy IA (${response.status}).`;
    throw new Error(message);
  }

  const content = typeof data?.content === 'string'
    ? data.content
    : typeof data?.result === 'string'
      ? data.result
      : '';

  if (!content) throw new Error('Réponse IA vide ou invalide.');
  return content;
};
