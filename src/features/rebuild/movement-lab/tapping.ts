// Pure tap detection for Hand Lab, shared by the live mode and tests.
//
// The signal is the distance between the thumb tip (landmark 4) and the
// index fingertip (landmark 8), normalized by the size of the hand in
// the same frame (wrist, landmark 0, to middle finger base, landmark
// 9), so the count does not depend on how far the hand is from the
// camera. A tap is counted with hysteresis: the distance must fall to
// the close threshold to register a tap, then rise back past a higher
// open threshold before the next tap can register. One touch can
// therefore never be counted twice, and a half-open hand hovering
// between the thresholds changes nothing.

/** Minimal structural point, compatible with MediaPipe landmarks. */
export interface HandPoint {
  x: number;
  y: number;
}

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_BASE = 9;

/** Distance at or below this (in hand-size units) counts as a touch. */
export const TAP_CLOSE_THRESHOLD = 0.4;
/** Distance at or above this means the fingers are open again. */
export const TAP_OPEN_THRESHOLD = 0.65;
/** Human taps cannot repeat faster than this without being one touch. */
export const TAP_MIN_INTERVAL_MS = 120;

function distance(a: HandPoint, b: HandPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Thumb tip to index tip distance divided by the wrist to middle base
 * distance of the same frame. Returns null when the points are missing
 * or the hand scale is degenerate (a zero-size hand cannot be
 * measured, and the caller must hear about it instead of a made-up
 * number).
 */
export function normalizedPinchDistance(landmarks: readonly HandPoint[]): number | null {
  const wrist = landmarks[WRIST];
  const thumb = landmarks[THUMB_TIP];
  const index = landmarks[INDEX_TIP];
  const base = landmarks[MIDDLE_BASE];
  if (!wrist || !thumb || !index || !base) return null;
  const scale = distance(wrist, base);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const pinch = distance(thumb, index);
  if (!Number.isFinite(pinch)) return null;
  return pinch / scale;
}

/** One distance reading with its time, as sampled during a test. */
export interface TapSample {
  timeMs: number;
  /** Normalized pinch distance, or null when the hand was not seen. */
  distance: number | null;
}

export interface TapDetection {
  count: number;
  /** Time of each counted tap, in the same clock as the samples. */
  tapTimesMs: number[];
  /** Gaps between consecutive taps, in milliseconds. */
  intervalsMs: number[];
}

export interface DetectTapsOptions {
  closeThreshold?: number;
  openThreshold?: number;
  minIntervalMs?: number;
}

/**
 * Count taps in a sampled distance series. Null samples are skipped:
 * losing sight of the hand neither counts a tap nor resets the state,
 * so a brief occlusion cannot split one touch into two counts.
 */
export function detectTaps(
  samples: readonly TapSample[],
  options: DetectTapsOptions = {},
): TapDetection {
  const closeThreshold = options.closeThreshold ?? TAP_CLOSE_THRESHOLD;
  const openThreshold = options.openThreshold ?? TAP_OPEN_THRESHOLD;
  const minIntervalMs = options.minIntervalMs ?? TAP_MIN_INTERVAL_MS;

  const tapTimesMs: number[] = [];
  let closed = false;
  let lastTapMs = Number.NEGATIVE_INFINITY;

  for (const sample of samples) {
    if (sample.distance === null || !Number.isFinite(sample.distance)) continue;
    if (!closed && sample.distance <= closeThreshold) {
      if (sample.timeMs - lastTapMs >= minIntervalMs) {
        tapTimesMs.push(sample.timeMs);
        lastTapMs = sample.timeMs;
      }
      // Mark closed either way: a dip that arrives too soon after the
      // last tap is the tail of that same touch, not a new one.
      closed = true;
    } else if (closed && sample.distance >= openThreshold) {
      closed = false;
    }
  }

  const intervalsMs: number[] = [];
  for (let i = 1; i < tapTimesMs.length; i += 1) {
    intervalsMs.push(tapTimesMs[i] - tapTimesMs[i - 1]);
  }
  return { count: tapTimesMs.length, tapTimesMs, intervalsMs };
}
