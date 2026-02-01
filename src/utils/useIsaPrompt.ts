import React from 'react';
import { getSupabaseClient } from './supabaseClient';
import { enqueue, flush, startOutboxSync } from './offlineOutbox';

export type IsaValue = 1 | 2 | 3 | 4 | 5;
export type IsaSource = 'manual' | 'prompted';

type UseIsaPromptOptions = {
  interventionId: string | null;
  enabled?: boolean;
  intervalMs?: number;
  onPrompt?: () => void;
};

export const useIsaPrompt = ({
  interventionId,
  enabled = false,
  intervalMs = 120_000,
  onPrompt
}: UseIsaPromptOptions) => {
  const timerRef = React.useRef<number | null>(null);

  const submitIsa = React.useCallback(async (isa: IsaValue, source: IsaSource = 'manual') => {
    if (!interventionId) return;
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('Supabase client missing; ISA logging disabled.');
      return;
    }
    startOutboxSync(supabase);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) return;
      const ratingId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const row = {
        id: ratingId,
        intervention_id: interventionId,
        user_id: userId,
        recorded_at: new Date().toISOString(),
        isa,
        source
      };
      await enqueue('ml_isa_ratings', row);
      await flush(supabase);
    } catch (error) {
      console.warn('[isa] Failed to submit ISA rating', error);
    }
  }, [interventionId]);

  React.useEffect(() => {
    if (!enabled || !interventionId) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      if (onPrompt) onPrompt();
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, interventionId, intervalMs, onPrompt]);

  return {
    submitIsa,
    promptEnabled: Boolean(enabled && interventionId)
  };
};
