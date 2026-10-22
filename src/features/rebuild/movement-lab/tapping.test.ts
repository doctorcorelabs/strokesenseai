import { describe, expect, it } from 'vitest';
import {
  detectTaps,
  normalizedPinchDistance,
  type HandPoint,
  type TapSample,
} from './tapping';

function series(points: [number, number | null][]): TapSample[] {
  return points.map(([timeMs, distance]) => ({ timeMs, distance }));
}

describe('normalizedPinchDistance', () => {
  it('divides the pinch distance by the wrist to middle base distance', () => {
    const landmarks: HandPoint[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    landmarks[0] = { x: 0, y: 0 }; // wrist
    landmarks[9] = { x: 1, y: 0 }; // middle base, scale is 1
    landmarks[4] = { x: 0.2, y: 0 }; // thumb tip
    landmarks[8] = { x: 0.5, y: 0 }; // index tip, 0.3 away
    expect(normalizedPinchDistance(landmarks)).toBeCloseTo(0.3, 6);
  });

  it('returns null when the hand scale is degenerate', () => {
    const landmarks: HandPoint[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    expect(normalizedPinchDistance(landmarks)).toBeNull();
  });

  it('returns null when landmarks are missing', () => {
    expect(normalizedPinchDistance([])).toBeNull();
  });
});

describe('detectTaps', () => {
  it('counts five clear taps as five', () => {
    const points: [number, number | null][] = [];
    for (let tap = 0; tap < 5; tap += 1) {
      const start = tap * 400;
      points.push([start, 1.0]); // open
      points.push([start + 100, 0.2]); // touch
      points.push([start + 200, 1.0]); // open again
    }
    const result = detectTaps(series(points));
    expect(result.count).toBe(5);
    expect(result.tapTimesMs).toEqual([100, 500, 900, 1300, 1700]);
    expect(result.intervalsMs).toEqual([400, 400, 400, 400]);
  });

  it('counts zero for a still, open hand', () => {
    const points: [number, number | null][] = [];
    for (let t = 0; t <= 2000; t += 100) points.push([t, 0.9]);
    expect(detectTaps(series(points)).count).toBe(0);
  });

  it('does not double count one touch that hovers between the thresholds', () => {
    const result = detectTaps(
      series([
        [0, 1.0],
        [100, 0.2], // the touch
        [200, 0.5], // hovering between close and open thresholds
        [300, 0.2], // still the same touch
        [400, 1.0], // open again
      ]),
    );
    expect(result.count).toBe(1);
  });

  it('skips null samples without counting or resetting', () => {
    const result = detectTaps(
      series([
        [0, 1.0],
        [100, 0.2], // touch
        [200, null], // hand lost for a moment
        [300, 0.2], // same touch, seen again
        [400, 1.0],
        [600, 0.2], // a real second tap
        [700, 1.0],
      ]),
    );
    expect(result.count).toBe(2);
    expect(result.tapTimesMs).toEqual([100, 600]);
  });

  it('respects a custom minimum interval', () => {
    const result = detectTaps(
      series([
        [0, 1.0],
        [100, 0.2],
        [160, 1.0],
        [220, 0.2], // only 120 ms after the first tap
        [400, 1.0],
      ]),
      { minIntervalMs: 200 },
    );
    expect(result.count).toBe(1);
  });
});
