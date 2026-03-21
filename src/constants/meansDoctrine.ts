import {
  MEANS_DOCTRINE_LABELS,
  MEANS_DOCTRINE_STANDARD
} from './meansDoctrine.data';

export { MEANS_DOCTRINE_LABELS, MEANS_DOCTRINE_STANDARD };

// Exports techniques utilises par l'application.
// Ne pas modifier ici pour changer la doctrine metier.
export const MEANS_DOCTRINE_CATEGORY_ORDER = Object.keys(MEANS_DOCTRINE_STANDARD);

export type MeansDoctrineCategoryKey = keyof typeof MEANS_DOCTRINE_STANDARD;
