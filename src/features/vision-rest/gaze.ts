// Pure logic for the Eye and Gaze Tracker lab.
//
// Coordinates are normalized to the exercise stage: x and y run from 0 to 1.
// A "reading" is whatever signal stands in for gaze in the current mode:
// the pointer position in pointer practice mode, or a synthetic iris trace
// in demo mode. All scoring here is descriptive session statistics. Nothing
// in this module labels a pattern as normal or abnormal.

import { createRng } from './rng';

export interface NormPoint {
  x: number;
  y: number;
}

export interface TimedPoint extends NormPoint {
  /** Milliseconds since the exercise started. */
  t: number;
}

/** One calibration observation: a raw reading taken while a known target was shown. */
export interface CalibrationSample {
  reading: NormPoint;
  target: NormPoint;
}

/** Per-axis linear map from raw reading to stage coordinates: out = a * in + b. */
export interface LinearMap {
  ax: number;
  bx: number;
  ay: number;
  by: number;
}

/** Calibration mean error above this (in stage units) blocks the exercises. */
export const MAX_CALIBRATION_ERROR = 0.12;

/** The 9 point calibration grid. */
export const CALIBRATION_POINTS_9: NormPoint[] = [
  { x: 0.15, y: 0.15 },
  { x: 0.5, y: 0.15 },
  { x: 0.85, y: 0.15 },
  { x: 0.15, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.85, y: 0.5 },
  { x: 0.15, y: 0.85 },
  { x: 0.5, y: 0.85 },
  { x: 0.85, y: 0.85 },
];

/** The shorter 5 point calibration layout. */
export const CALIBRATION_POINTS_5: NormPoint[] = [
  { x: 0.5, y: 0.5 },
  { x: 0.15, y: 0.15 },
  { x: 0.85, y: 0.15 },
  { x: 0.15, y: 0.85 },
  { x: 0.85, y: 0.85 },
];

function fitAxis(pairs: { input: number; output: number }[]): { a: number; b: number } {
  const n = pairs.length;
  if (n === 0) return { a: 1, b: 0 };
  const meanIn = pairs.reduce((sum, p) => sum + p.input, 0) / n;
  const meanOut = pairs.reduce((sum, p) => sum + p.output, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const p of pairs) {
    numerator += (p.input - meanIn) * (p.output - meanOut);
    denominator += (p.input - meanIn) * (p.input - meanIn);
  }
  if (denominator < 1e-9) return { a: 1, b: meanOut - meanIn };
  const a = numerator / denominator;
  return { a, b: meanOut - a * meanIn };
}

/** Fit a per-axis linear map from calibration samples by least squares. */
export function fitLinearMap(samples: CalibrationSample[]): LinearMap {
  const xFit = fitAxis(samples.map((s) => ({ input: s.reading.x, output: s.target.x })));
  const yFit = fitAxis(samples.map((s) => ({ input: s.reading.y, output: s.target.y })));
  return { ax: xFit.a, bx: xFit.b, ay: yFit.a, by: yFit.b };
}

/** Apply a fitted map to one raw reading. */
export function applyMap(map: LinearMap, reading: NormPoint): NormPoint {
  return { x: map.ax * reading.x + map.bx, y: map.ay * reading.y + map.by };
}

/** Mean Euclidean distance between mapped readings and their targets. */
export function meanCalibrationError(map: LinearMap, samples: CalibrationSample[]): number {
  if (samples.length === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const sample of samples) {
    const mapped = applyMap(map, sample.reading);
    total += Math.hypot(mapped.x - sample.target.x, mapped.y - sample.target.y);
  }
  return total / samples.length;
}

/** True when the calibration error is small enough to start the exercises. */
export function canCalibrate(error: number): boolean {
  return Number.isFinite(error) && error <= MAX_CALIBRATION_ERROR;
}

/** The smooth pursuit target path used by the exercise (period about 9 s). */
export function pursuitTargetAt(tMs: number): NormPoint {
  return {
    x: 0.5 + 0.34 * Math.sin(tMs / 1400),
    y: 0.5 + 0.2 * Math.sin(tMs / 2100 + 1),
  };
}

function nearestSample(samples: TimedPoint[], t: number): TimedPoint | null {
  if (samples.length === 0) return null;
  let best = samples[0];
  let bestDiff = Math.abs(samples[0].t - t);
  for (const sample of samples) {
    const diff = Math.abs(sample.t - t);
    if (diff < bestDiff) {
      best = sample;
      bestDiff = diff;
    }
  }
  return best;
}

export interface PursuitScore {
  /** Mean distance between gaze and target, in stage units. */
  meanError: number;
  /** Best matching delay of gaze behind target, in milliseconds. */
  estimatedLagMs: number;
  /** Mean error after applying the best delay. */
  meanErrorAfterLag: number;
  sampleCount: number;
}

/**
 * Score a smooth pursuit recording against the known target path.
 * The lag search tries delays from 0 to 400 ms and keeps the delay with
 * the lowest mean error, which is a deliberately simple descriptive fit.
 */
export function scorePursuit(gaze: TimedPoint[], durationMs: number): PursuitScore {
  const stepMs = 100;
  const targetTimes: number[] = [];
  for (let t = 0; t <= durationMs; t += stepMs) targetTimes.push(t);
  const errorAtLag = (lagMs: number): number => {
    let total = 0;
    let count = 0;
    for (const t of targetTimes) {
      const sample = nearestSample(gaze, t + lagMs);
      if (!sample) continue;
      const target = pursuitTargetAt(t);
      total += Math.hypot(sample.x - target.x, sample.y - target.y);
      count += 1;
    }
    return count === 0 ? Number.POSITIVE_INFINITY : total / count;
  };
  let bestLag = 0;
  let bestError = errorAtLag(0);
  for (let lag = 40; lag <= 400; lag += 40) {
    const error = errorAtLag(lag);
    if (error < bestError) {
      bestError = error;
      bestLag = lag;
    }
  }
  return {
    meanError: errorAtLag(0),
    estimatedLagMs: bestLag,
    meanErrorAfterLag: bestError,
    sampleCount: gaze.length,
  };
}

export interface SaccadeScore {
  trials: number;
  hits: number;
  /** Hit rate from 0 to 1. */
  hitRate: number;
  /** Median response latency of hits, or null when there were no hits. */
  medianLatencyMs: number | null;
  latenciesMs: number[];
}

/** Score saccade trials: each trial is a target jump and an optional response time. */
export function scoreSaccades(
  trials: { jumpAtMs: number; responseAtMs: number | null }[],
  windowMs = 1500,
): SaccadeScore {
  const latencies: number[] = [];
  for (const trial of trials) {
    if (trial.responseAtMs === null) continue;
    const latency = trial.responseAtMs - trial.jumpAtMs;
    if (latency >= 0 && latency <= windowMs) latencies.push(latency);
  }
  return {
    trials: trials.length,
    hits: latencies.length,
    hitRate: trials.length === 0 ? 0 : latencies.length / trials.length,
    medianLatencyMs: latencies.length === 0 ? null : median(latencies),
    latenciesMs: latencies,
  };
}

export interface HoldingScore {
  /** Root mean square distance from the fixation point, in stage units. */
  rmsDrift: number;
  /** Largest single distance from the fixation point. */
  maxDrift: number;
  sampleCount: number;
}

/** Score a gaze holding recording against its fixation point. */
export function scoreHolding(samples: TimedPoint[], center: NormPoint): HoldingScore {
  if (samples.length === 0) return { rmsDrift: 0, maxDrift: 0, sampleCount: 0 };
  let sumSquares = 0;
  let max = 0;
  for (const sample of samples) {
    const d = Math.hypot(sample.x - center.x, sample.y - center.y);
    sumSquares += d * d;
    if (d > max) max = d;
  }
  return {
    rmsDrift: Math.sqrt(sumSquares / samples.length),
    maxDrift: max,
    sampleCount: samples.length,
  };
}

export const ZONE_LABELS = [
  'upper left',
  'upper center',
  'upper right',
  'middle left',
  'center',
  'middle right',
  'lower left',
  'lower center',
  'lower right',
] as const;

/** Bucket points into a 3 by 3 zone map of the stage. */
export function zoneMap(points: NormPoint[]): { label: string; count: number; share: number }[] {
  const counts = new Array<number>(9).fill(0);
  for (const point of points) {
    const col = Math.min(2, Math.max(0, Math.floor(point.x * 3)));
    const row = Math.min(2, Math.max(0, Math.floor(point.y * 3)));
    counts[row * 3 + col] += 1;
  }
  const total = points.length;
  return ZONE_LABELS.map((label, i) => ({
    label,
    count: counts[i],
    share: total === 0 ? 0 : counts[i] / total,
  }));
}

/** Median of a list of numbers, or 0 for an empty list. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Measured sampling rate in samples per second for a timed recording. */
export function samplingRateHz(samples: TimedPoint[]): number {
  if (samples.length < 2) return 0;
  const spanMs = samples[samples.length - 1].t - samples[0].t;
  if (spanMs <= 0) return 0;
  return (samples.length - 1) / (spanMs / 1000);
}

/**
 * A synthetic gaze trace that follows the pursuit path with noise and a
 * built in delay, used by demo mode so the scoring can be explored without
 * a camera. Fully deterministic for a given seed.
 */
export function syntheticPursuitTrace(
  seed: number,
  durationMs: number,
  options?: { noise?: number; lagMs?: number },
): TimedPoint[] {
  const rng = createRng(seed);
  const noise = options?.noise ?? 0.02;
  const lagMs = options?.lagMs ?? 160;
  const samples: TimedPoint[] = [];
  for (let t = 0; t <= durationMs; t += 33) {
    const target = pursuitTargetAt(Math.max(0, t - lagMs));
    samples.push({
      x: target.x + (rng() - 0.5) * 2 * noise,
      y: target.y + (rng() - 0.5) * 2 * noise,
      t,
    });
  }
  return samples;
}

/**
 * Synthetic calibration readings for demo mode: the "eye signal" is the
 * target point distorted by a small scale error plus noise, so the fitted
 * map and its error are genuinely computed, not scripted.
 */
export function syntheticCalibrationSamples(
  targets: NormPoint[],
  seed: number,
  steadiness: 'steady' | 'shaky',
): CalibrationSample[] {
  const rng = createRng(seed);
  const noise = steadiness === 'steady' ? 0.012 : 0.09;
  return targets.map((target) => ({
    target,
    reading: {
      x: 0.08 + target.x * 0.84 + (rng() - 0.5) * 2 * noise,
      y: 0.08 + target.y * 0.84 + (rng() - 0.5) * 2 * noise,
    },
  }));
}
