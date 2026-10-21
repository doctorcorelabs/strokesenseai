import { describe, expect, it } from 'vitest';
import {
  bandForPercent,
  clamp,
  formatClock,
  isExpired,
  mulberry32,
  pickSeeded,
  proportionalPoints,
  remainingSeconds,
  seededShuffle,
  summarizeScore,
} from './engine';

describe('mulberry32 and seeded shuffle', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('shuffles deterministically without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const first = seededShuffle(input, 99);
    const second = seededShuffle(input, 99);
    expect(first).toEqual(second);
    expect([...first].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('pickSeeded returns the requested count', () => {
    expect(pickSeeded([1, 2, 3, 4, 5], 3, 5)).toHaveLength(3);
    expect(pickSeeded([1, 2], 10, 5)).toHaveLength(2);
    expect(pickSeeded([1, 2], 0, 5)).toHaveLength(0);
  });
});

describe('scoring helpers', () => {
  it('clamps earned into range inside summarizeScore', () => {
    const summary = summarizeScore([
      { id: 'a', label: 'A', earned: 150, max: 100 },
      { id: 'b', label: 'B', earned: -5, max: 50 },
    ]);
    expect(summary.earned).toBe(100);
    expect(summary.max).toBe(150);
    expect(summary.percent).toBe(67);
  });

  it('handles an empty part list', () => {
    const summary = summarizeScore([]);
    expect(summary.percent).toBe(0);
    expect(summary.band).toBe('Needs more practice');
  });

  it('maps percents onto bands at the boundaries', () => {
    expect(bandForPercent(100)).toBe('Strong');
    expect(bandForPercent(80)).toBe('Strong');
    expect(bandForPercent(79)).toBe('Developing');
    expect(bandForPercent(50)).toBe('Developing');
    expect(bandForPercent(49)).toBe('Needs more practice');
  });

  it('proportionalPoints scales and guards zero totals', () => {
    expect(proportionalPoints(1, 2, 40)).toBe(20);
    expect(proportionalPoints(3, 4, 20)).toBe(15);
    expect(proportionalPoints(5, 0, 40)).toBe(0);
    expect(proportionalPoints(9, 4, 20)).toBe(20);
  });

  it('clamp keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});

describe('clock helpers', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(480)).toBe('8:00');
    expect(formatClock(-30)).toBe('0:00');
  });

  it('computes remaining seconds and expiry', () => {
    expect(remainingSeconds(10_000, 4_500)).toBe(6);
    expect(remainingSeconds(10_000, 10_000)).toBe(0);
    expect(remainingSeconds(10_000, 12_000)).toBe(0);
    expect(isExpired(10_000, 9_999)).toBe(false);
    expect(isExpired(10_000, 10_000)).toBe(true);
  });
});
