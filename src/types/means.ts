export type MeanStatus = 'sur_place' | 'demande';

export interface MeanItem {
  id: string;
  name: string;
  status: MeanStatus;
  category?: string;
}
