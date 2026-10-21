import { describe, expect, it } from 'vitest';
import {
  formatDurationMs,
  summarizeObserverEvents,
  summarizeSitToStand,
  summarizeSway,
} from './balance-logic';

describe('summarizeSitToStand', () => {
  it('computes per-repetition durations from the start signal', () => {
    const summary = summarizeSitToStand(1000, [3000, 5400, 7600]);
    expect(summary.repDurationsMs).toEqual([2000, 2400, 2200]);
    expect(summary.totalMs).toBe(6600);
    expect(summary.averageMs).toBeCloseTo(2200);
    expect(summary.fastestMs).toBe(2000);
    expect(summary.slowestMs).toBe(2400);
  });

  it('returns null statistics when no repetition was completed', () => {
    const summary = summarizeSitToStand(1000, []);
    expect(summary.repDurationsMs).toEqual([]);
    expect(summary.totalMs).toBe(0);
    expect(summary.averageMs).toBeNull();
    expect(summary.fastestMs).toBeNull();
    expect(summary.slowestMs).toBeNull();
  });

  it('ignores timestamps that do not move forward', () => {
    const summary = summarizeSitToStand(0, [2000, 1500, 2000, 4100]);
    expect(summary.repDurationsMs).toEqual([2000, 2100]);
  });

  it('handles a single repetition', () => {
    const summary = summarizeSitToStand(500, [2900]);
    expect(summary.repDurationsMs).toEqual([2400]);
    expect(summary.averageMs).toBe(2400);
    expect(summary.fastestMs).toBe(2400);
    expect(summary.slowestMs).toBe(2400);
  });
});

describe('formatDurationMs', () => {
  it('formats milliseconds as seconds with one decimal', () => {
    expect(formatDurationMs(12400)).toBe('12.4 s');
    expect(formatDurationMs(0)).toBe('0.0 s');
    expect(formatDurationMs(999)).toBe('1.0 s');
  });

  it('guards against invalid input', () => {
    expect(formatDurationMs(-5)).toBe('0.0 s');
    expect(formatDurationMs(Number.NaN)).toBe('0.0 s');
  });
});

describe('summarizeSway', () => {
  it('computes path length for a simple two-segment path', () => {
    const summary = summarizeSway([
      { x: 0, y: 0, tMs: 0 },
      { x: 3, y: 4, tMs: 1000 },
      { x: 6, y: 8, tMs: 2000 },
    ]);
    expect(summary.sampleCount).toBe(3);
    expect(summary.durationMs).toBe(2000);
    expect(summary.pathLength).toBeCloseTo(10);
    expect(summary.meanSpeed).toBeCloseTo(5);
  });

  it('reports zero spread for a perfectly still signal', () => {
    const summary = summarizeSway([
      { x: 2, y: 2, tMs: 0 },
      { x: 2, y: 2, tMs: 1000 },
      { x: 2, y: 2, tMs: 2000 },
    ]);
    expect(summary.pathLength).toBe(0);
    expect(summary.rmsSpread).toBe(0);
    expect(summary.maxExcursion).toBe(0);
  });

  it('measures spread around the samples own center, not the origin', () => {
    const summary = summarizeSway([
      { x: 10, y: 10, tMs: 0 },
      { x: 12, y: 10, tMs: 1000 },
    ]);
    // Center is (11, 10); each sample sits 1 unit away from it.
    expect(summary.rmsSpread).toBeCloseTo(1);
    expect(summary.maxExcursion).toBeCloseTo(1);
  });

  it('drops non-finite samples and sorts by time', () => {
    const summary = summarizeSway([
      { x: 6, y: 8, tMs: 2000 },
      { x: Number.NaN, y: 0, tMs: 500 },
      { x: 0, y: 0, tMs: 0 },
      { x: 3, y: 4, tMs: 1000 },
    ]);
    expect(summary.sampleCount).toBe(3);
    expect(summary.pathLength).toBeCloseTo(10);
  });

  it('returns zeros for an empty recording', () => {
    const summary = summarizeSway([]);
    expect(summary.sampleCount).toBe(0);
    expect(summary.pathLength).toBe(0);
    expect(summary.meanSpeed).toBe(0);
  });
});

describe('summarizeObserverEvents', () => {
  it('converts event timestamps to seconds from the start', () => {
    const summary = summarizeObserverEvents(2000, [4500, 2000, 9000]);
    expect(summary.count).toBe(3);
    expect(summary.eventTimesSec).toEqual([0, 2.5, 7]);
  });

  it('drops events recorded before the start', () => {
    const summary = summarizeObserverEvents(2000, [1000, 3000]);
    expect(summary.count).toBe(1);
    expect(summary.eventTimesSec).toEqual([1]);
  });
});
