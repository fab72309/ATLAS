import { resetOctTree, hydrateOctTree } from './octTreeStore';
import { telemetryBuffer } from './telemetryBuffer';
import { useInterventionStore } from '../stores/useInterventionStore';
import { useSitacStore } from '../stores/useSitacStore';
import { useMeansStore } from '../stores/useMeansStore';

export const resetAllStores = () => {
  useInterventionStore.getState().reset();
  useSitacStore.getState().reset();
  useMeansStore.getState().reset();
  resetOctTree();
  telemetryBuffer.clearAll();
};

export const hydrateAllStores = (userId: string | null) => {
  if (!userId) return;
  useInterventionStore.getState().hydrate(userId);
  hydrateOctTree(userId);
};
