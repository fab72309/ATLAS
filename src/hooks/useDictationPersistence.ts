import React from 'react';
import type { MeanItem } from '../types/means';
import type { OctTreeNode } from '../utils/octTreeStore';
import { closeIntervention as closeInterventionRecord, fetchInterventionStatus, upsertMeansState } from '../services/interventionsService';
import { getAuthenticatedUserId, requireSupabaseClient } from '../services/supabase';
import { debounce, type DebouncedFunction } from '../utils/debounce';
import { enqueue, flush, startOutboxSync } from '../utils/offlineOutbox';
import { logInterventionEvent, type TelemetryMetrics } from '../utils/atlasTelemetry';

type DraftSnapshotStateRef = React.MutableRefObject<{
  lastSentAt: number;
  lastSentHash: string;
  failureCount: number;
}>;

type UseDictationPersistenceOptions = {
  currentInterventionId: string | null;
  interventionStatus: string | null;
  normalizeMeans: (value: unknown) => MeanItem[];
  buildInterventionMetrics: (uiContext: string, overrides?: Partial<TelemetryMetrics>) => TelemetryMetrics;
  onStatusChange?: (status: string | null) => void;
};

type UseDictationPersistenceResult = {
  closeError: string | null;
  closeStatus: 'idle' | 'loading';
  isInterventionClosed: boolean;
  closeIntervention: (payload: { orderTime?: string | null }) => Promise<boolean>;
  persistMeansState: DebouncedFunction<(means: unknown, tree: unknown) => void>;
  sendDraftSnapshot: (
    snapshot: Record<string, unknown>,
    snapshotHash: string,
    stateRef: DraftSnapshotStateRef
  ) => Promise<void>;
  clearCloseError: () => void;
};

export const useDictationPersistence = ({
  currentInterventionId,
  interventionStatus,
  normalizeMeans,
  buildInterventionMetrics,
  onStatusChange
}: UseDictationPersistenceOptions): UseDictationPersistenceResult => {
  const [isInterventionClosed, setIsInterventionClosed] = React.useState(false);
  const [closeStatus, setCloseStatus] = React.useState<'idle' | 'loading'>('idle');
  const [closeError, setCloseError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isActive = true;
    setIsInterventionClosed(false);
    if (!currentInterventionId) {
      return () => {
        isActive = false;
      };
    }
    void fetchInterventionStatus(currentInterventionId)
      .then((status) => {
        if (!isActive) return;
        const nextStatus = typeof status === 'string' ? status : null;
        setIsInterventionClosed(nextStatus === 'closed');
        onStatusChange?.(nextStatus);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Erreur lecture statut intervention', error);
      });
    return () => {
      isActive = false;
    };
  }, [currentInterventionId, onStatusChange]);

  const sendDraftSnapshot = React.useCallback(async (
    snapshot: Record<string, unknown>,
    snapshotHash: string,
    stateRef: DraftSnapshotStateRef
  ) => {
    const state = stateRef.current;
    if (!currentInterventionId || interventionStatus !== 'open') return;
    if (state.failureCount >= 3) return;
    try {
      const supabase = requireSupabaseClient();
      startOutboxSync(supabase);
      const userId = await getAuthenticatedUserId();
      const snapshotId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await enqueue('intervention_draft_snapshots', {
        id: snapshotId,
        intervention_id: currentInterventionId,
        user_id: userId,
        recorded_at: new Date().toISOString(),
        draft: snapshot,
        source: 'oi_draft'
      });
      await flush(supabase);
      state.lastSentAt = Date.now();
      state.lastSentHash = snapshotHash;
      state.failureCount = 0;
    } catch (error) {
      state.failureCount += 1;
      console.warn('[draft] Failed to upload snapshot', error);
    }
  }, [currentInterventionId, interventionStatus]);

  const persistMeansState = React.useMemo(
    () =>
      debounce((means: unknown, tree: unknown) => {
        void (async () => {
          if (!currentInterventionId) return;
          const normalizedMeans = Array.isArray(means) ? normalizeMeans(means) : [];
          const normalizedTree = tree && typeof tree === 'object' ? tree as OctTreeNode : null;
          const payload = { selectedMeans: normalizedMeans, octTree: normalizedTree };
          try {
            await upsertMeansState(currentInterventionId, payload);
            await logInterventionEvent(
              currentInterventionId,
              'MEANS_STATE_VALIDATED',
              payload,
              buildInterventionMetrics('dictation.moyens', { edit_count: normalizedMeans.length })
            );
          } catch (error) {
            console.error('Erreur sauvegarde moyens', error);
          }
        })();
      }, 2500),
    [buildInterventionMetrics, currentInterventionId, normalizeMeans]
  );

  const closeIntervention = React.useCallback(async ({ orderTime }: { orderTime?: string | null }) => {
    if (!currentInterventionId) {
      setCloseError('Aucune intervention en cours.');
      return false;
    }
    setCloseStatus('loading');
    setCloseError(null);
    try {
      await closeInterventionRecord(currentInterventionId);
      await logInterventionEvent(
        currentInterventionId,
        'INTERVENTION_CLOSED',
        {
          order_time: orderTime || '',
          closed_at: new Date().toISOString()
        },
        buildInterventionMetrics('dictation.intervention.close')
      );
      setIsInterventionClosed(true);
      onStatusChange?.('closed');
      return true;
    } catch (error) {
      console.error('Erreur clôture intervention', error);
      setCloseError(error instanceof Error ? error.message : 'Impossible de clôturer l’intervention.');
      return false;
    } finally {
      setCloseStatus('idle');
    }
  }, [buildInterventionMetrics, currentInterventionId, onStatusChange]);

  const clearCloseError = React.useCallback(() => {
    setCloseError(null);
  }, []);

  return {
    closeError,
    closeStatus,
    isInterventionClosed,
    closeIntervention,
    persistMeansState,
    sendDraftSnapshot,
    clearCloseError
  };
};
