// Single source of truth for size, time, and quota limits.
// Used by the frontend, the Worker, and the documentation. Values come from
// PLANNING.md sections 7.2 and 7.3. Never put secrets here.
export const LIMITS = {
  bodyBytes: 32768,
  toolTextChars: 1000,
  chatMessageChars: 2000,
  chatReplyChars: 6000,
  visionImageBytes: 2097152,
  visionMetricsBytes: 8192,
  audioBytes: 1572864,
  audioSeconds: 30,
  upstreamTimeoutMs: 12000,
} as const;

// Per-feature rate limits, enforced by the Worker Durable Object buckets.
// Vision is the most expensive feature, so it is the tightest.
export const RATE_LIMITS: Record<string, { perMinute: number; perHour?: number }> = {
  chat: { perMinute: 15, perHour: 60 },
  vision: { perMinute: 6, perHour: 20 },
  audio: { perMinute: 10 },
  tools: { perMinute: 20 },
};
