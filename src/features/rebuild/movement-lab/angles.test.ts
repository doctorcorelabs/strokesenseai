import { describe, expect, it } from 'vitest';
import { armProjectedAngle, smoothSeries, type PosePoint } from './angles';

// Build a 33 point BlazePose-shaped array. Every point starts visible
// at the origin; tests move only the points a posture needs.
function pose(overrides: Record<number, Partial<PosePoint>> = {}): PosePoint[] {
  const points: PosePoint[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    visibility: 1,
  }));
  for (const [index, patch] of Object.entries(overrides)) {
    points[Number(index)] = { ...points[Number(index)], ...patch };
  }
  return points;
}

// Left shoulder at (0.35, 0.30), left hip directly below it.
const LEFT_BASE = {
  11: { x: 0.35, y: 0.3 },
  23: { x: 0.35, y: 0.62 },
};
// Right shoulder at (0.65, 0.30), right hip directly below it.
const RIGHT_BASE = {
  12: { x: 0.65, y: 0.3 },
  24: { x: 0.65, y: 0.62 },
};

describe('armProjectedAngle', () => {
  it('reads about 0 degrees when the arm hangs along the body', () => {
    const landmarks = pose({
      ...LEFT_BASE,
      15: { x: 0.35, y: 0.7 }, // left wrist straight below the shoulder
    });
    expect(armProjectedAngle(landmarks, 'left')).toBeCloseTo(0, 5);
  });

  it('reads about 90 degrees when the arm points straight out to the side', () => {
    const landmarks = pose({
      ...LEFT_BASE,
      ...RIGHT_BASE,
      15: { x: 0.05, y: 0.3 }, // left wrist level with the shoulder, out to the side
      16: { x: 0.95, y: 0.3 }, // right wrist the same on its side
    });
    expect(armProjectedAngle(landmarks, 'left')).toBeCloseTo(90, 5);
    expect(armProjectedAngle(landmarks, 'right')).toBeCloseTo(90, 5);
  });

  it('reads an in-between angle for a half-raised arm', () => {
    const landmarks = pose({
      ...LEFT_BASE,
      // Wrist down and out at 45 degrees from the torso line.
      15: { x: 0.35 - Math.SQRT1_2 * 0.4, y: 0.3 + Math.SQRT1_2 * 0.4 },
    });
    expect(armProjectedAngle(landmarks, 'left')).toBeCloseTo(45, 4);
  });

  it('returns null when a needed point is not visible enough', () => {
    const landmarks = pose({
      ...LEFT_BASE,
      15: { x: 0.05, y: 0.3, visibility: 0.4 }, // wrist barely seen
    });
    expect(armProjectedAngle(landmarks, 'left')).toBeNull();
  });

  it('returns null when a needed point is missing entirely', () => {
    const landmarks = pose({ ...LEFT_BASE }).slice(0, 15); // no wrist index 15
    expect(armProjectedAngle(landmarks, 'left')).toBeNull();
  });

  it('only judges the points of the side it was asked about', () => {
    const landmarks = pose({
      ...LEFT_BASE,
      ...RIGHT_BASE,
      15: { x: 0.05, y: 0.3 },
      16: { x: 0.95, y: 0.3, visibility: 0.1 }, // right wrist lost
    });
    expect(armProjectedAngle(landmarks, 'left')).toBeCloseTo(90, 5);
    expect(armProjectedAngle(landmarks, 'right')).toBeNull();
  });
});

describe('smoothSeries', () => {
  it('averages within the window', () => {
    expect(smoothSeries([0, 10, 20], 3)).toEqual([5, 10, 15]);
  });

  it('preserves nulls and averages around them without inventing values', () => {
    const result = smoothSeries([10, null, 20], 3);
    expect(result[0]).toBe(10);
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(20);
  });

  it('returns a copy for a window of 1', () => {
    const input = [3, null, 7];
    const result = smoothSeries(input, 1);
    expect(result).toEqual([3, null, 7]);
    expect(result).not.toBe(input);
  });
});
