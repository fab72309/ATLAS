import { OrdreInitial, IdeeManoeuvre } from '../types/soiec';

const resolveRoleLabel = (role?: string) => role || 'Chef de groupe';
const isExtendedRole = (role?: string) => role === 'Chef de colonne' || role === 'Chef de site';

export const buildOrdreTitle = (role?: string) => `ORDRE INITIAL – ${resolveRoleLabel(role)}`;

const toIdeeManoeuvre = (value: unknown): IdeeManoeuvre => {
    if (typeof value === 'string') {
        return { mission: value, moyen: '' };
    }
    if (!value || typeof value !== 'object') {
        return { mission: JSON.stringify(value), moyen: '' };
    }
    const record = value as Record<string, unknown>;
    const mission = typeof record.mission === 'string' ? record.mission : JSON.stringify(value);
    const moyen = typeof record.moyen === 'string' ? record.moyen : '';
    const idee: IdeeManoeuvre = { mission, moyen };
    if (typeof record.moyen_supp === 'string') idee.moyen_supp = record.moyen_supp;
    if (typeof record.details === 'string') idee.details = record.details;
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
            S: normalized.S,
            // Assurer que A est un tableau de chaînes
            A: Array.isArray(normalized.A)
                ? normalized.A.map((a: unknown) => typeof a === 'string' ? a : JSON.stringify(a))
                : (normalized.A ? [typeof normalized.A === 'string' ? normalized.A : JSON.stringify(normalized.A)] : []),
            // Assurer que O est un tableau de chaînes
            O: Array.isArray(normalized.O)
                ? normalized.O.map((o: unknown) => typeof o === 'string' ? o : JSON.stringify(o))
                : (normalized.O ? [typeof normalized.O === 'string' ? normalized.O : JSON.stringify(normalized.O)] : []),

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

            // Assurer que L est un tableau de chaînes
            L: Array.isArray(normalized.L)
                ? normalized.L.map((l: unknown) => typeof l === 'string' ? l : JSON.stringify(l))
                : (normalized.L ? [typeof normalized.L === 'string' ? normalized.L : JSON.stringify(normalized.L)] : []),

            C: normalized.C
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
    const includeAnticipation = isExtendedRole(meta?.role) || (Array.isArray(ordre.A) && ordre.A.length > 0);
    const includeLogistique = isExtendedRole(meta?.role) || (Array.isArray(ordre.L) && ordre.L.length > 0);
    const anticipationItems = Array.isArray(ordre.A) ? ordre.A : [];
    const logistiqueItems = Array.isArray(ordre.L) ? ordre.L : [];

    if (meta?.adresse) text += `Adresse: ${meta.adresse}\n`;
    if (meta?.heure) text += `Heure de saisie: ${meta.heure}\n`;
    if (meta?.adresse || meta?.heure) text += "\n";

    text += "S – SITUATION\n";
    text += `${ordre.S}\n\n`;

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
    if (ordre.O.length > 0) {
        ordre.O.forEach((obj, index) => {
            text += `${index + 1}. ${obj}\n`;
        });
    } else {
        text += "Aucun objectif spécifié.\n";
    }
    text += "\n";

    text += "I – IDÉES DE MANŒUVRE\n";
    if (ordre.I.length > 0) {
        ordre.I.forEach((im, index) => {
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
    text += `${ordre.E}\n\n`;

    text += "C – COMMANDEMENT\n";
    text += `${ordre.C}\n`;

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
    text += `S: ${ordre.S.substring(0, 100)}${ordre.S.length > 100 ? '...' : ''}\n\n`;

    if (Array.isArray(ordre.A) && ordre.A.length > 0) {
        text += "A:\n";
        ordre.A.forEach((item, i) => text += `${i + 1}. ${item}\n`);
        text += "\n";
    }

    text += "O:\n";
    ordre.O.forEach((obj, i) => text += `${i + 1}. ${obj}\n`);
    text += "\n";

    text += "I:\n";
    ordre.I.forEach((im, i) => text += `${i + 1}. ${im.mission} (${im.moyen})\n`);

    if (Array.isArray(ordre.L) && ordre.L.length > 0) {
        text += "\nL:\n";
        ordre.L.forEach((item, i) => text += `${i + 1}. ${item}\n`);
    }

    return text;
};
