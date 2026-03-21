import React from 'react';
import { readUserScopedJSON, removeUserScopedItem, writeUserScopedJSON } from '../utils/userStorage';

type UseDictationDraftOptions<T> = {
  storageKey: string;
  parseDraft: (value: unknown) => T | null;
  applyDraft: (value: T) => void;
  payload: T;
};

export const useDictationDraft = <T,>({
  storageKey,
  parseDraft,
  applyDraft,
  payload
}: UseDictationDraftOptions<T>) => {
  React.useEffect(() => {
    try {
      const parsed = readUserScopedJSON<unknown>(storageKey, 'local');
      const draft = parseDraft(parsed);
      if (draft) {
        applyDraft(draft);
      }
    } catch (error) {
      console.error('Erreur lecture brouillon', error);
    }
  }, [applyDraft, parseDraft, storageKey]);

  React.useEffect(() => {
    try {
      writeUserScopedJSON(storageKey, payload, 'local');
    } catch (error) {
      console.error('Erreur sauvegarde brouillon', error);
    }
  }, [payload, storageKey]);

  const clearDraft = React.useCallback(() => {
    removeUserScopedItem(storageKey, 'local');
  }, [storageKey]);

  return {
    clearDraft
  };
};
