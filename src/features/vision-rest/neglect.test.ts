import { describe, expect, it } from 'vitest';
import {
  bisectionDeviation,
  generateBisectionLines,
  generateCancellation,
  planPeripheralFlashes,
  quadrantOf,
  scoreBisection,
  scoreCancellation,
  scorePeripheral,
  sideOf,
  simulatePatient,
} from './neglect';

describe('cancellation field and scoring', () => {
  it('generates a deterministic field with balanced targets per side', () => {
    const first = generateCancellation(11);
    const second = generateCancellation(11);
    expect(first).toEqual(second);
    const targets = first.filter((item) => item.kind === 'target');
    expect(targets.length).toBe(24);
    expect(targets.filter((item) => sideOf(item.x) === 'left').length).toBe(12);
    expect(targets.filter((item) => sideOf(item.x) === 'right').length).toBe(12);
    const ids = new Set(first.map((item) => item.id));
    expect(ids.size).toBe(first.length);
  });

  it('keeps a minimum separation between items', () => {
    const items = generateCancellation(3);
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const d = Math.hypot(items[i].x - items[j].x, items[i].y - items[j].y);
        expect(d).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it('scores found and missed targets per side and quadrant', () => {
    const items = generateCancellation(5);
    const targets = items.filter((item) => item.kind === 'target');
    const leftTargets = targets.filter((item) => sideOf(item.x) === 'left');
    const found = new Set(leftTargets.map((item) => item.id));
    const score = scoreCancellation(items, found, 2, 45000);
    expect(score.foundTotal).toBe(leftTargets.length);
    expect(score.bySide.left.found).toBe(leftTargets.length);
    expect(score.bySide.left.missed).toBe(0);
    expect(score.bySide.right.missed).toBe(score.bySide.right.total);
    expect(score.falseTaps).toBe(2);
    expect(score.elapsedMs).toBe(45000);
    const quadrantTotals =
      score.byQuadrant['upper-left'].total +
      score.byQuadrant['upper-right'].total +
      score.byQuadrant['lower-left'].total +
      score.byQuadrant['lower-right'].total;
    expect(quadrantTotals).toBe(score.targetTotal);
    expect(score.centerOfCancellation).toBeLessThan(0.5);
  });

  it('reports a balanced center when everything is found', () => {
    const items = generateCancellation(9);
    const found = new Set(
      items.filter((item) => item.kind === 'target').map((item) => item.id),
    );
    const score = scoreCancellation(items, found, 0, 30000);
    expect(score.foundTotal).toBe(score.targetTotal);
    expect(score.centerOfCancellation).toBeGreaterThan(0.4);
    expect(score.centerOfCancellation).toBeLessThan(0.6);
  });
});

describe('line bisection', () => {
  it('computes signed deviation as a fraction of the half length', () => {
    expect(bisectionDeviation(0.1, 0.9, 0.5)).toBeCloseTo(0, 6);
    expect(bisectionDeviation(0.1, 0.9, 0.7)).toBeCloseTo(0.5, 6);
    expect(bisectionDeviation(0.1, 0.9, 0.3)).toBeCloseTo(-0.5, 6);
  });

  it('summarizes trials with mean signed and absolute deviation', () => {
    const score = scoreBisection([
      { startX: 0.1, endX: 0.9, markX: 0.5 },
      { startX: 0.1, endX: 0.9, markX: 0.6 },
      { startX: 0.1, endX: 0.9, markX: 0.4 },
    ]);
    expect(score.trials).toBe(3);
    expect(score.meanDeviation).toBeCloseTo(0, 6);
    expect(score.meanAbsoluteDeviation).toBeCloseTo(1 / 6, 4);
  });

  it('generates deterministic lines inside the stage', () => {
    const lines = generateBisectionLines(4);
    expect(lines).toEqual(generateBisectionLines(4));
    expect(lines.length).toBe(5);
    for (const line of lines) {
      expect(line.startX).toBeGreaterThanOrEqual(0);
      expect(line.endX).toBeLessThanOrEqual(1);
      expect(line.endX).toBeGreaterThan(line.startX);
    }
  });
});

describe('peripheral awareness', () => {
  it('classifies quadrants', () => {
    expect(quadrantOf(0.2, 0.2)).toBe('upper-left');
    expect(quadrantOf(0.8, 0.2)).toBe('upper-right');
    expect(quadrantOf(0.2, 0.8)).toBe('lower-left');
    expect(quadrantOf(0.8, 0.8)).toBe('lower-right');
  });

  it('scores accuracy per quadrant and median latency', () => {
    const score = scorePeripheral([
      { quadrant: 'upper-left', responded: true, latencyMs: 400 },
      { quadrant: 'upper-left', responded: false, latencyMs: null },
      { quadrant: 'lower-right', responded: true, latencyMs: 600 },
      { quadrant: 'lower-right', responded: true, latencyMs: 500 },
    ]);
    expect(score.trials).toBe(4);
    expect(score.byQuadrant['upper-left']).toMatchObject({ shown: 2, hits: 1, accuracy: 0.5 });
    expect(score.byQuadrant['lower-right'].accuracy).toBe(1);
    expect(score.overallAccuracy).toBeCloseTo(0.75, 6);
    expect(score.medianLatencyMs).toBe(500);
  });

  it('plans a deterministic flash sequence', () => {
    const plan = planPeripheralFlashes(2, 12);
    expect(plan).toEqual(planPeripheralFlashes(2, 12));
    expect(plan.length).toBe(12);
  });
});

describe('simulated patient profiles', () => {
  it('left inattention profile misses more targets on the left', () => {
    const items = generateCancellation(21);
    const { foundIds } = simulatePatient(items, 'left-inattention', 99);
    const score = scoreCancellation(items, foundIds, 0, 0);
    expect(score.bySide.left.missed).toBeGreaterThan(score.bySide.right.missed);
  });

  it('left field cut profile misses nearly everything on the far left', () => {
    const items = generateCancellation(21);
    const { foundIds } = simulatePatient(items, 'left-field-cut', 99);
    const farLeft = items.filter((item) => item.kind === 'target' && item.x < 0.42);
    const foundFarLeft = farLeft.filter((item) => foundIds.has(item.id));
    expect(foundFarLeft.length).toBe(0);
    expect(farLeft.length).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const items = generateCancellation(21);
    const first = simulatePatient(items, 'right-inattention', 5);
    const second = simulatePatient(items, 'right-inattention', 5);
    expect([...first.foundIds].sort()).toEqual([...second.foundIds].sort());
    expect(first.falseTaps).toBe(second.falseTaps);
  });
});
