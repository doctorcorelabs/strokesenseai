// Pure timing and sway arithmetic for the Sit-to-Stand and Balance Lab.
//
// Everything in this file is descriptive: it turns recorded timestamps and
// sensor samples into durations, counts, and spread statistics. No function
// compares a person with a population value, and none returns a verdict
// about a body. Interpretation stays with the person and their clinician.

// ---------------------------------------------------------------------------
// Sit-to-stand: per-repetition timing
// ---------------------------------------------------------------------------

export interface SitToStandSummary {
  /** Duration of each completed repetition, in milliseconds. */
  repDurationsMs: number[];
  /** Time from the start signal to the last completed repetition. */
  totalMs: number;
  /** Mean repetition duration, or null when no repetition was completed. */
  averageMs: number | null;
  /** Shortest single repetition, or null when none was completed. */
  fastestMs: number | null;
  /** Longest single repetition, or null when none was completed. */
  slowestMs: number | null;
}

/**
 * Summarize a sit-to-stand run from the moment the timer started and the
 * timestamps at which each full stand was completed. Timestamps that do
 * not move forward are ignored rather than turned into negative or zero
 * durations, because a double tap is a recording artifact, not data.
 */
export function summarizeSitToStand(
  startMs: number,
  repEndMs: readonly number[],
): SitToStandSummary {
  const repDurationsMs: number[] = [];
  let previous = startMs;
  for (const end of repEndMs) {
    if (end > previous) {
      repDurationsMs.push(end - previous);
      previous = end;
    }
  }
  if (repDurationsMs.length === 0) {
    return { repDurationsMs, totalMs: 0, averageMs: null, fastestMs: null, slowestMs: null };
  }
  const totalMs = repDurationsMs.reduce((sum, value) => sum + value, 0);
  return {
    repDurationsMs,
    totalMs,
    averageMs: totalMs / repDurationsMs.length,
    fastestMs: Math.min(...repDurationsMs),
    slowestMs: Math.max(...repDurationsMs),
  };
}

/** Format a millisecond duration as seconds with one decimal, e.g. "12.4 s". */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0.0 s';
  return `${(ms / 1000).toFixed(1)} s`;
}

// ---------------------------------------------------------------------------
// Quiet standing: sway proxy statistics from two-axis samples
// ---------------------------------------------------------------------------

export interface SwaySample {
  /** Horizontal axis of the sway proxy (device tilt or hip midpoint x). */
  x: number;
  /** Vertical or depth axis of the sway proxy. */
  y: number;
  /** Sample timestamp in milliseconds. */
  tMs: number;
}

export interface SwaySummary {
  sampleCount: number;
  durationMs: number;
  /**
   * Total length of the path traced by the proxy point, in the same units
   * as the samples. A longer path means the point moved more, nothing else.
   */
  pathLength: number;
  /**
   * Root mean square distance of the samples from their own center. This
   * describes spread around the person's own average position.
   */
  rmsSpread: number;
  /** Path length divided by the recording duration, in units per second. */
  meanSpeed: number;
  /** Largest distance from the sample center reached during the recording. */
  maxExcursion: number;
}

/**
 * Summarize a quiet standing recording. The two axes are treated as a
 * position proxy (for example phone tilt while held against the body, or a
 * hip midpoint). A phone or camera proxy is not a center of pressure and
 * not a center of mass; the numbers describe the proxy signal only.
 * Samples with non-finite values are dropped before any arithmetic.
 */
export function summarizeSway(samples: readonly SwaySample[]): SwaySummary {
  const clean = samples.filter(
    (sample) => Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.tMs),
  );
  if (clean.length === 0) {
    return { sampleCount: 0, durationMs: 0, pathLength: 0, rmsSpread: 0, meanSpeed: 0, maxExcursion: 0 };
  }
  const sorted = [...clean].sort((a, b) => a.tMs - b.tMs);
  const centerX = sorted.reduce((sum, s) => sum + s.x, 0) / sorted.length;
  const centerY = sorted.reduce((sum, s) => sum + s.y, 0) / sorted.length;

  let pathLength = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const dx = sorted[i].x - sorted[i - 1].x;
    const dy = sorted[i].y - sorted[i - 1].y;
    pathLength += Math.hypot(dx, dy);
  }

  let squared = 0;
  let maxExcursion = 0;
  for (const sample of sorted) {
    const distance = Math.hypot(sample.x - centerX, sample.y - centerY);
    squared += distance * distance;
    if (distance > maxExcursion) maxExcursion = distance;
  }

  const durationMs = sorted[sorted.length - 1].tMs - sorted[0].tMs;
  return {
    sampleCount: sorted.length,
    durationMs,
    pathLength,
    rmsSpread: Math.sqrt(squared / sorted.length),
    meanSpeed: durationMs > 0 ? pathLength / (durationMs / 1000) : 0,
    maxExcursion,
  };
}

// ---------------------------------------------------------------------------
// Observer-marked events (manual sway mode)
// ---------------------------------------------------------------------------

export interface ObserverEventSummary {
  count: number;
  /** Seconds from the start of the recording to each marked event. */
  eventTimesSec: number[];
}

/**
 * Summarize events a person or companion marked by tapping during a manual
 * sway recording, for example each visible sway or step. These are observer
 * taps, not sensor measurements, and callers must label them that way.
 */
export function summarizeObserverEvents(
  startMs: number,
  eventMs: readonly number[],
): ObserverEventSummary {
  const times = eventMs
    .filter((value) => Number.isFinite(value) && value >= startMs)
    .map((value) => (value - startMs) / 1000)
    .sort((a, b) => a - b);
  return { count: times.length, eventTimesSec: times };
}
