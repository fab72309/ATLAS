type JsPdfModule = typeof import('jspdf');

const hasJsPdfExport = (mod: unknown): mod is JsPdfModule =>
  typeof mod === 'object' && mod !== null && 'jsPDF' in mod;

export const getJsPDF = async (): Promise<JsPdfModule['jsPDF']> => {
  const mod = await import('jspdf');
  if (hasJsPdfExport(mod) && typeof mod.jsPDF === 'function') {
    return mod.jsPDF;
  }
  const fallback = (mod as { default?: unknown }).default;
  if (typeof fallback === 'function') {
    return fallback as JsPdfModule['jsPDF'];
  }
  throw new Error('jsPDF export not found');
};
