import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { OrdreInitial } from '../types/soiec';
import { buildOrdreTitle, generateOrdreInitialText, generateOrdreInitialShortText, getSimpleSectionContentList, getSimpleSectionText } from './soiec';
import { getJsPDF } from './jspdf';

const buildMeta = (opts?: { adresse?: string; heure?: string; role?: string }) => ({
    adresse: opts?.adresse,
    heure: opts?.heure,
    role: opts?.role
});

const isExtendedRole = (role?: string) => role === 'Chef de colonne' || role === 'Chef de site';

const slugify = (input: string) =>
    input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

const formatDatePart = (heure?: string) => {
    const d = heure ? new Date(heure) : new Date();
    if (isNaN(d.getTime())) {
        const safe = (heure || '').replace(/[^0-9]/g, '');
        return safe || Date.now().toString();
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const buildFilename = (ext: string, opts?: { adresse?: string; heure?: string; role?: string }) => {
    const base = opts?.adresse ? slugify(opts.adresse) || 'ordre-initial' : 'ordre-initial';
    const datePart = formatDatePart(opts?.heure);
    return `${base}-${datePart}.${ext}`;
};

const escapeHtml = (input: string) =>
    input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const formatExportTimestamp = (heure?: string) => {
    const parsed = heure ? new Date(heure) : new Date();
    const safeDate = isNaN(parsed.getTime()) ? new Date() : parsed;
    return {
        dateLabel: safeDate.toLocaleDateString('fr-FR'),
        timeLabel: safeDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
};

const applyBoardExportMeta = (canvas: HTMLCanvasElement, opts?: { adresse?: string; heure?: string; role?: string }) => {
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

export const exportOrdreToClipboard = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }): Promise<void> => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    await Clipboard.write({
        string: text
    });
};

export const exportOrdreToShare = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }): Promise<void> => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));

    const canShare = await Share.canShare();
    if (canShare.value) {
        await Share.share({
            title: 'Ordre Initial - A.T.L.A.S',
            text: text,
            dialogTitle: 'Partager l\'ordre initial'
        });
    } else {
        // Fallback clipboard si le partage n'est pas dispo
        await exportOrdreToClipboard(ordre, opts);
    }
};

export const exportOrdreToPdf = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }): Promise<void> => {
    const JsPDF = await getJsPDF();
    const doc = new JsPDF();
    const date = new Date().toLocaleDateString('fr-FR');
    const time = new Date().toLocaleTimeString('fr-FR');
    const filename = buildFilename('pdf', opts);
    const anticipationItems = getSimpleSectionContentList(ordre.A);
    const logistiqueItems = getSimpleSectionContentList(ordre.L);
    const objectifs = getSimpleSectionContentList(ordre.O);
    const situationText = getSimpleSectionText(ordre.S);
    const commandementText = getSimpleSectionText(ordre.C);
    const includeAnticipation = isExtendedRole(opts?.role) || anticipationItems.length > 0;
    const includeLogistique = isExtendedRole(opts?.role) || logistiqueItems.length > 0;

    // Configuration de la police
    doc.setFont("helvetica");

    // En-tête
    doc.setFontSize(20);
    doc.text(buildOrdreTitle(opts?.role), 20, 20);

    doc.setFontSize(10);
    doc.text(`Généré le ${date} à ${time} via A.T.L.A.S`, 20, 30);

    let yPos = 45;
    const leftMargin = 20;
    const contentWidth = 170;
    const lineHeight = 7;

    // Helper pour ajouter du texte avec retour à la ligne automatique
    const addText = (text: string, fontSize: number = 12, fontType: string = 'normal') => {
        doc.setFont("helvetica", fontType);
        doc.setFontSize(fontSize);

        const splitText = doc.splitTextToSize(text as string, contentWidth);

        // Vérifier si on doit changer de page
        if (yPos + (splitText.length * lineHeight) > 280) {
            doc.addPage();
            yPos = 20;
        }

        doc.text(splitText, leftMargin, yPos);
        yPos += (splitText.length * lineHeight) + 2;
    };

    // Meta
    if (opts?.adresse) {
        addText(`Adresse: ${opts.adresse}`, 11, 'bold');
    }
    if (opts?.heure) {
        addText(`Heure de saisie: ${opts.heure}`, 11, 'bold');
    }
    yPos += 3;

    // S - SITUATION
    addText('S – SITUATION', 14, 'bold');
    addText(situationText);
    yPos += 5;

    if (includeAnticipation) {
        addText('A – ANTICIPATION', 14, 'bold');
        if (anticipationItems.length > 0) {
            anticipationItems.forEach((item, i) => {
                addText(`${i + 1}. ${item}`);
            });
        } else {
            addText('Aucune anticipation spécifiée.');
        }
        yPos += 5;
    }

    // O - OBJECTIFS
    addText('O – OBJECTIFS', 14, 'bold');
    if (objectifs.length > 0) {
        objectifs.forEach((obj, i) => {
            addText(`${i + 1}. ${obj}`);
        });
    } else {
        addText("Aucun objectif spécifié.");
    }
    yPos += 5;

    // I - IDÉES DE MANŒUVRE
    addText('I – IDÉES DE MANŒUVRE', 14, 'bold');
    const ideeItems = ordre.I.filter((im) => im?.type !== 'separator' && im?.type !== 'empty');
    if (ideeItems.length > 0) {
        ideeItems.forEach((im, i) => {
            addText(`IM${i + 1} – ${im.mission}`, 12, 'bold');
            addText(`Moyens : ${im.moyen}`);
            if (im.moyen_supp) addText(`Moyens suppl. : ${im.moyen_supp}`);
            if (im.details) addText(`Détails : ${im.details}`);
            yPos += 3;
        });
    } else {
        addText("Aucune idée de manœuvre spécifiée.");
    }
    yPos += 5;

    // E - EXÉCUTION
    addText('E – EXÉCUTION', 14, 'bold');
    if (Array.isArray(ordre.E)) {
        const executionItems = ordre.E.filter((entry) => {
            if (!entry || typeof entry !== 'object') return true;
            const record = entry as Record<string, unknown>;
            return record.type !== 'separator' && record.type !== 'empty';
        });
        if (executionItems.length > 0) {
            executionItems.forEach((entry, index) => {
                if (typeof entry === 'string') {
                    addText(`${index + 1}. ${entry}`);
                    return;
                }
                const record = entry as Record<string, unknown>;
                const mission = typeof record.mission === 'string' ? record.mission : '';
                const moyen = typeof record.moyen === 'string' ? ` (${record.moyen})` : '';
                const moyenSupp = typeof record.moyen_supp === 'string' ? ` + ${record.moyen_supp}` : '';
                const details = typeof record.details === 'string' ? ` — ${record.details}` : '';
                addText(`${index + 1}. ${mission}${moyen}${moyenSupp}${details}`.trim());
            });
        } else {
            addText("Aucune exécution spécifiée.");
        }
    } else {
        addText(String(ordre.E ?? ''));
    }
    yPos += 5;

    // C - COMMANDEMENT
    addText('C – COMMANDEMENT', 14, 'bold');
    addText(commandementText);

    if (includeLogistique) {
        yPos += 5;
        addText('L – LOGISTIQUE', 14, 'bold');
        if (logistiqueItems.length > 0) {
            logistiqueItems.forEach((item, i) => {
                addText(`${i + 1}. ${item}`);
            });
        } else {
            addText('Aucune logistique spécifiée.');
        }
    }

    doc.save(filename);
};

export const exportOrdreToWord = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }) => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    const blob = new Blob([text], { type: 'application/msword' });
    const fileName = buildFilename('doc', opts);
    const file = new File([blob], fileName, { type: blob.type });

    // Try Web Share with file first
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Ordre Initial - A.T.L.A.S', text: 'Ordre initial (Word)' });
        return;
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const shareOrdreAsText = (ordre: OrdreInitial, channel: 'sms' | 'whatsapp' | 'mail', opts?: { adresse?: string; heure?: string; role?: string }) => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    const shortText = generateOrdreInitialShortText(ordre);
    const body = encodeURIComponent(text);
    const shortBody = encodeURIComponent(shortText);

    switch (channel) {
        case 'sms':
            window.location.href = `sms:?body=${shortBody}`;
            break;
        case 'whatsapp':
            window.location.href = `https://wa.me/?text=${body}`;
            break;
        case 'mail':
        default:
            window.location.href = `mailto:?subject=${encodeURIComponent('Ordre Initial - A.T.L.A.S')}&body=${body}`;
            break;
    }
};

export const shareOrdreAsFile = async (
    ordre: OrdreInitial,
    format: 'pdf' | 'word',
    channel: 'mail' | 'whatsapp' | 'sms',
    opts?: { adresse?: string; heure?: string; role?: string }
) => {
    void channel;
    const isPdf = format === 'pdf';
    if (isPdf) {
        const JsPDF = await getJsPDF();
        const doc = new JsPDF();
        const text = generateOrdreInitialText(ordre, buildMeta(opts));
        doc.text(text, 10, 10, { maxWidth: 190 });
        const blob = doc.output('blob');
        const file = new File([blob], buildFilename('pdf', opts), { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Ordre Initial - A.T.L.A.S', text: 'PDF' });
            return;
        }
        // fallback download
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        return;
    }

    // word
    await exportOrdreToWord(ordre, opts);
};

export const exportOrdreToImage = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }) => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    const lines = text.split('\n');

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const width = 1400;
    const lineHeight = 28;
    const padding = 40;
    canvas.width = width;
    canvas.height = padding * 2 + lines.length * lineHeight;

    // Background
    context.fillStyle = '#0b0c10';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    context.font = '16px "Helvetica Neue", Arial, sans-serif';
    context.fillStyle = '#E5E7EB';
    let y = padding;
    lines.forEach(line => {
        const chunks = line.match(/.{1,90}/g) || [''];
        chunks.forEach(chunk => {
            context.fillText(chunk, padding, y);
            y += lineHeight;
        });
    });

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = buildFilename('png', opts);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const captureBoardCanvas = async (el: HTMLElement) => {
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

export const exportBoardDesignImage = async (el: HTMLElement, opts?: { adresse?: string; heure?: string; role?: string }) => {
    const canvas = await captureBoardCanvas(el);
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = buildFilename('png', opts);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportBoardDesignPdf = async (el: HTMLElement, opts?: { adresse?: string; heure?: string; role?: string }) => {
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

export const exportBoardDesignWord = async (el: HTMLElement, opts?: { adresse?: string; heure?: string; role?: string }) => {
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

const buildBoardHtmlTemplate = (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }) => {
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
                const record = entry as Record<string, unknown>;
                return record.type !== 'separator' && record.type !== 'empty';
            })
            .map((entry) => {
                if (typeof entry === 'string') return entry;
                const record = (entry ?? {}) as Record<string, unknown>;
                const mission = typeof record.mission === 'string' ? record.mission : '';
                const moyen = typeof record.moyen === 'string' ? record.moyen : '';
                return `${mission} – ${moyen}`.trim();
            })
        : [typeof ordre.E === 'string' ? ordre.E : String(ordre.E ?? '')];

    const columns = [
        { title: 'Situation', color: '#1e3a8a', data: getSimpleSectionContentList(ordre.S) },
        ...(includeAnticipation ? [{ title: 'Anticipation', color: '#0f766e', data: anticipationItems }] : []),
        { title: 'Objectif', color: '#065f46', data: getSimpleSectionContentList(ordre.O) },
        { title: 'Idée de manœuvre', color: '#92400e', data: (ordre.I || []).filter((i) => i?.type !== 'separator' && i?.type !== 'empty').map(i => i.mission || '') },
        { title: 'Exécution', color: '#7f1d1d', data: executionData },
        { title: 'Commandement', color: '#6b21a8', data: getSimpleSectionContentList(ordre.C) },
        ...(includeLogistique ? [{ title: 'Logistique', color: '#c2410c', data: logistiqueItems }] : []),
    ];

    const cardsHtml = columns.map(col => `
      <div class="column">
        <div class="column-header" style="background:${col.color};">${escapeHtml(col.title)}</div>
        <div class="column-body">
          ${col.data && col.data.length
            ? col.data.map(item => `<div class="card">${escapeHtml(item)}</div>`).join('')
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

export const exportBoardDesignWordEditable = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string; role?: string }) => {
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
