import React from 'react';
import type { SITACCollection } from '../types/sitac';
import { logInterventionEvent } from '../utils/atlasTelemetry';
import { debounce } from '../utils/debounce';
import {
  buildSitacSnapshotMap,
  loadSitacCollection,
  syncSitacCollection,
  type SitacStateSnapshot
} from '../services/sitacService';

type UseSitacPersistenceOptions = {
  currentInterventionId: string | null;
  geoJSON: SITACCollection;
  sitacHydrationId: number;
  setFromHydration: (collection: SITACCollection) => void;
  interventionStartedAtMs: number | null;
};

export const useSitacPersistence = ({
  currentInterventionId,
  geoJSON,
  sitacHydrationId,
  setFromHydration,
  interventionStartedAtMs
}: UseSitacPersistenceOptions) => {
  const previousSitacSnapshotRef = React.useRef<Map<string, SitacStateSnapshot>>(new Map());
  const skipSitacSyncRef = React.useRef(sitacHydrationId);

  const buildSitacMetrics = React.useCallback(
    (uiContext: string, editCount = 1) => ({
      duration_ms: 0,
      edit_count: editCount,
      source: 'keyboard' as const,
      ui_context: uiContext,
      ...(interventionStartedAtMs
        ? { elapsed_ms_since_intervention_start: Date.now() - interventionStartedAtMs }
        : {})
    }),
    [interventionStartedAtMs]
  );

  const buildSitacEventPayload = React.useCallback(
    (snapshot: SitacStateSnapshot) => ({
      feature_id: snapshot.featureId,
      symbol_type: snapshot.symbolType,
      lat: snapshot.lat,
      lng: snapshot.lng,
      props: snapshot.props,
      action_meta: { source: 'sitac' }
    }),
    []
  );

  React.useEffect(() => {
    if (!currentInterventionId) return;
    let active = true;
    void loadSitacCollection(currentInterventionId)
      .then((collection) => {
        if (!active) return;
        setFromHydration(collection);
      })
      .catch((error) => {
        console.error('Chargement SITAC partagé échoué', error);
      });
    return () => {
      active = false;
    };
  }, [currentInterventionId, setFromHydration]);

  const sitacStateSync = React.useMemo(
    () =>
      debounce((collection: unknown) => {
        void (async () => {
          const safeCollection = collection as SITACCollection;
          if (!currentInterventionId) return;
          try {
            const diff = await syncSitacCollection({
              interventionId: currentInterventionId,
              collection: safeCollection,
              previousMap: previousSitacSnapshotRef.current
            });
            previousSitacSnapshotRef.current = diff.nextMap;
            const logPromises: Promise<unknown>[] = [];
            diff.added.forEach((snapshot) => {
              logPromises.push(
                logInterventionEvent(
                  currentInterventionId,
                  'SITAC_FEATURE_ADDED_VALIDATED',
                  buildSitacEventPayload(snapshot),
                  buildSitacMetrics('sitac.map', 1)
                ).catch((error) => {
                  console.error('SITAC add log failed', error);
                })
              );
            });
            diff.updated.forEach((snapshot) => {
              logPromises.push(
                logInterventionEvent(
                  currentInterventionId,
                  'SITAC_FEATURE_UPDATED_VALIDATED',
                  buildSitacEventPayload(snapshot),
                  buildSitacMetrics('sitac.map', 1)
                ).catch((error) => {
                  console.error('SITAC update log failed', error);
                })
              );
            });
            diff.removed.forEach((snapshot) => {
              logPromises.push(
                logInterventionEvent(
                  currentInterventionId,
                  'SITAC_FEATURE_DELETED_VALIDATED',
                  buildSitacEventPayload(snapshot),
                  buildSitacMetrics('sitac.map', 1)
                ).catch((error) => {
                  console.error('SITAC delete log failed', error);
                })
              );
            });
            if (logPromises.length) {
              await Promise.all(logPromises);
            }
          } catch (error) {
            console.error('SITAC state sync failed', error);
          }
        })();
      }, 600),
    [buildSitacEventPayload, buildSitacMetrics, currentInterventionId]
  );

  React.useEffect(() => {
    if (skipSitacSyncRef.current !== sitacHydrationId) {
      skipSitacSyncRef.current = sitacHydrationId;
      previousSitacSnapshotRef.current = buildSitacSnapshotMap(geoJSON);
      return;
    }
    sitacStateSync(geoJSON);
  }, [geoJSON, sitacHydrationId, sitacStateSync]);

  React.useEffect(() => {
    previousSitacSnapshotRef.current = new Map();
    skipSitacSyncRef.current = sitacHydrationId;
  }, [currentInterventionId, sitacHydrationId]);

  React.useEffect(() => {
    return () => {
      sitacStateSync.flush();
      sitacStateSync.cancel();
    };
  }, [sitacStateSync]);
};
