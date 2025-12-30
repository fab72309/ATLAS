import { logTelemetryBatch, type TelemetryBatchSample, type TelemetryStream } from './atlasTelemetry';

type TelemetryBufferOptions = {
  maxSamples?: number;
  maxAgeMs?: number;
};

type AddSampleInput = {
  interventionId: string | null;
  stream: TelemetryStream;
  patch: Record<string, unknown>;
  interventionStartedAtMs?: number | null;
  uiContext?: string;
  options?: TelemetryBufferOptions;
};

type FlushTarget = {
  interventionId: string;
  stream: TelemetryStream;
};

type BufferState = {
  interventionId: string;
  stream: TelemetryStream;
  samples: TelemetryBatchSample[];
  firstSampleAtMs: number | null;
  lastSampleAtMs: number | null;
  timerId: ReturnType<typeof setTimeout> | null;
  isFlushing: boolean;
  uiContext: string;
  options: Required<TelemetryBufferOptions>;
};

const DEFAULT_OPTIONS: Required<TelemetryBufferOptions> = {
  maxSamples: 25,
  maxAgeMs: 20000
};

const sessionStartMs = Date.now();
const buffers = new Map<string, BufferState>();
let lifecycleCleanup: (() => void) | null = null;

const buildKey = (interventionId: string, stream: TelemetryStream) => `${interventionId}:${stream}`;

const resolveOptions = (options?: TelemetryBufferOptions): Required<TelemetryBufferOptions> => ({
  maxSamples:
    typeof options?.maxSamples === 'number' && Number.isFinite(options.maxSamples) && options.maxSamples > 0
      ? options.maxSamples
      : DEFAULT_OPTIONS.maxSamples,
  maxAgeMs:
    typeof options?.maxAgeMs === 'number' && Number.isFinite(options.maxAgeMs) && options.maxAgeMs > 0
      ? options.maxAgeMs
      : DEFAULT_OPTIONS.maxAgeMs
});

const getBuffer = (
  interventionId: string,
  stream: TelemetryStream,
  uiContext?: string,
  options?: TelemetryBufferOptions
): BufferState => {
  const key = buildKey(interventionId, stream);
  const existing = buffers.get(key);
  if (existing) {
    if (uiContext) existing.uiContext = uiContext;
    if (options) existing.options = resolveOptions(options);
    return existing;
  }
  const buffer: BufferState = {
    interventionId,
    stream,
    samples: [],
    firstSampleAtMs: null,
    lastSampleAtMs: null,
    timerId: null,
    isFlushing: false,
    uiContext: uiContext ?? 'unknown',
    options: resolveOptions(options)
  };
  buffers.set(key, buffer);
  return buffer;
};

const scheduleFlush = (buffer: BufferState) => {
  if (buffer.timerId || buffer.options.maxAgeMs <= 0) return;
  buffer.timerId = setTimeout(() => {
    buffer.timerId = null;
    flushBuffer(buffer);
  }, buffer.options.maxAgeMs);
};

const clearBuffer = (buffer: BufferState) => {
  if (buffer.timerId) {
    clearTimeout(buffer.timerId);
  }
  buffer.samples = [];
  buffer.firstSampleAtMs = null;
  buffer.lastSampleAtMs = null;
  buffer.timerId = null;
  buffer.isFlushing = false;
};

const flushBuffer = (buffer: BufferState) => {
  if (buffer.isFlushing || buffer.samples.length === 0) return;
  if (buffer.timerId) {
    clearTimeout(buffer.timerId);
    buffer.timerId = null;
  }

  const samples = buffer.samples;
  const startedAtMs = buffer.firstSampleAtMs ?? Date.now();
  const endedAtMs = buffer.lastSampleAtMs ?? startedAtMs;

  buffer.samples = [];
  buffer.firstSampleAtMs = null;
  buffer.lastSampleAtMs = null;
  buffer.isFlushing = true;

  void logTelemetryBatch(
    buffer.interventionId,
    buffer.stream,
    { samples },
    { startedAt: startedAtMs, endedAt: endedAtMs },
    { sample_count: samples.length, ui_context: buffer.uiContext }
  )
    .catch((error) => {
      console.error(`[telemetry] Failed to flush ${buffer.stream} batch`, error);
      const existingFirst = buffer.firstSampleAtMs;
      const existingLast = buffer.lastSampleAtMs;
      buffer.samples = [...samples, ...buffer.samples];
      buffer.firstSampleAtMs =
        existingFirst !== null ? Math.min(existingFirst, startedAtMs) : startedAtMs;
      buffer.lastSampleAtMs =
        existingLast !== null ? Math.max(existingLast, endedAtMs) : endedAtMs;
    })
    .finally(() => {
      buffer.isFlushing = false;
      if (buffer.samples.length === 0) return;
      scheduleFlush(buffer);
      if (buffer.samples.length >= buffer.options.maxSamples) {
        flushBuffer(buffer);
      }
    });
};

const computeOffsetMs = (interventionStartedAtMs?: number | null) => {
  const anchor =
    typeof interventionStartedAtMs === 'number' && Number.isFinite(interventionStartedAtMs)
      ? interventionStartedAtMs
      : sessionStartMs;
  return Math.max(0, Date.now() - anchor);
};

export const telemetryBuffer = {
  addSample: ({ interventionId, stream, patch, interventionStartedAtMs, uiContext, options }: AddSampleInput) => {
    if (!interventionId) {
      console.warn(`[telemetry] Missing interventionId for ${stream} sample`);
      return;
    }
    const buffer = getBuffer(interventionId, stream, uiContext, options);
    const now = Date.now();
    const sample: TelemetryBatchSample = {
      t_ms: computeOffsetMs(interventionStartedAtMs),
      patch
    };
    buffer.samples.push(sample);
    if (!buffer.firstSampleAtMs) buffer.firstSampleAtMs = now;
    buffer.lastSampleAtMs = now;
    if (!buffer.isFlushing && buffer.samples.length >= buffer.options.maxSamples) {
      flushBuffer(buffer);
      return;
    }
    scheduleFlush(buffer);
  },
  flush: ({ interventionId, stream }: FlushTarget) => {
    const key = buildKey(interventionId, stream);
    const buffer = buffers.get(key);
    if (!buffer) return;
    flushBuffer(buffer);
  },
  flushAll: () => {
    Array.from(buffers.values()).forEach((buffer) => flushBuffer(buffer));
  },
  clearAll: () => {
    Array.from(buffers.values()).forEach((buffer) => clearBuffer(buffer));
    buffers.clear();
  },
  bindLifecycleHandlers: () => {
    if (typeof window === 'undefined') return () => undefined;
    if (lifecycleCleanup) return lifecycleCleanup;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        telemetryBuffer.flushAll();
      }
    };
    const handleBeforeUnload = () => telemetryBuffer.flushAll();
    const handlePageHide = () => telemetryBuffer.flushAll();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    lifecycleCleanup = () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      lifecycleCleanup = null;
    };
    return lifecycleCleanup;
  }
};
