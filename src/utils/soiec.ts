import { OrdreInitial } from '../types/soiec';

export const parseOrdreInitial = (jsonString: string): OrdreInitial => {
    try {
        // Nettoyage basique si le JSON est entouré de balises markdown
        const cleanJson = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        // Structure par défaut pour éviter les crashs
        const defaultOrdre: OrdreInitial = {
            S: "Situation non renseignée",
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
            try { parsedE = JSON.parse(finalE); } catch (e) { }
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
                ? normalized.A.map((a: any) => typeof a === 'string' ? a : JSON.stringify(a))
                : (normalized.A ? [typeof normalized.A === 'string' ? normalized.A : JSON.stringify(normalized.A)] : []),
            // Assurer que O est un tableau de chaînes
            O: Array.isArray(normalized.O)
                ? normalized.O.map((o: any) => typeof o === 'string' ? o : JSON.stringify(o))
                : (normalized.O ? [typeof normalized.O === 'string' ? normalized.O : JSON.stringify(normalized.O)] : []),

            // I est maintenant une liste de chaînes (Idées de manœuvre générales)
            I: Array.isArray(finalI)
                ? finalI.map((i: any) => typeof i === 'string' ? i : (i.mission || JSON.stringify(i)))
                : (typeof finalI === 'string' ? [finalI] : []),

            // E contient maintenant potentiellement les données structurées (Missions/Moyens)
            // Mais le type OrdreInitial définit E comme string pour l'instant. 
            // Il faut mettre à jour le type OrdreInitial ou stringifier ici si on ne change pas le type.
            // Le user veut que les moyens apparaissent dans la case adéquate.
            // On va modifier le type OrdreInitial pour que E puisse être IdeeManoeuvre[] aussi.
            E: finalE,

            // Assurer que L est un tableau de chaînes
            L: Array.isArray(normalized.L)
                ? normalized.L.map((l: any) => typeof l === 'string' ? l : JSON.stringify(l))
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
            C: ""
        };
    }
};

export const generateOrdreInitialText = (
    ordre: OrdreInitial,
    meta?: { adresse?: string; heure?: string }
): string => {
    let text = "ORDRE INITIAL – Chef de groupe\n\n";

    if (meta?.adresse) text += `Adresse: ${meta.adresse}\n`;
    if (meta?.heure) text += `Heure de saisie: ${meta.heure}\n`;
    if (meta?.adresse || meta?.heure) text += "\n";

    text += "S – SITUATION\n";
    text += `${ordre.S}\n\n`;

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

    return text;
};

export const generateOrdreInitialShortText = (ordre: OrdreInitial): string => {
    // Version condensée pour SMS
    let text = "ORDRE INITIAL\n\n";
    text += `S: ${ordre.S.substring(0, 100)}${ordre.S.length > 100 ? '...' : ''}\n\n`;

    text += "O:\n";
    ordre.O.forEach((obj, i) => text += `${i + 1}. ${obj}\n`);
    text += "\n";

    text += "I:\n";
    ordre.I.forEach((im, i) => text += `${i + 1}. ${im.mission} (${im.moyen})\n`);

    return text;
};
