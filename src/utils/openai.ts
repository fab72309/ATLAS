import { auth, authReady } from './firebase';
import { DOCTRINE_CONTEXT } from '../constants/doctrine';

const DEFAULT_PROXY_URL = import.meta.env.VITE_OPENAI_PROXY_URL;

const sanitizeSections = (sections?: Record<string, string>) => {
  if (!sections) return undefined;
  const entries = Object.entries(sections)
    .map(([key, value]) => [key, value?.trim?.() ?? ''] as const)
    .filter(([, value]) => Boolean(value));
  return entries.length ? Object.fromEntries(entries) : undefined;
};

const buildContextualSituation = (
  situation: string,
  opts?: {
    dominante?: string;
    secondaryRisks?: string[];
    extraContext?: string;
  }
) => {
  const trimmedSituation = situation?.trim();
  const segments = trimmedSituation ? [trimmedSituation] : [];

  if (opts?.dominante) {
    segments.push(`Dominante identifiée : ${opts.dominante}`);
  }
  if (opts?.secondaryRisks?.length) {
    segments.push(`Risques secondaires : ${opts.secondaryRisks.join(', ')}`);
  }
  if (opts?.extraContext) {
    segments.push(`Contexte additionnel : ${opts.extraContext.trim()}`);
  }

  segments.push(`Doctrine de référence : ${JSON.stringify(DOCTRINE_CONTEXT)}`);

  return segments.filter(Boolean).join('\n\n');
};

export const analyzeEmergency = async (
  situation: string,
  type: 'group' | 'column' | 'site' | 'communication',
  opts?: {
    dominante?: string;
    secondaryRisks?: string[];
    extraContext?: string;
    sections?: Record<string, string>;
  }
) => {
  try {
    const proxyUrl = DEFAULT_PROXY_URL || '/analyze';
    if (!proxyUrl) {
      throw new Error('URL du proxy OpenAI manquante (VITE_OPENAI_PROXY_URL).');
    }

    await authReady;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Utilisateur non authentifié pour appeler le proxy IA.');
    }
    const token = await currentUser.getIdToken();

    const sections = sanitizeSections(opts?.sections);
    if (!situation?.trim() && !sections) {
      throw new Error('Une situation ou des sections renseignées sont requises.');
    }

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        type,
        dominante: opts?.dominante,
        sections,
        situation: buildContextualSituation(situation, opts)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur lors de l'appel à l'IA: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.result || data.output_text || data.output || data.content || JSON.stringify(data);
  } catch (error: unknown) {
    console.error('Error analyzing emergency:', error);
    if (error instanceof Error) {
      throw new Error(error.message || "Erreur lors de l'analyse de la situation d'urgence.");
    }
    throw new Error("Erreur lors de l'analyse de la situation d'urgence.");
  }
};
