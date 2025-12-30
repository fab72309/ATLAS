# State/Storage Audit

Note: All storage keys are now user-scoped using `atlas:v1:<userId>:<baseKey>` and are cleared on user changes.

## Zustand stores
- `src/stores/useInterventionStore.ts` (Zustand, manual localStorage persistence)
  - Key: `atlas-intervention-meta`
  - Data: intervention meta (address/city/role/lat/lng) + current intervention id + t0
- `src/stores/useSitacStore.ts` (Zustand, in-memory only)
  - No persistence; holds SITAC state in memory

## Non-Zustand in-memory stores
- `src/utils/octTreeStore.ts` (custom external store)
  - Key: `atlas-oct-tree` (localStorage)
  - Data: OCT tree
- `src/utils/telemetryBuffer.ts` (in-memory queue)
  - No persistence; buffered telemetry samples

## Local/session storage usage (manual)
- `src/contexts/ThemeContext.tsx`
  - localStorage key: `atlas-theme` (theme preference)
- `src/utils/sessionSettings.ts`
  - sessionStorage key: `atlas-session-settings` (session settings)
- `src/pages/DictationInput.tsx`
  - localStorage key: `atlas-ordre-initial-draft` (draft)
- `src/pages/CommandTypeChoice.tsx`
  - localStorage key: `atlas-ordre-initial-draft` (draft)
- `src/utils/dataStore.ts`
  - localStorage keys: `atlas-dictation-saves`, `atlas-communication-saves`,
    `atlas-communication-ia-saves`, `atlas-intervention-shares`
- `src/utils/history.ts`
  - localStorage key: `emergency-history`
- `src/utils/favorites.ts`
  - localStorage key: `atlas-favorites`
- `src/utils/dominantes.ts`
  - localStorage key: `atlas-dominantes-order`
- `src/components/MeansModal.tsx`
  - localStorage key: `atlas-oct-sector-validation`
