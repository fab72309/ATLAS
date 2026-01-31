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
    color?: string;
    type?: 'idea' | 'separator' | 'empty';
    objective_id?: string;
    order_in_objective?: number;
}

export type OrdreSectionKey = 'S' | 'A' | 'O' | 'I' | 'E' | 'C' | 'L';
export type OrdreSectionColors = Partial<Record<OrdreSectionKey, Array<string | null>>>;

export type SimpleSectionItem =
    | string
    | { type: 'separator' }
    | { type: 'empty' }
    | { type?: 'text'; content: string; id?: string }
    | { type: 'objective'; id: string; content: string };

export type SimpleSection = string | SimpleSectionItem[];

export interface ExecutionItem {
    mission: string;
    moyen: string;
    moyen_supp?: string;
    details?: string;
    color?: string;
    type?: 'execution' | 'separator' | 'empty';
}

export interface OrdreInitial {
    _analyse_tactique?: AnalyseTactique;
    _colors?: OrdreSectionColors;
    S: SimpleSection;
    A?: SimpleSectionItem[]; // Anticipation
    O: SimpleSectionItem[];
    I: IdeeManoeuvre[];
    E: string | ExecutionItem[]; // Peut contenir des données structurées (Mission/Moyen)
    L?: SimpleSectionItem[]; // Logistique
    C: SimpleSection;
}
