import { OrdreInitial, IdeeManoeuvre, ExecutionItem, SimpleSection, SimpleSectionItem } from '../types/soiec';

const resolveRoleLabel = (role?: string) => role || 'Chef de groupe';
const isExtendedRole = (role?: string) => role === 'Chef de colonne' || role === 'Chef de site';

export const buildOrdreTitle = (role?: string) => `ORDRE INITIAL – ${resolveRoleLabel(role)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeSimpleSectionItem = (value: unknown): SimpleSectionItem | null => {
    if (typeof value === 'string') {
        return value.trim() ? value : { type: 'empty' };
    }
    if (typeof value === 'number') return String(value);
    if (!isRecord(value)) return null;

    const rawType = typeof value.type === 'string'
        ? value.type
        : typeof value.kind === 'string'
            ? value.kind
            : undefined;

    if (rawType === 'separator') return { type: 'separator' };
    if (rawType === 'empty') return { type: 'empty' };

    const contentRaw = value.content ?? value.text ?? value.label;
    if (typeof contentRaw === 'string' || typeof contentRaw === 'number') {
        const content = String(contentRaw);
        if (rawType === 'objective') {
            const id = typeof value.id === 'string' ? value.id : undefined;
            if (id) return { type: 'objective', id, content };
            return { type: 'objective', id: `objective-${Math.random().toString(36).slice(2, 9)}`, content };
        }
        if (rawType === 'text') {
            const id = typeof value.id === 'string' ? value.id : undefined;
            return id ? { type: 'text', id, content } : { content };
        }
        return { content };
    }

    return JSON.stringify(value);
};

export const normalizeSimpleSectionItems = (value: unknown): SimpleSectionItem[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value
            .map((entry) => normalizeSimpleSectionItem(entry))
            .filter((entry): entry is SimpleSectionItem => entry !== null);
    }
    if (typeof value === 'string') {
        return value
            .split('\n')
            .map((entry) => entry.trim())
            .filter(Boolean);
    }
    const normalized = normalizeSimpleSectionItem(value);
    return normalized ? [normalized] : [];
};

export const getSimpleSectionContentList = (value: SimpleSection | SimpleSectionItem[] | undefined): string[] => {
    const items = normalizeSimpleSectionItems(value);
    return items
        .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'content' in item) {
                const content = (item as { content?: unknown }).content;
                if (typeof content === 'string') return content;
                if (typeof content === 'number') return String(content);
            }
            return null;
        })
        .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
};

export const getSimpleSectionText = (value: SimpleSection | SimpleSectionItem[] | undefined): string => (
    getSimpleSectionContentList(value).join('\n')
);

const toIdeeManoeuvre = (value: unknown): IdeeManoeuvre => {
    if (typeof value === 'string') {
        return { mission: value, moyen: '' };
    }
    if (!value || typeof value !== 'object') {
        return { mission: JSON.stringify(value), moyen: '' };
    }
    const record = value as Record<string, unknown>;
    const recordType = typeof record.type === 'string' ? record.type : undefined;
    if (recordType === 'separator' || recordType === 'empty') {
        return { mission: '', moyen: '', type: recordType };
    }
    const mission = typeof record.mission === 'string' ? record.mission : JSON.stringify(value);
    const moyen = typeof record.moyen === 'string' ? record.moyen : '';
    const idee: IdeeManoeuvre = { mission, moyen };
    if (typeof record.color === 'string') idee.color = record.color;
    if (typeof record.moyen_supp === 'string') idee.moyen_supp = record.moyen_supp;
    if (typeof record.details === 'string') idee.details = record.details;
    if (typeof record.objective_id === 'string') idee.objective_id = record.objective_id;
    if (!idee.objective_id && typeof record.objectiveId === 'string') idee.objective_id = record.objectiveId;
    if (typeof record.order_in_objective === 'number') idee.order_in_objective = record.order_in_objective;
    if (recordType === 'idea') idee.type = 'idea';
    return idee;
};

export const parseOrdreInitial = (jsonString: string): OrdreInitial => {
    try {
        // Nettoyage basique si le JSON est entouré de balises markdown
        const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        // Structure par défaut pour éviter les crashs
        const defaultOrdre: OrdreInitial = {
            S: "Situation non renseignée",
            A: [],
            O: [],
            I: [],
            E: "Exécution non renseignée",
            L: [],
            C: "Commandement non renseigné"
        };

        const analyseTactique = parsed._analyse_tactique || parsed.analyse_tactique || parsed.analyseTactique;
        const colors = parsed._colors && typeof parsed._colors === 'object' ? parsed._colors : undefined;

        // Normalisation des champs
        const normalized = {
            S: parsed.S || parsed.Situation || parsed.situation || defaultOrdre.S,
            A: parsed.A || parsed.Anticipation || parsed.anticipation || [],
            O: parsed.O || parsed.Objectifs || parsed.objectifs || parsed.Objectif || parsed.objectif || defaultOrdre.O,
            I: parsed.I || parsed.IM || parsed.IdeesManoeuvre || parsed.idees_manoeuvre || parsed.IdeeManoeuvre || defaultOrdre.I,
            E: parsed.E || parsed.Execution || parsed.execution || defaultOrdre.E,
            L: parsed.L || parsed.Logistique || parsed.logistique || [],
            C: parsed.C || parsed.Commandement || parsed.commandement || defaultOrdre.C
        };

        // Détection intelligente : si E contient le tableau structuré (mission/moyen)
        let finalI = normalized.I;
        let finalE = normalized.E;

        // Si E est un tableau (ou une chaîne qui est un tableau JSON), on regarde ce qu'il y a dedans
        let parsedE = finalE;
        if (typeof finalE === 'string' && (finalE.trim().startsWith('[') || finalE.trim().startsWith('{'))) {
            try { parsedE = JSON.parse(finalE); } catch (err) { void err; }
        }

        // Si E est un tableau d'objets avec "mission" ou "moyen", c'est bien l'Exécution (qui fait quoi avec quoi)
        // On s'assure que finalE contient ces données structurées
        if (Array.isArray(parsedE) && parsedE.length > 0 && (parsedE[0].mission || parsedE[0].moyen)) {
            finalE = parsedE;

            // Si I était vide ou générique, on peut le laisser tel quel ou mettre un texte par défaut
            if (!finalI || (Array.isArray(finalI) && finalI.length === 0)) {
                finalI = ["Voir détail de l'exécution ci-dessous"];
            }
        }

        // Fusion avec les données parsées
        return {
            ...defaultOrdre,
            ...(analyseTactique ? { _analyse_tactique: analyseTactique } : {}),
            ...(colors ? { _colors: colors } : {}),
            S: typeof normalized.S === 'string' ? normalized.S : normalizeSimpleSectionItems(normalized.S),
            A: normalizeSimpleSectionItems(normalized.A),
            O: normalizeSimpleSectionItems(normalized.O),

            // I est normalisé en liste d'IdeeManoeuvre.
            I: Array.isArray(finalI)
                ? finalI.map((i: unknown) => toIdeeManoeuvre(i))
                : (typeof finalI === 'string' ? [toIdeeManoeuvre(finalI)] : []),

            // E contient maintenant potentiellement les données structurées (Missions/Moyens)
            // Mais le type OrdreInitial définit E comme string pour l'instant. 
            // Il faut mettre à jour le type OrdreInitial ou stringifier ici si on ne change pas le type.
            // Le user veut que les moyens apparaissent dans la case adéquate.
            // On va modifier le type OrdreInitial pour que E puisse être IdeeManoeuvre[] aussi.
            E: finalE,

            L: normalizeSimpleSectionItems(normalized.L),

            C: typeof normalized.C === 'string' ? normalized.C : normalizeSimpleSectionItems(normalized.C)
        };
    } catch (error) {
        console.error("Erreur parsing OrdreInitial:", error);
        // Fallback en cas d'erreur de parsing
        return {
            S: "Erreur de lecture de la réponse IA",
            O: [],
            I: [],
            E: jsonString, // On met le texte brut dans E pour qu'il soit au moins visible
            C: "",
            A: [],
            L: []
        };
    }
};

export const generateOrdreInitialText = (
    ordre: OrdreInitial,
    meta?: { adresse?: string; heure?: string; role?: string }
): string => {
    let text = `${buildOrdreTitle(meta?.role)}\n\n`;
    const anticipationItems = getSimpleSectionContentList(ordre.A);
    const logistiqueItems = getSimpleSectionContentList(ordre.L);
    const includeAnticipation = isExtendedRole(meta?.role) || anticipationItems.length > 0;
    const includeLogistique = isExtendedRole(meta?.role) || logistiqueItems.length > 0;
    const situationText = getSimpleSectionText(ordre.S);
    const commandementText = getSimpleSectionText(ordre.C);
    const objectifs = getSimpleSectionContentList(ordre.O);

    if (meta?.adresse) text += `Adresse: ${meta.adresse}\n`;
    if (meta?.heure) text += `Heure de saisie: ${meta.heure}\n`;
    if (meta?.adresse || meta?.heure) text += "\n";

    text += "S – SITUATION\n";
    text += `${situationText}\n\n`;

    if (includeAnticipation) {
        text += "A – ANTICIPATION\n";
        if (anticipationItems.length > 0) {
            anticipationItems.forEach((item, index) => {
                text += `${index + 1}. ${item}\n`;
            });
        } else {
            text += "Aucune anticipation spécifiée.\n";
        }
        text += "\n";
    }

    text += "O – OBJECTIFS\n";
    if (objectifs.length > 0) {
        objectifs.forEach((obj, index) => {
            text += `${index + 1}. ${obj}\n`;
        });
    } else {
        text += "Aucun objectif spécifié.\n";
    }
    text += "\n";

    text += "I – IDÉES DE MANŒUVRE\n";
    const ideeItems = Array.isArray(ordre.I) ? ordre.I.filter((im) => im?.type !== 'separator' && im?.type !== 'empty') : [];
    if (ideeItems.length > 0) {
        ideeItems.forEach((im, index) => {
            text += `IM${index + 1} – ${im.mission}\n`;
            text += `- Moyens : ${im.moyen}\n`;
            if (im.moyen_supp) text += `- Moyens suppl. : ${im.moyen_supp}\n`;
            if (im.details) text += `- Détails : ${im.details}\n`;
            text += "\n";
        });
    } else {
        text += "Aucune idée de manœuvre spécifiée.\n\n";
    }

    text += "E – EXÉCUTION\n";
    if (Array.isArray(ordre.E)) {
        const executionItems = (ordre.E as ExecutionItem[]).filter((entry) => entry?.type !== 'separator' && entry?.type !== 'empty');
        if (executionItems.length > 0) {
            executionItems.forEach((entry, index) => {
                const mission = entry.mission || '';
                const moyen = entry.moyen ? ` (${entry.moyen})` : '';
                const moyenSupp = entry.moyen_supp ? ` + ${entry.moyen_supp}` : '';
                const details = entry.details ? ` — ${entry.details}` : '';
                text += `${index + 1}. ${mission}${moyen}${moyenSupp}${details}`.trim() + "\n";
            });
            text += "\n";
        } else {
            text += "Aucune exécution spécifiée.\n\n";
        }
    } else {
        text += `${ordre.E}\n\n`;
    }

    text += "C – COMMANDEMENT\n";
    text += `${commandementText}\n`;

    if (includeLogistique) {
        text += "\nL – LOGISTIQUE\n";
        if (logistiqueItems.length > 0) {
            logistiqueItems.forEach((item, index) => {
                text += `${index + 1}. ${item}\n`;
            });
        } else {
            text += "Aucune logistique spécifiée.\n";
        }
    }

    return text;
};

export const generateOrdreInitialShortText = (ordre: OrdreInitial): string => {
    // Version condensée pour SMS
    let text = "ORDRE INITIAL\n\n";
    const situationText = getSimpleSectionText(ordre.S);
    text += `S: ${situationText.substring(0, 100)}${situationText.length > 100 ? '...' : ''}\n\n`;

    const anticipationItems = getSimpleSectionContentList(ordre.A);
    if (anticipationItems.length > 0) {
        text += "A:\n";
        anticipationItems.forEach((item, i) => text += `${i + 1}. ${item}\n`);
        text += "\n";
    }

    text += "O:\n";
    const objectifs = getSimpleSectionContentList(ordre.O);
    objectifs.forEach((obj, i) => text += `${i + 1}. ${obj}\n`);
    text += "\n";

    text += "I:\n";
    const ideeItems = Array.isArray(ordre.I) ? ordre.I.filter((im) => im?.type !== 'separator' && im?.type !== 'empty') : [];
    ideeItems.forEach((im, i) => text += `${i + 1}. ${im.mission} (${im.moyen})\n`);

    const logistiqueItems = getSimpleSectionContentList(ordre.L);
    if (logistiqueItems.length > 0) {
        text += "\nL:\n";
        logistiqueItems.forEach((item, i) => text += `${i + 1}. ${item}\n`);
    }

    return text;
};
