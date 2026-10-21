// Pure measurement logic for the Finger Tapping and Hand Dexterity Test.
//
// Two layers live here. The first detects taps in a thumb to index distance
// signal with a double threshold (hysteresis): a tap counts only when the
// signal falls below the low threshold after having risen above the high
// threshold, so jitter near one threshold can never count twice. The second
// layer summarises a list of tap timestamps into speed, rhythm, and
// slowing metrics. Every output describes one practice recording. There is
// deliberately no comparison against any population table.

import { gaussian, mulberry32 } from './synthetic';

export type TappingHand = 'left' | 'right';

export interface DistanceSample {
  tMs: number;
  /** Thumb tip to index tip distance, scaled so 1 roughly equals hand size. */
  distance: number;
}

export interface TapDetectionOptions {
  /** Signal must rise above this value before a tap can be armed. */
  highThreshold?: number;
  /** Signal must fall below this value while armed to count as a tap. */
  lowThreshold?: number;
}

/** Detect tap timestamps in a distance signal using hysteresis. */
export function detectTaps(samples: DistanceSample[], options: TapDetectionOptions = {}): number[] {
  const high = options.highThreshold ?? 0.55;
  const low = options.lowThreshold ?? 0.35;
  const taps: number[] = [];
  let armed = false;
  for (const sample of samples) {
    if (!armed && sample.distance >= high) {
      armed = true;
    } else if (armed && sample.distance <= low) {
      taps.push(sample.tMs);
      armed = false;
    }
  }
  return taps;
}

export interface TappingMetrics {
  tapCount: number;
  /** Taps per second across the whole recording window. */
  frequencyHz: number;
  meanIntervalMs: number;
  medianIntervalMs: number;
  /** Coefficient of variation of the intervals: spread divided by mean. */
  intervalCv: number;
  /** Taps per second in the first half of the window. */
  firstHalfHz: number;
  /** Taps per second in the second half of the window. */
  secondHalfHz: number;
  /**
   * Change from first half to second half rate, in percent of the first
   * half rate. Negative means the second half was slower.
   */
  fatigueChangePct: number;
  /** Intervals much longer than the typical interval, counted as pauses. */
  hesitationPauses: number;
  longestPauseMs: number;
  /** All intervals between consecutive taps, in order, for user audit. */
  intervalsMs: number[];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Summarise tap timestamps recorded inside a window of durationMs. */
export function computeTappingMetrics(tapTimesMs: number[], durationMs: number): TappingMetrics {
  const sorted = [...tapTimesMs].sort((a, b) => a - b);
  const tapCount = sorted.length;
  const intervalsMs: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    intervalsMs.push(sorted[i] - sorted[i - 1]);
  }
  const meanIntervalMs = mean(intervalsMs);
  const medianIntervalMs = median(intervalsMs);
  const variance =
    intervalsMs.length === 0
      ? 0
      : mean(intervalsMs.map((interval) => (interval - meanIntervalMs) ** 2));
  const intervalCv = meanIntervalMs > 0 ? Math.sqrt(variance) / meanIntervalMs : 0;

  const halfMs = durationMs / 2;
  const firstHalfCount = sorted.filter((t) => t < halfMs).length;
  const secondHalfCount = tapCount - firstHalfCount;
  const firstHalfHz = halfMs > 0 ? firstHalfCount / (halfMs / 1000) : 0;
  const secondHalfHz = halfMs > 0 ? secondHalfCount / (halfMs / 1000) : 0;
  const fatigueChangePct =
    firstHalfHz > 0 ? ((secondHalfHz - firstHalfHz) / firstHalfHz) * 100 : 0;

  const hesitationThreshold = Math.max(600, medianIntervalMs * 1.8);
  const hesitationPauses = intervalsMs.filter((interval) => interval > hesitationThreshold).length;
  const longestPauseMs = intervalsMs.length > 0 ? Math.max(...intervalsMs) : 0;

  return {
    tapCount,
    frequencyHz: durationMs > 0 ? tapCount / (durationMs / 1000) : 0,
    meanIntervalMs,
    medianIntervalMs,
    intervalCv,
    firstHalfHz,
    secondHalfHz,
    fatigueChangePct,
    hesitationPauses,
    longestPauseMs,
    intervalsMs,
  };
}

export interface TappingComparison {
  left: TappingMetrics;
  right: TappingMetrics;
  /** Signed difference of rates as a percent of the two side mean rate. */
  frequencyAsymmetryPct: number;
  /** Which hand tapped faster in these two recordings, or 'similar'. */
  fasterHand: TappingHand | 'similar';
  tapCountDifference: number;
}

/** Compare two hand recordings descriptively, never against a norm table. */
export function compareTapping(left: TappingMetrics, right: TappingMetrics): TappingComparison {
  const meanHz = (left.frequencyHz + right.frequencyHz) / 2;
  const frequencyAsymmetryPct =
    meanHz > 0 ? ((left.frequencyHz - right.frequencyHz) / meanHz) * 100 : 0;
  const fasterHand: TappingHand | 'similar' =
    Math.abs(frequencyAsymmetryPct) < 5
      ? 'similar'
      : left.frequencyHz > right.frequencyHz
        ? 'left'
        : 'right';
  return {
    left,
    right,
    frequencyAsymmetryPct,
    fasterHand,
    tapCountDifference: Math.abs(left.tapCount - right.tapCount),
  };
}

export interface SyntheticTapOptions {
  durationMs: number;
  /** Tapping rate at the start of the window, taps per second. */
  startHz: number;
  /** Tapping rate at the end of the window, taps per second. */
  endHz: number;
  /** Interval jitter as a coefficient of variation, for example 0.08. */
  jitterCv?: number;
  /** Extra long pauses to insert at spread positions. */
  hesitationCount?: number;
  seed?: number;
}

/**
 * Generate synthetic tap timestamps whose instantaneous rate glides from
 * startHz to endHz, with jitter and optional hesitation pauses.
 */
export function syntheticTapTimes(options: SyntheticTapOptions): number[] {
  const { durationMs, startHz, endHz } = options;
  const jitterCv = options.jitterCv ?? 0.08;
  const rng = mulberry32(options.seed ?? 11);
  const noise = gaussian(rng);
  const times: number[] = [];
  let t = 250;
  while (t < durationMs - 120) {
    times.push(t);
    const progress = t / durationMs;
    const rate = startHz + (endHz - startHz) * progress;
    const baseInterval = 1000 / Math.max(0.2, rate);
    const jittered = baseInterval * (1 + noise() * jitterCv);
    t += Math.max(60, jittered);
  }
  const hesitations = options.hesitationCount ?? 0;
  if (hesitations > 0 && times.length > hesitations + 2) {
    // Shift later taps forward at spread positions to create long pauses.
    for (let h = 0; h < hesitations; h += 1) {
      const at = Math.floor(((h + 1) * times.length) / (hesitations + 1));
      for (let i = at; i < times.length; i += 1) {
        times[i] += 500;
      }
    }
    return times.filter((value) => value < durationMs - 60);
  }
  return times;
}

/**
 * Build a synthetic thumb to index distance signal that contains the given
 * taps: the distance rests near 0.8 and dips toward 0.15 around each tap.
 * Used to test detection end to end and to power replay displays.
 */
export function syntheticDistanceSignal(
  tapTimesMs: number[],
  durationMs: number,
  sampleRateHz = 60,
  seed = 5,
): DistanceSample[] {
  const rng = mulberry32(seed);
  const noise = gaussian(rng);
  const stepMs = 1000 / sampleRateHz;
  const samples: DistanceSample[] = [];
  for (let t = 0; t <= durationMs; t += stepMs) {
    let distance = 0.8;
    for (const tap of tapTimesMs) {
      const offset = Math.abs(t - tap);
      if (offset < 110) {
        const depth = Math.cos((offset / 110) * (Math.PI / 2));
        distance = Math.min(distance, 0.8 - 0.65 * depth);
      }
    }
    samples.push({ tMs: Math.round(t), distance: distance + noise() * 0.02 });
  }
  return samples;
}
