export type ExportMeta = {
  adresse?: string;
  heure?: string;
  role?: string;
};

export const buildMeta = (opts?: ExportMeta): ExportMeta => ({
  adresse: opts?.adresse,
  heure: opts?.heure,
  role: opts?.role
});

export const isExtendedRole = (role?: string) => role === 'Chef de colonne' || role === 'Chef de site';

const slugify = (input: string) =>
  input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const formatDatePart = (heure?: string) => {
  const d = heure ? new Date(heure) : new Date();
  if (Number.isNaN(d.getTime())) {
    const safe = (heure || '').replace(/[^0-9]/g, '');
    return safe || Date.now().toString();
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export const buildFilename = (ext: string, opts?: ExportMeta) => {
  const base = opts?.adresse ? slugify(opts.adresse) || 'ordre-initial' : 'ordre-initial';
  const datePart = formatDatePart(opts?.heure);
  return `${base}-${datePart}.${ext}`;
};

export const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const formatExportTimestamp = (heure?: string) => {
  const parsed = heure ? new Date(heure) : new Date();
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    dateLabel: safeDate.toLocaleDateString('fr-FR'),
    timeLabel: safeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };
};

export const applyBoardExportMeta = (canvas: HTMLCanvasElement, opts?: ExportMeta) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { dateLabel, timeLabel } = formatExportTimestamp(opts?.heure);
  const lines: string[] = [];
  if (opts?.adresse) {
    lines.push(`Adresse: ${opts.adresse}`);
  }
  lines.push(`Edition: ${dateLabel} ${timeLabel}`);
  const fontSize = Math.min(18, Math.max(12, Math.round(canvas.width * 0.012)));
  ctx.font = `${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const lineHeight = Math.round(fontSize * 1.25);
  const padding = Math.round(fontSize * 0.8);
  const maxWidth = Math.round(canvas.width * 0.45);

  const wrapLine = (text: string) => {
    const words = text.split(' ');
    const wrapped: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !current) {
        current = next;
      } else {
        wrapped.push(current);
        current = word;
      }
    }
    if (current) wrapped.push(current);
    return wrapped;
  };

  const wrappedLines = lines.flatMap((line) => wrapLine(line));
  if (wrappedLines.length === 0) return;
  const maxLineWidth = Math.max(...wrappedLines.map((line) => ctx.measureText(line).width));
  const blockHeight = lineHeight * wrappedLines.length;
  const x = canvas.width - padding;
  const y = canvas.height - padding - blockHeight;

  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - maxLineWidth - padding, y - padding, maxLineWidth + padding * 2, blockHeight + padding * 2);
  ctx.restore();

  ctx.fillStyle = '#111111';
  wrappedLines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
};

export const captureBoardCanvas = async (el: HTMLElement) => {
  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(el, {
    backgroundColor: '#0b0c10',
    scale: 2,
    useCORS: true,
    allowTaint: true,
    ignoreElements: (element) => {
      const attr = (element as HTMLElement).dataset?.exportHide;
      return attr === 'true';
    }
  });
};
