export interface AnalyseTactique {
    source_flux_cibles?: string;
    priorite_retenue?: string;
    moyens_supposes?: string;
    [key: string]: unknown;
}

export interface IdeeManoeuvre {
    mission: string;
    moyen: string;
    moyen_supp?: string;
    details?: string;
}

export interface OrdreInitial {
    _analyse_tactique?: AnalyseTactique;
    S: string;
    A?: string[]; // Anticipation
    O: string[];
    I: IdeeManoeuvre[];
    E: string | string[] | unknown[]; // Peut contenir des données structurées (Mission/Moyen)
    L?: string[]; // Logistique
    C: string;
}
