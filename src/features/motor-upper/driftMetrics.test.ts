import { describe, expect, it } from 'vitest';
import {
  OneEuroFilter,
  compareDrift,
  computeSideDriftMetrics,
  syntheticDriftSeries,
} from './driftMetrics';

const FLAT = (value: number, length = 200): (number | null)[] => Array(length).fill(value);
const ZEROS = (length = 200): (number | null)[] => Array(length).fill(0);

describe('computeSideDriftMetrics', () => {
  it('reports near zero drift for a steady hold', () => {
    const metrics = computeSideDriftMetrics(FLAT(90), ZEROS(), 20, 'left');
    expect(metrics.driftDeg).toBeCloseTo(0, 5);
    expect(metrics.driftRateDegPerSec).toBeCloseTo(0, 5);
    expect(metrics.maxDropDeg).toBe(0);
    expect(metrics.timeToDropSec).toBeNull();
    expect(metrics.validPercent).toBe(100);
  });

  it('measures a steady linear lowering in degrees and degrees per second', () => {
    // 90 degrees falling by 0.15 degrees per tick at 20 Hz equals 3 deg per s.
    const series = Array.from({ length: 200 }, (_, i) => 90 - i * 0.15);
    const metrics = computeSideDriftMetrics(series, ZEROS(), 20, 'right');
    expect(metrics.driftRateDegPerSec).toBeCloseTo(3, 1);
    expect(metrics.driftDeg).toBeGreaterThan(28);
    expect(metrics.driftDeg).toBeLessThan(31);
    expect(metrics.timeToDropSec).not.toBeNull();
  });

  it('counts null samples as gaps in the valid percent', () => {
    const series = FLAT(90);
    for (let i = 0; i < 50; i += 1) series[i] = null;
    const metrics = computeSideDriftMetrics(series, ZEROS(), 20, 'left');
    expect(metrics.validPercent).toBe(75);
  });

  it('tracks lateral offset separately from elevation', () => {
    const lateral = Array.from({ length: 200 }, (_, i) => (i < 100 ? 0.05 : -0.25));
    const metrics = computeSideDriftMetrics(FLAT(88), lateral, 20, 'left');
    expect(metrics.meanAbsLateral).toBeCloseTo(0.15, 5);
    expect(metrics.maxAbsLateral).toBeCloseTo(0.25, 5);
  });
});

describe('compareDrift with synthetic series', () => {
  it('sees the scripted one side lowering and names that side', () => {
    const comparison = compareDrift(syntheticDriftSeries('left-drift', 7));
    expect(comparison.left.driftDeg).toBeGreaterThan(18);
    expect(comparison.right.driftDeg).toBeLessThan(6);
    expect(comparison.largerDriftSide).toBe('left');
    expect(comparison.driftDifferenceDeg).toBeGreaterThan(12);
  });

  it('sees both sides as similar in the steady scenario', () => {
    const comparison = compareDrift(syntheticDriftSeries('steady', 3));
    expect(comparison.largerDriftSide).toBe('similar');
    expect(comparison.driftDifferenceDeg).toBeLessThan(1);
  });

  it('exposes the scripted tracking gaps in the valid percent', () => {
    const comparison = compareDrift(syntheticDriftSeries('steady', 3));
    expect(comparison.left.validPercent).toBeLessThan(100);
    expect(comparison.right.validPercent).toBeLessThan(100);
    expect(comparison.left.validPercent).toBeGreaterThan(90);
  });

  it('is deterministic for the same seed', () => {
    const first = syntheticDriftSeries('both-drift', 42);
    const second = syntheticDriftSeries('both-drift', 42);
    expect(first.left).toEqual(second.left);
    expect(first.rightLateral).toEqual(second.rightLateral);
  });
});

describe('OneEuroFilter', () => {
  it('reduces jitter on a steady signal', () => {
    const filter = new OneEuroFilter();
    let rawVariance = 0;
    let filteredVariance = 0;
    const raw: number[] = [];
    const filtered: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const value = 90 + (i % 2 === 0 ? 2 : -2);
      raw.push(value);
      filtered.push(filter.filter(value, i / 20));
    }
    const rawMean = raw.reduce((a, b) => a + b, 0) / raw.length;
    const filteredMean = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    rawVariance = raw.reduce((sum, v) => sum + (v - rawMean) ** 2, 0) / raw.length;
    filteredVariance =
      filtered.reduce((sum, v) => sum + (v - filteredMean) ** 2, 0) / filtered.length;
    expect(filteredVariance).toBeLessThan(rawVariance);
    expect(filteredMean).toBeCloseTo(90, 0);
  });

  it('still follows a genuine steady lowering', () => {
    const filter = new OneEuroFilter();
    let last = 0;
    for (let i = 0; i < 200; i += 1) {
      last = filter.filter(90 - i * 0.15, i / 20);
    }
    expect(last).toBeLessThan(65);
    expect(last).toBeGreaterThan(55);
  });
});
