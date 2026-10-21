import { describe, expect, it } from 'vitest';
import {
  QUADRANTS,
  buildTrialPlan,
  eyeTotals,
  mulberry32,
  quadrantForPoint,
  quadrantLabel,
  stimulusPointFor,
  summarizeVisionTrials,
} from './vision-logic';
import type { VisionTrial } from './vision-logic';

describe('quadrantForPoint', () => {
  it('maps each corner region to its quadrant', () => {
    expect(quadrantForPoint(0.2, 0.2)).toBe('upper-left');
    expect(quadrantForPoint(0.8, 0.2)).toBe('upper-right');
    expect(quadrantForPoint(0.2, 0.85)).toBe('lower-left');
    expect(quadrantForPoint(0.9, 0.9)).toBe('lower-right');
  });

  it('returns fixation inside the central dead zone', () => {
    expect(quadrantForPoint(0.5, 0.5)).toBe('fixation');
    expect(quadrantForPoint(0.53, 0.47)).toBe('fixation');
  });

  it('assigns midline points outside the dead zone to a quadrant', () => {
    expect(quadrantForPoint(0.5, 0.1)).toBe('upper-right');
    expect(quadrantForPoint(0.1, 0.5)).toBe('lower-left');
  });
});

describe('stimulusPointFor', () => {
  it('places the dot inside the requested quadrant band', () => {
    const rng = mulberry32(42);
    for (const quadrant of QUADRANTS) {
      for (let i = 0; i < 25; i += 1) {
        const point = stimulusPointFor(quadrant, rng);
        expect(quadrantForPoint(point.xRatio, point.yRatio)).toBe(quadrant);
      }
    }
  });

  it('keeps the dot away from the edges and the center', () => {
    const rng = mulberry32(7);
    for (const quadrant of QUADRANTS) {
      const point = stimulusPointFor(quadrant, rng);
      expect(point.xRatio).toBeGreaterThanOrEqual(0.06);
      expect(point.xRatio).toBeLessThanOrEqual(0.94);
      expect(point.yRatio).toBeGreaterThanOrEqual(0.06);
      expect(point.yRatio).toBeLessThanOrEqual(0.94);
    }
  });
});

describe('buildTrialPlan', () => {
  it('contains each quadrant exactly the requested number of times', () => {
    const plan = buildTrialPlan(3, 1234);
    expect(plan).toHaveLength(12);
    for (const quadrant of QUADRANTS) {
      expect(plan.filter((entry) => entry === quadrant)).toHaveLength(3);
    }
  });

  it('is reproducible for the same seed', () => {
    expect(buildTrialPlan(2, 99)).toEqual(buildTrialPlan(2, 99));
  });

  it('produces an empty plan when perQuadrant is zero', () => {
    expect(buildTrialPlan(0, 1)).toEqual([]);
  });
});

describe('summarizeVisionTrials', () => {
  const trials: VisionTrial[] = [
    { eye: 'left', quadrant: 'upper-left', seen: true },
    { eye: 'left', quadrant: 'upper-left', seen: false },
    { eye: 'left', quadrant: 'lower-right', seen: true },
    { eye: 'right', quadrant: 'upper-right', seen: false },
  ];

  it('tallies shown, seen, and missed per eye and quadrant', () => {
    const summary = summarizeVisionTrials(trials);
    expect(summary.left['upper-left']).toEqual({ shown: 2, seen: 1, missed: 1 });
    expect(summary.left['lower-right']).toEqual({ shown: 1, seen: 1, missed: 0 });
    expect(summary.right['upper-right']).toEqual({ shown: 1, seen: 0, missed: 1 });
  });

  it('includes quadrants that were never shown, with zero counts', () => {
    const summary = summarizeVisionTrials(trials);
    expect(summary.right['lower-left']).toEqual({ shown: 0, seen: 0, missed: 0 });
    expect(summary.left['upper-right']).toEqual({ shown: 0, seen: 0, missed: 0 });
  });

  it('computes per-eye totals', () => {
    const summary = summarizeVisionTrials(trials);
    expect(eyeTotals(summary, 'left')).toEqual({ shown: 3, seen: 2, missed: 1 });
    expect(eyeTotals(summary, 'right')).toEqual({ shown: 1, seen: 0, missed: 1 });
  });

  it('handles no trials at all', () => {
    const summary = summarizeVisionTrials([]);
    expect(eyeTotals(summary, 'left')).toEqual({ shown: 0, seen: 0, missed: 0 });
    expect(eyeTotals(summary, 'right')).toEqual({ shown: 0, seen: 0, missed: 0 });
  });
});

describe('quadrantLabel', () => {
  it('labels every quadrant', () => {
    expect(quadrantLabel('upper-left')).toBe('Upper left');
    expect(quadrantLabel('lower-right')).toBe('Lower right');
  });
});
