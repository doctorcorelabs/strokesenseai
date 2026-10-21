// Pure measurement logic for the Arm Drift Quantifier.
//
// A sample series is a list of elevation angles in degrees, one entry per
// sampling tick. A null entry is a tracking gap: the pose was not visible
// in that tick. Gaps are reported, never filled in with invented values.
// Elevation is defined so 90 degrees means the arm is held out at shoulder
// height and 0 degrees means the arm hangs down. Every output is a
// description of one recording, never a clinical judgement.

import { gaussian, mulberry32 } from './synthetic';

export type DriftSide = 'left' | 'right';

export interface DriftSeries {
  /** Sampling rate in samples per second. */
  sampleRateHz: number;
  /** Elevation angle per tick for the left arm, null where tracking was lost. */
  left: (number | null)[];
  /** Elevation angle per tick for the right arm, null where tracking was lost. */
  right: (number | null)[];
  /** Lateral offset per tick for the left arm, scaled so 1 equals one shoulder width. */
  leftLateral: (number | null)[];
  /** Lateral offset per tick for the right arm, scaled so 1 equals one shoulder width. */
  rightLateral: (number | null)[];
}

export interface SideDriftMetrics {
  side: DriftSide;
  /** Mean elevation over the first half second of valid samples. */
  baselineDeg: number;
  /** Mean elevation over the last half second of valid samples. */
  endDeg: number;
  /** Baseline minus end. Positive means the arm ended lower than it started. */
  driftDeg: number;
  /** Lowering speed from a least squares fit, degrees per second. Positive means lowering. */
  driftRateDegPerSec: number;
  /** Largest drop below baseline seen in any single valid sample. */
  maxDropDeg: number;
  /**
   * Seconds from the start until the rolling half second mean first stayed
   * at least thresholdDeg below baseline, or null when that never happened.
   */
  timeToDropSec: number | null;
  /** Share of ticks with a valid sample, 0 to 100. */
  validPercent: number;
  /** Mean absolute lateral offset, in shoulder width units. */
  meanAbsLateral: number;
  /** Largest absolute lateral offset, in shoulder width units. */
  maxAbsLateral: number;
}

export interface DriftComparison {
  left: SideDriftMetrics;
  right: SideDriftMetrics;
  /** Absolute difference between the two drift amounts, in degrees. */
  driftDifferenceDeg: number;
  /** Which side lowered more in this recording, or 'similar' under 1 degree. */
  largerDriftSide: DriftSide | 'similar';
}

function validPoints(series: (number | null)[]): { index: number; value: number }[] {
  const points: { index: number; value: number }[] = [];
  series.forEach((value, index) => {
    if (value !== null && Number.isFinite(value)) points.push({ index, value });
  });
  return points;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Least squares slope of value against tick index, in units per tick. */
function slopePerTick(points: { index: number; value: number }[]): number {
  if (points.length < 2) return 0;
  const meanIndex = mean(points.map((point) => point.index));
  const meanValue = mean(points.map((point) => point.value));
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.index - meanIndex) * (point.value - meanValue);
    denominator += (point.index - meanIndex) ** 2;
  }
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function windowMean(
  series: (number | null)[],
  fromIndex: number,
  toIndex: number,
): number {
  const values: number[] = [];
  for (let i = Math.max(0, fromIndex); i <= Math.min(series.length - 1, toIndex); i += 1) {
    const value = series[i];
    if (value !== null && Number.isFinite(value)) values.push(value);
  }
  return mean(values);
}

/** Compute the full metric set for one side of a drift recording. */
export function computeSideDriftMetrics(
  series: (number | null)[],
  lateral: (number | null)[],
  sampleRateHz: number,
  side: DriftSide,
  dropThresholdDeg = 10,
): SideDriftMetrics {
  const points = validPoints(series);
  const halfWindow = Math.max(1, Math.round(sampleRateHz / 2));
  const baselineDeg = windowMean(series, 0, halfWindow - 1);
  const endDeg = windowMean(series, series.length - halfWindow, series.length - 1);
  const driftDeg = baselineDeg - endDeg;
  const driftRateDegPerSec = -slopePerTick(points) * sampleRateHz;
  const minValue = points.length > 0 ? Math.min(...points.map((point) => point.value)) : baselineDeg;
  const maxDropDeg = Math.max(0, baselineDeg - minValue);
  const validPercent = series.length === 0 ? 0 : (points.length / series.length) * 100;

  let timeToDropSec: number | null = null;
  for (let end = halfWindow - 1; end < series.length; end += 1) {
    const rolling = windowMean(series, end - halfWindow + 1, end);
    const windowPoints = validPoints(series.slice(end - halfWindow + 1, end + 1));
    if (windowPoints.length >= halfWindow / 2 && rolling <= baselineDeg - dropThresholdDeg) {
      timeToDropSec = end / sampleRateHz;
      break;
    }
  }

  const lateralValues = lateral
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .map((value) => Math.abs(value));
  const meanAbsLateral = mean(lateralValues);
  const maxAbsLateral = lateralValues.length > 0 ? Math.max(...lateralValues) : 0;

  return {
    side,
    baselineDeg,
    endDeg,
    driftDeg,
    driftRateDegPerSec,
    maxDropDeg,
    timeToDropSec,
    validPercent,
    meanAbsLateral,
    maxAbsLateral,
  };
}

/** Compare both sides of one recording as a descriptive summary. */
export function compareDrift(series: DriftSeries): DriftComparison {
  const left = computeSideDriftMetrics(series.left, series.leftLateral, series.sampleRateHz, 'left');
  const right = computeSideDriftMetrics(
    series.right,
    series.rightLateral,
    series.sampleRateHz,
    'right',
  );
  const driftDifferenceDeg = Math.abs(left.driftDeg - right.driftDeg);
  const largerDriftSide: DriftSide | 'similar' =
    driftDifferenceDeg < 1 ? 'similar' : left.driftDeg > right.driftDeg ? 'left' : 'right';
  return { left, right, driftDifferenceDeg, largerDriftSide };
}

/**
 * One Euro filter: adaptive smoothing that stays steady when the signal is
 * still and follows quickly when the signal really moves. Used to calm
 * landmark jitter without flattening genuine lowering.
 */
export class OneEuroFilter {
  private previousValue: number | null = null;
  private previousDerivative = 0;
  private previousTimeSec: number | null = null;

  constructor(
    private readonly minCutoffHz = 1.2,
    private readonly beta = 0.04,
    private readonly derivativeCutoffHz = 1,
  ) {}

  private static smoothingFactor(cutoffHz: number, deltaSec: number): number {
    const tau = 1 / (2 * Math.PI * cutoffHz);
    return 1 / (1 + tau / deltaSec);
  }

  filter(value: number, timeSec: number): number {
    if (this.previousValue === null || this.previousTimeSec === null) {
      this.previousValue = value;
      this.previousTimeSec = timeSec;
      return value;
    }
    const deltaSec = Math.max(1e-3, timeSec - this.previousTimeSec);
    const derivative = (value - this.previousValue) / deltaSec;
    const derivativeAlpha = OneEuroFilter.smoothingFactor(this.derivativeCutoffHz, deltaSec);
    const smoothedDerivative =
      derivativeAlpha * derivative + (1 - derivativeAlpha) * this.previousDerivative;
    const cutoff = this.minCutoffHz + this.beta * Math.abs(smoothedDerivative);
    const alpha = OneEuroFilter.smoothingFactor(cutoff, deltaSec);
    const result = alpha * value + (1 - alpha) * this.previousValue;
    this.previousValue = result;
    this.previousDerivative = smoothedDerivative;
    this.previousTimeSec = timeSec;
    return result;
  }
}

export type DriftScenario = 'steady' | 'left-drift' | 'right-drift' | 'both-drift';

/**
 * Build a synthetic 10 second drift recording. Scenarios describe the
 * scripted movement only; they are demonstrations of the measurement, not
 * examples of any medical state.
 */
export function syntheticDriftSeries(
  scenario: DriftScenario,
  seed = 7,
  sampleRateHz = 20,
  durationSec = 10,
): DriftSeries {
  const rng = mulberry32(seed);
  const noise = gaussian(rng);
  const total = Math.round(sampleRateHz * durationSec);
  const startDeg = 90;

  const dropFor = (side: DriftSide): number => {
    switch (scenario) {
      case 'left-drift':
        return side === 'left' ? 26 : 2;
      case 'right-drift':
        return side === 'right' ? 26 : 2;
      case 'both-drift':
        return 11;
      case 'steady':
      default:
        return 1.5;
    }
  };

  const buildSide = (side: DriftSide): (number | null)[] => {
    const drop = dropFor(side);
    const values: (number | null)[] = [];
    for (let i = 0; i < total; i += 1) {
      const t = i / sampleRateHz;
      const progress = t / durationSec;
      // Ease the lowering in so the first second still reads as a hold.
      const eased = progress * progress * (3 - 2 * progress);
      const angle = startDeg - drop * eased + noise() * 0.9;
      values.push(angle);
    }
    return values;
  };

  const buildLateral = (side: DriftSide): (number | null)[] => {
    const driftSide =
      (scenario === 'left-drift' && side === 'left') ||
      (scenario === 'right-drift' && side === 'right');
    const values: (number | null)[] = [];
    for (let i = 0; i < total; i += 1) {
      const progress = i / total;
      const base = driftSide ? 0.16 * progress : 0.02;
      values.push(base + noise() * 0.015);
    }
    return values;
  };

  const left = buildSide('left');
  const right = buildSide('right');
  const leftLateral = buildLateral('left');
  const rightLateral = buildLateral('right');

  // Script two short tracking gaps so gap handling is always demonstrated:
  // the right side loses tracking around second 4 and the left near second 8.
  const gap = (series: (number | null)[], lateralArr: (number | null)[], atSec: number) => {
    const start = Math.round(atSec * sampleRateHz);
    const length = Math.round(0.4 * sampleRateHz);
    for (let i = start; i < Math.min(series.length, start + length); i += 1) {
      series[i] = null;
      lateralArr[i] = null;
    }
  };
  gap(right, rightLateral, 4);
  gap(left, leftLateral, 8);

  return { sampleRateHz, left, right, leftLateral, rightLateral };
}
