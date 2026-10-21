import { describe, expect, it } from 'vitest';
import {
  compareTapping,
  computeTappingMetrics,
  detectTaps,
  syntheticDistanceSignal,
  syntheticTapTimes,
  type DistanceSample,
} from './tappingMetrics';

function signalFromShape(values: number[], stepMs = 16): DistanceSample[] {
  return values.map((distance, i) => ({ tMs: i * stepMs, distance }));
}

describe('detectTaps hysteresis', () => {
  it('counts one tap for one full close and open cycle', () => {
    const samples = signalFromShape([0.8, 0.8, 0.4, 0.2, 0.4, 0.8, 0.85]);
    expect(detectTaps(samples)).toHaveLength(1);
  });

  it('does not double count jitter around the low threshold', () => {
    // After the tap, the signal wobbles under the low threshold several
    // times without ever rising above the high threshold again.
    const samples = signalFromShape([0.8, 0.2, 0.3, 0.2, 0.34, 0.2, 0.4, 0.45]);
    expect(detectTaps(samples)).toHaveLength(1);
  });

  it('ignores shallow dips that never cross the low threshold', () => {
    const samples = signalFromShape([0.8, 0.6, 0.45, 0.6, 0.8]);
    expect(detectTaps(samples)).toHaveLength(0);
  });

  it('round trips a synthetic signal back to nearly the same taps', () => {
    const taps = syntheticTapTimes({ durationMs: 15000, startHz: 4, endHz: 4, jitterCv: 0.03, seed: 21 });
    const signal = syntheticDistanceSignal(taps, 15000, 60, 9);
    const detected = detectTaps(signal);
    expect(Math.abs(detected.length - taps.length)).toBeLessThanOrEqual(2);
    for (let i = 0; i < Math.min(detected.length, taps.length); i += 1) {
      expect(Math.abs(detected[i] - taps[i])).toBeLessThan(90);
    }
  });
});

describe('computeTappingMetrics', () => {
  it('summarises a perfectly regular 4 Hz recording', () => {
    const taps = Array.from({ length: 60 }, (_, i) => 250 + i * 250);
    const metrics = computeTappingMetrics(taps, 15000);
    expect(metrics.tapCount).toBe(60);
    expect(metrics.frequencyHz).toBeCloseTo(4, 5);
    expect(metrics.meanIntervalMs).toBeCloseTo(250, 5);
    expect(metrics.intervalCv).toBeCloseTo(0, 5);
    expect(metrics.hesitationPauses).toBe(0);
  });

  it('detects slowing in the second half as a negative change', () => {
    const taps = syntheticTapTimes({ durationMs: 15000, startHz: 5, endHz: 2.5, jitterCv: 0.02, seed: 4 });
    const metrics = computeTappingMetrics(taps, 15000);
    expect(metrics.secondHalfHz).toBeLessThan(metrics.firstHalfHz);
    expect(metrics.fatigueChangePct).toBeLessThan(-20);
  });

  it('counts inserted hesitations as pauses', () => {
    const taps = syntheticTapTimes({
      durationMs: 15000,
      startHz: 4,
      endHz: 4,
      jitterCv: 0.02,
      hesitationCount: 2,
      seed: 8,
    });
    const metrics = computeTappingMetrics(taps, 15000);
    expect(metrics.hesitationPauses).toBeGreaterThanOrEqual(2);
    expect(metrics.longestPauseMs).toBeGreaterThan(600);
  });

  it('keeps every interval for audit', () => {
    const taps = [100, 350, 640, 900];
    const metrics = computeTappingMetrics(taps, 15000);
    expect(metrics.intervalsMs).toEqual([250, 290, 260]);
  });

  it('handles an empty recording without inventing values', () => {
    const metrics = computeTappingMetrics([], 15000);
    expect(metrics.tapCount).toBe(0);
    expect(metrics.frequencyHz).toBe(0);
    expect(metrics.intervalCv).toBe(0);
  });
});

describe('compareTapping', () => {
  it('names the faster hand and quantifies the difference', () => {
    const fast = computeTappingMetrics(
      Array.from({ length: 75 }, (_, i) => 200 + i * 200),
      15000,
    );
    const slow = computeTappingMetrics(
      Array.from({ length: 45 }, (_, i) => 250 + i * 330),
      15000,
    );
    const comparison = compareTapping(fast, slow);
    expect(comparison.fasterHand).toBe('left');
    expect(comparison.frequencyAsymmetryPct).toBeGreaterThan(20);
    expect(comparison.tapCountDifference).toBe(30);
  });

  it('calls two near equal recordings similar', () => {
    const a = computeTappingMetrics(
      Array.from({ length: 60 }, (_, i) => 250 + i * 250),
      15000,
    );
    const b = computeTappingMetrics(
      Array.from({ length: 61 }, (_, i) => 240 + i * 245),
      15000,
    );
    expect(compareTapping(a, b).fasterHand).toBe('similar');
  });
});

describe('syntheticTapTimes', () => {
  it('is deterministic for the same seed', () => {
    const options = { durationMs: 15000, startHz: 4, endHz: 3, seed: 13 };
    expect(syntheticTapTimes(options)).toEqual(syntheticTapTimes(options));
  });

  it('produces more taps at a higher steady rate', () => {
    const slow = syntheticTapTimes({ durationMs: 15000, startHz: 2, endHz: 2, seed: 1 });
    const fast = syntheticTapTimes({ durationMs: 15000, startHz: 5, endHz: 5, seed: 1 });
    expect(fast.length).toBeGreaterThan(slow.length * 2);
  });
});
