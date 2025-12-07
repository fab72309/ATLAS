import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { jsPDF } from 'jspdf';
import { OrdreInitial } from '../types/soiec';
import { generateOrdreInitialText, generateOrdreInitialShortText } from './soiec';

const buildMeta = (opts?: { adresse?: string; heure?: string }) => ({
    adresse: opts?.adresse,
    heure: opts?.heure
});

export const exportOrdreToClipboard = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string }): Promise<void> => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    await Clipboard.write({
        string: text
    });
};

export const exportOrdreToShare = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string }): Promise<void> => {
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

export const exportOrdreToPdf = (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string }): void => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('fr-FR');
    const time = new Date().toLocaleTimeString('fr-FR');

    // Configuration de la police
    doc.setFont("helvetica");

    // En-tête
    doc.setFontSize(20);
    doc.text('ORDRE INITIAL – Chef de groupe', 20, 20);

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

        const splitText = doc.splitTextToSize(text, contentWidth);

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
    addText(ordre.S);
    yPos += 5;

    // O - OBJECTIFS
    addText('O – OBJECTIFS', 14, 'bold');
    if (ordre.O.length > 0) {
        ordre.O.forEach((obj, i) => {
            addText(`${i + 1}. ${obj}`);
        });
    } else {
        addText("Aucun objectif spécifié.");
    }
    yPos += 5;

    // I - IDÉES DE MANŒUVRE
    addText('I – IDÉES DE MANŒUVRE', 14, 'bold');
    if (ordre.I.length > 0) {
        ordre.I.forEach((im, i) => {
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
    addText(ordre.E);
    yPos += 5;

    // C - COMMANDEMENT
    addText('C – COMMANDEMENT', 14, 'bold');
    addText(ordre.C);

    doc.save(`atlas-ordre-initial-${Date.now()}.pdf`);
};

export const exportOrdreToWord = async (ordre: OrdreInitial, opts?: { adresse?: string; heure?: string }) => {
    const text = generateOrdreInitialText(ordre, buildMeta(opts));
    const blob = new Blob([text], { type: 'application/msword' });
    const fileName = `atlas-ordre-initial-${Date.now()}.doc`;
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

export const shareOrdreAsText = (ordre: OrdreInitial, channel: 'sms' | 'whatsapp' | 'mail', opts?: { adresse?: string; heure?: string }) => {
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
    opts?: { adresse?: string; heure?: string }
) => {
    const isPdf = format === 'pdf';
    if (isPdf) {
        const doc = new jsPDF();
        const text = generateOrdreInitialText(ordre, buildMeta(opts));
        doc.text(text, 10, 10, { maxWidth: 190 });
        const blob = doc.output('blob');
        const file = new File([blob], `atlas-ordre-initial-${Date.now()}.pdf`, { type: 'application/pdf' });
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
