import type { OrdreInitial } from '../types/soiec';
import { getSimpleSectionContentList } from './soiec';
import { getJsPDF } from './jspdf';
import {
  applyBoardExportMeta,
  buildFilename,
  captureBoardCanvas,
  escapeHtml,
  ExportMeta,
  isExtendedRole
} from './exportShared';

export const exportBoardDesignImage = async (el: HTMLElement, opts?: ExportMeta) => {
  const canvas = await captureBoardCanvas(el);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = buildFilename('png', opts);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportBoardDesignPdf = async (el: HTMLElement, opts?: ExportMeta) => {
  const canvas = await captureBoardCanvas(el);
  applyBoardExportMeta(canvas, opts);
  const imgData = canvas.toDataURL('image/jpeg', 0.75);
  const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
  const JsPDF = await getJsPDF();
  const pdf = new JsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  pdf.save(buildFilename('pdf', opts));
};

export const exportBoardDesignWord = async (el: HTMLElement, opts?: ExportMeta) => {
  const canvas = await captureBoardCanvas(el);
  const dataUrl = canvas.toDataURL('image/png');
  const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body style="margin:0; padding:20px; background:#111;">
          <img src="${dataUrl}" style="max-width:100%; height:auto;" />
        </body>
      </html>
    `;
  const blob = new Blob([html], { type: 'application/msword' });
  const fileName = buildFilename('doc', opts);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildBoardHtmlTemplate = (ordre: OrdreInitial, opts?: ExportMeta) => {
  const metaLines = [];
  if (opts?.adresse) metaLines.push(`<div class="meta">Adresse : ${escapeHtml(opts.adresse)}</div>`);
  if (opts?.heure) metaLines.push(`<div class="meta">Heure : ${escapeHtml(opts.heure)}</div>`);
  const anticipationItems = getSimpleSectionContentList(ordre.A);
  const logistiqueItems = getSimpleSectionContentList(ordre.L);
  const includeAnticipation = isExtendedRole(opts?.role) || anticipationItems.length > 0;
  const includeLogistique = isExtendedRole(opts?.role) || logistiqueItems.length > 0;

  const executionData = Array.isArray(ordre.E)
    ? ordre.E
      .filter((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        return entry.type !== 'separator' && entry.type !== 'empty';
      })
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        const mission = typeof entry.mission === 'string' ? entry.mission : '';
        const moyen = typeof entry.moyen === 'string' ? entry.moyen : '';
        return `${mission} – ${moyen}`.trim();
      })
    : [typeof ordre.E === 'string' ? ordre.E : String(ordre.E ?? '')];

  const columns = [
    { title: 'Situation', color: '#1e3a8a', data: getSimpleSectionContentList(ordre.S) },
    ...(includeAnticipation ? [{ title: 'Anticipation', color: '#0f766e', data: anticipationItems }] : []),
    { title: 'Objectif', color: '#065f46', data: getSimpleSectionContentList(ordre.O) },
    { title: 'Idée de manœuvre', color: '#92400e', data: (ordre.I || []).filter((i) => i?.type !== 'separator' && i?.type !== 'empty').map((i) => i.mission || '') },
    { title: 'Exécution', color: '#7f1d1d', data: executionData },
    { title: 'Commandement', color: '#6b21a8', data: getSimpleSectionContentList(ordre.C) },
    ...(includeLogistique ? [{ title: 'Logistique', color: '#c2410c', data: logistiqueItems }] : [])
  ];

  const cardsHtml = columns.map((col) => `
      <div class="column">
        <div class="column-header" style="background:${col.color};">${escapeHtml(col.title)}</div>
        <div class="column-body">
          ${col.data && col.data.length
            ? col.data.map((item) => `<div class="card">${escapeHtml(item)}</div>`).join('')
            : `<div class="card empty">Aucun élément</div>`}
        </div>
      </div>
    `).join('');

  return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { margin:0; padding:20px; background:#0b0c10; color:#e5e7eb; font-family: 'Segoe UI', Arial, sans-serif; }
            .meta { color:#9ca3af; font-size:14px; margin-bottom:4px; }
            .board { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
            .column { background:#0f172a; border:1px solid #1f2937; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.35); overflow:hidden; }
            .column-header { padding:10px 12px; font-weight:700; color:#f9fafb; }
            .column-body { padding:12px; display:flex; flex-direction:column; gap:8px; }
            .card { padding:10px 12px; border-radius:10px; border:1px solid #1f2937; background:#111827; color:#e5e7eb; }
            .card.empty { color:#6b7280; font-style:italic; }
          </style>
        </head>
        <body>
          ${metaLines.join('')}
          <div class="board">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;
};

export const exportBoardDesignWordEditable = async (ordre: OrdreInitial, opts?: ExportMeta) => {
  const html = buildBoardHtmlTemplate(ordre, opts);
  const blob = new Blob([html], { type: 'application/msword' });
  const fileName = buildFilename('doc', opts);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
