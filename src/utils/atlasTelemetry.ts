import { supabase } from './supabaseClient';

export type TelemetrySource = 'keyboard' | 'stt' | 'dictation' | 'template';

export type TelemetryStream = 'OCT' | 'SITAC' | 'MEANS';

export type TelemetryMetrics = {
  duration_ms: number;
  edit_count: number;
  source: TelemetrySource;
  ui_context: string;
  elapsed_ms_since_intervention_start?: number;
};

export type TelemetryBatchSample = {
  t_ms: number;
  patch: Record<string, unknown>;
};

export type TelemetryBatchMetrics = {
  sample_count: number;
  ui_context: string;
  [key: string]: unknown;
};

export type TelemetryBatchPayload = {
  schema_version: 1;
  data: {
    stream: TelemetryStream;
    samples: TelemetryBatchSample[];
  };
  metrics: TelemetryBatchMetrics;
  context?: Record<string, unknown>;
};

export type TelemetryPayload<TData = Record<string, unknown>> = {
  schema_version: 1;
  data: TData;
  metrics: TelemetryMetrics;
  context?: Record<string, unknown>;
};

type LogInterventionOptions = {
  validated?: boolean;
  logical_id?: string;
};

type TelemetryBatchTimes = {
  startedAt?: string | number | Date;
  endedAt?: string | number | Date;
};

const DEFAULT_METRICS: TelemetryMetrics = {
  duration_ms: 0,
  edit_count: 0,
  source: 'keyboard',
  ui_context: 'unknown'
};

const normalizeMetrics = (metrics?: Partial<TelemetryMetrics>): TelemetryMetrics => {
  const normalized: TelemetryMetrics = {
    duration_ms:
      typeof metrics?.duration_ms === 'number' && Number.isFinite(metrics.duration_ms)
        ? metrics.duration_ms
        : DEFAULT_METRICS.duration_ms,
    edit_count:
      typeof metrics?.edit_count === 'number' && Number.isFinite(metrics.edit_count)
        ? metrics.edit_count
        : DEFAULT_METRICS.edit_count,
    source: metrics?.source ?? DEFAULT_METRICS.source,
    ui_context: metrics?.ui_context ?? DEFAULT_METRICS.ui_context
  };
  if (typeof metrics?.elapsed_ms_since_intervention_start === 'number') {
    normalized.elapsed_ms_since_intervention_start = metrics.elapsed_ms_since_intervention_start;
  }
  return normalized;
};

const buildPayload = <TData>(
  data: TData,
  metrics?: Partial<TelemetryMetrics>,
  context?: Record<string, unknown>
): TelemetryPayload<TData> => {
  const payload: TelemetryPayload<TData> = {
    schema_version: 1,
    data,
    metrics: normalizeMetrics(metrics)
  };
  if (context && Object.keys(context).length > 0) {
    payload.context = context;
  }
  return payload;
};

const requireUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) {
    throw new Error('Not authenticated');
  }
  return data.user.id;
};

const normalizeBatchTime = (value?: string | number | Date): string | null => {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const logUserEvent = async <TData>(
  event_type: string,
  data: TData,
  metrics?: Partial<TelemetryMetrics>,
  context?: Record<string, unknown>
) => {
  const userId = await requireUserId();
  const payload = buildPayload(data, metrics, context);
  const { error } = await supabase.from('user_events').insert({
    user_id: userId,
    event_type,
    payload,
    client_recorded_at: new Date().toISOString()
  });
  if (error) throw error;
};

export const logInterventionEvent = async <TData>(
  intervention_id: string,
  event_type: string,
  data: TData,
  metrics?: Partial<TelemetryMetrics>,
  context?: Record<string, unknown>,
  options?: LogInterventionOptions
) => {
  if (!intervention_id) {
    throw new Error('Missing intervention_id for telemetry event');
  }
  const isValidated = options?.validated ?? true;
  if (!isValidated) {
    throw new Error('intervention_events requires is_validated = true (append-only)');
  }
  const userId = await requireUserId();
  const payload = buildPayload(data, metrics, context);
  const insertPayload: Record<string, unknown> = {
    intervention_id,
    user_id: userId,
    event_type,
    payload,
    client_recorded_at: new Date().toISOString(),
    is_validated: true
  };
  if (options?.logical_id) {
    insertPayload.logical_id = options.logical_id;
  }

  const { error } = await supabase.from('intervention_events').insert(insertPayload);
  if (error) throw error;
};

export const logTelemetryBatch = async (
  intervention_id: string,
  stream: TelemetryStream,
  batchPayload: { samples: TelemetryBatchSample[] },
  batchTimes?: TelemetryBatchTimes,
  metrics?: Partial<TelemetryBatchMetrics>,
  context?: Record<string, unknown>
) => {
  if (!intervention_id) {
    throw new Error('Missing intervention_id for telemetry batch');
  }
  const userId = await requireUserId();
  const { sample_count, ui_context, ...rest } = metrics ?? {};
  const normalizedMetrics: TelemetryBatchMetrics = {
    sample_count:
      typeof sample_count === 'number' && Number.isFinite(sample_count)
        ? sample_count
        : batchPayload.samples.length,
    ui_context: ui_context ?? 'unknown',
    ...rest
  };
  const payload: TelemetryBatchPayload = {
    schema_version: 1,
    data: {
      stream,
      samples: batchPayload.samples
    },
    metrics: normalizedMetrics
  };
  if (context && Object.keys(context).length > 0) {
    payload.context = context;
  }
  const insertPayload: Record<string, unknown> = {
    intervention_id,
    user_id: userId,
    stream,
    payload
  };
  const startedAt = normalizeBatchTime(batchTimes?.startedAt);
  const endedAt = normalizeBatchTime(batchTimes?.endedAt);
  if (startedAt) insertPayload.client_batch_started_at = startedAt;
  if (endedAt) insertPayload.client_batch_ended_at = endedAt;
  const { error } = await supabase.from('intervention_telemetry').insert(insertPayload);
  if (error) throw error;
};
