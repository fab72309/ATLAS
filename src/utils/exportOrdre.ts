import { Clipboard } from '@capacitor/clipboard';
import { Share } from '@capacitor/share';
import type { OrdreInitial } from '../types/soiec';
import {
  buildOrdreTitle,
  generateOrdreInitialShortText,
  generateOrdreInitialText,
  getSimpleSectionContentList,
  getSimpleSectionText
} from './soiec';
import { getJsPDF } from './jspdf';
import { buildFilename, buildMeta, ExportMeta, isExtendedRole } from './exportShared';

export const exportOrdreToClipboard = async (ordre: OrdreInitial, opts?: ExportMeta): Promise<void> => {
  const text = generateOrdreInitialText(ordre, buildMeta(opts));
  await Clipboard.write({ string: text });
};

export const exportOrdreToShare = async (ordre: OrdreInitial, opts?: ExportMeta): Promise<void> => {
  const text = generateOrdreInitialText(ordre, buildMeta(opts));
  const canShare = await Share.canShare();
  if (canShare.value) {
    await Share.share({
      title: 'Ordre Initial - A.T.L.A.S',
      text,
      dialogTitle: 'Partager l\'ordre initial'
    });
    return;
  }
  await exportOrdreToClipboard(ordre, opts);
};

export const exportOrdreToPdf = async (ordre: OrdreInitial, opts?: ExportMeta): Promise<void> => {
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

  doc.setFont('helvetica');
  doc.setFontSize(20);
  doc.text(buildOrdreTitle(opts?.role), 20, 20);
  doc.setFontSize(10);
  doc.text(`Généré le ${date} à ${time} via A.T.L.A.S`, 20, 30);

  let yPos = 45;
  const leftMargin = 20;
  const contentWidth = 170;
  const lineHeight = 7;

  const addText = (text: string, fontSize = 12, fontType: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', fontType);
    doc.setFontSize(fontSize);

    const splitText = doc.splitTextToSize(text, contentWidth);
    if (yPos + (splitText.length * lineHeight) > 280) {
      doc.addPage();
      yPos = 20;
    }

    doc.text(splitText, leftMargin, yPos);
    yPos += (splitText.length * lineHeight) + 2;
  };

  if (opts?.adresse) addText(`Adresse: ${opts.adresse}`, 11, 'bold');
  if (opts?.heure) addText(`Heure de saisie: ${opts.heure}`, 11, 'bold');
  yPos += 3;

  addText('S – SITUATION', 14, 'bold');
  addText(situationText);
  yPos += 5;

  if (includeAnticipation) {
    addText('A – ANTICIPATION', 14, 'bold');
    if (anticipationItems.length > 0) {
      anticipationItems.forEach((item, index) => addText(`${index + 1}. ${item}`));
    } else {
      addText('Aucune anticipation spécifiée.');
    }
    yPos += 5;
  }

  addText('O – OBJECTIFS', 14, 'bold');
  if (objectifs.length > 0) {
    objectifs.forEach((item, index) => addText(`${index + 1}. ${item}`));
  } else {
    addText('Aucun objectif spécifié.');
  }
  yPos += 5;

  addText('I – IDÉES DE MANŒUVRE', 14, 'bold');
  const ideeItems = ordre.I.filter((item) => item?.type !== 'separator' && item?.type !== 'empty');
  if (ideeItems.length > 0) {
    ideeItems.forEach((item, index) => {
      addText(`IM${index + 1} – ${item.mission}`, 12, 'bold');
      addText(`Moyens : ${item.moyen}`);
      if (item.moyen_supp) addText(`Moyens suppl. : ${item.moyen_supp}`);
      if (item.details) addText(`Détails : ${item.details}`);
      yPos += 3;
    });
  } else {
    addText('Aucune idée de manœuvre spécifiée.');
  }
  yPos += 5;

  addText('E – EXÉCUTION', 14, 'bold');
  if (Array.isArray(ordre.E)) {
    const executionItems = ordre.E.filter((entry) => {
      if (!entry || typeof entry !== 'object') return true;
      return entry.type !== 'separator' && entry.type !== 'empty';
    });
    if (executionItems.length > 0) {
      executionItems.forEach((entry, index) => {
        if (typeof entry === 'string') {
          addText(`${index + 1}. ${entry}`);
          return;
        }
        const mission = typeof entry.mission === 'string' ? entry.mission : '';
        const moyen = typeof entry.moyen === 'string' ? ` (${entry.moyen})` : '';
        const moyenSupp = typeof entry.moyen_supp === 'string' ? ` + ${entry.moyen_supp}` : '';
        const details = typeof entry.details === 'string' ? ` — ${entry.details}` : '';
        addText(`${index + 1}. ${mission}${moyen}${moyenSupp}${details}`.trim());
      });
    } else {
      addText('Aucune exécution spécifiée.');
    }
  } else {
    addText(String(ordre.E ?? ''));
  }
  yPos += 5;

  addText('C – COMMANDEMENT', 14, 'bold');
  addText(commandementText);

  if (includeLogistique) {
    yPos += 5;
    addText('L – LOGISTIQUE', 14, 'bold');
    if (logistiqueItems.length > 0) {
      logistiqueItems.forEach((item, index) => addText(`${index + 1}. ${item}`));
    } else {
      addText('Aucune logistique spécifiée.');
    }
  }

  doc.save(filename);
};

export const exportOrdreToWord = async (ordre: OrdreInitial, opts?: ExportMeta) => {
  const text = generateOrdreInitialText(ordre, buildMeta(opts));
  const blob = new Blob([text], { type: 'application/msword' });
  const fileName = buildFilename('doc', opts);
  const file = new File([blob], fileName, { type: blob.type });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Ordre Initial - A.T.L.A.S', text: 'Ordre initial (Word)' });
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const shareOrdreAsText = (ordre: OrdreInitial, channel: 'sms' | 'whatsapp' | 'mail', opts?: ExportMeta) => {
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
  opts?: ExportMeta
) => {
  void channel;
  if (format === 'pdf') {
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
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    return;
  }

  await exportOrdreToWord(ordre, opts);
};

export const exportOrdreToImage = async (ordre: OrdreInitial, opts?: ExportMeta) => {
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

  context.fillStyle = '#0b0c10';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = '16px "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = '#E5E7EB';
  let y = padding;
  lines.forEach((line) => {
    const chunks = line.match(/.{1,90}/g) || [''];
    chunks.forEach((chunk) => {
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
