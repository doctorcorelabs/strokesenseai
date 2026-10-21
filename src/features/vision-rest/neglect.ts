// Pure logic for the Visual Field and Neglect Explorer.
//
// All scoring is deterministic and transparent, mirroring how the classic
// bedside tests are scored: counts of missed targets per side, signed
// bisection deviation, and accuracy per quadrant. The scores describe what
// happened in this practice session. They are never converted into a label
// about the person who took the test.

import { createRng, randRange } from './rng';

export type Side = 'left' | 'right';
export type Quadrant = 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';

export interface FieldItem {
  id: number;
  /** Normalized stage coordinates, 0 to 1. */
  x: number;
  y: number;
  kind: 'target' | 'distractor';
}

export function sideOf(x: number): Side {
  return x < 0.5 ? 'left' : 'right';
}

export function quadrantOf(x: number, y: number): Quadrant {
  const vertical = y < 0.5 ? 'upper' : 'lower';
  return `${vertical}-${sideOf(x)}` as Quadrant;
}

const MIN_SEPARATION = 0.055;

function placeItems(
  count: number,
  kind: FieldItem['kind'],
  rng: () => number,
  placed: FieldItem[],
  nextId: number,
): FieldItem[] {
  const items: FieldItem[] = [];
  let guard = 0;
  while (items.length < count && guard < count * 80) {
    guard += 1;
    const candidate: FieldItem = {
      id: nextId + items.length,
      x: randRange(rng, 0.05, 0.95),
      y: randRange(rng, 0.06, 0.94),
      kind,
    };
    const tooClose = [...placed, ...items].some(
      (other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) < MIN_SEPARATION,
    );
    if (!tooClose) items.push(candidate);
  }
  return items;
}

/**
 * Generate a cancellation field: targets to find among distractors.
 * Targets are balanced across the two halves so per-side scores are fair.
 */
export function generateCancellation(
  seed: number,
  targetCount = 24,
  distractorCount = 36,
): FieldItem[] {
  const rng = createRng(seed);
  const perSide = Math.floor(targetCount / 2);
  const items: FieldItem[] = [];
  // Place targets side by side in turns so the halves stay balanced even
  // when rejection sampling drops a candidate.
  for (const side of ['left', 'right'] as Side[]) {
    let placedCount = 0;
    let guard = 0;
    while (placedCount < perSide && guard < perSide * 120) {
      guard += 1;
      const x =
        side === 'left' ? randRange(rng, 0.05, 0.47) : randRange(rng, 0.53, 0.95);
      const candidate: FieldItem = {
        id: items.length,
        x,
        y: randRange(rng, 0.06, 0.94),
        kind: 'target',
      };
      const tooClose = items.some(
        (other) => Math.hypot(other.x - candidate.x, other.y - candidate.y) < MIN_SEPARATION,
      );
      if (!tooClose) {
        items.push(candidate);
        placedCount += 1;
      }
    }
  }
  const distractors = placeItems(distractorCount, 'distractor', rng, items, items.length);
  return [...items, ...distractors];
}

export interface SideScore {
  found: number;
  missed: number;
  total: number;
}

export interface CancellationScore {
  foundTotal: number;
  targetTotal: number;
  falseTaps: number;
  bySide: Record<Side, SideScore>;
  byQuadrant: Record<Quadrant, SideScore>;
  /** Mean x of found targets: 0.5 means the found set is left-right balanced. */
  centerOfCancellation: number;
  elapsedMs: number;
}

function emptySideScore(): SideScore {
  return { found: 0, missed: 0, total: 0 };
}

/** Score a finished cancellation session. */
export function scoreCancellation(
  items: FieldItem[],
  foundIds: ReadonlySet<number>,
  falseTaps: number,
  elapsedMs: number,
): CancellationScore {
  const bySide: Record<Side, SideScore> = { left: emptySideScore(), right: emptySideScore() };
  const byQuadrant: Record<Quadrant, SideScore> = {
    'upper-left': emptySideScore(),
    'upper-right': emptySideScore(),
    'lower-left': emptySideScore(),
    'lower-right': emptySideScore(),
  };
  let foundTotal = 0;
  let foundXSum = 0;
  for (const item of items) {
    if (item.kind !== 'target') continue;
    const side = sideOf(item.x);
    const quadrant = quadrantOf(item.x, item.y);
    bySide[side].total += 1;
    byQuadrant[quadrant].total += 1;
    if (foundIds.has(item.id)) {
      foundTotal += 1;
      foundXSum += item.x;
      bySide[side].found += 1;
      byQuadrant[quadrant].found += 1;
    } else {
      bySide[side].missed += 1;
      byQuadrant[quadrant].missed += 1;
    }
  }
  return {
    foundTotal,
    targetTotal: bySide.left.total + bySide.right.total,
    falseTaps,
    bySide,
    byQuadrant,
    centerOfCancellation: foundTotal === 0 ? 0.5 : foundXSum / foundTotal,
    elapsedMs,
  };
}

/** Signed deviation of a bisection mark, as a fraction of the half length. */
export function bisectionDeviation(lineStartX: number, lineEndX: number, markX: number): number {
  const center = (lineStartX + lineEndX) / 2;
  const half = (lineEndX - lineStartX) / 2;
  if (half <= 0) return 0;
  return (markX - center) / half;
}

export interface BisectionScore {
  trials: number;
  /** Mean signed deviation: negative leans left of center, positive right. */
  meanDeviation: number;
  /** Mean absolute deviation, a size measure without direction. */
  meanAbsoluteDeviation: number;
  deviations: number[];
}

/** Score a set of line bisection trials. */
export function scoreBisection(
  trials: { startX: number; endX: number; markX: number }[],
): BisectionScore {
  const deviations = trials.map((t) => bisectionDeviation(t.startX, t.endX, t.markX));
  const mean =
    deviations.length === 0 ? 0 : deviations.reduce((a, b) => a + b, 0) / deviations.length;
  const meanAbs =
    deviations.length === 0
      ? 0
      : deviations.reduce((a, b) => a + Math.abs(b), 0) / deviations.length;
  return { trials: trials.length, meanDeviation: mean, meanAbsoluteDeviation: meanAbs, deviations };
}

/** A set of bisection lines with varied positions and lengths, deterministic per seed. */
export function generateBisectionLines(
  seed: number,
  count = 5,
): { startX: number; endX: number; y: number }[] {
  const rng = createRng(seed);
  const lines: { startX: number; endX: number; y: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = randRange(rng, 0.45, 0.75);
    const startX = randRange(rng, 0.06, 0.94 - length);
    lines.push({ startX, endX: startX + length, y: 0.2 + (i % 3) * 0.3 });
  }
  return lines;
}

export interface PeripheralTrial {
  quadrant: Quadrant;
  responded: boolean;
  latencyMs: number | null;
}

export interface PeripheralScore {
  trials: number;
  byQuadrant: Record<Quadrant, { shown: number; hits: number; accuracy: number }>;
  overallAccuracy: number;
  medianLatencyMs: number | null;
}

/** Score peripheral awareness trials (brief flashes in one quadrant). */
export function scorePeripheral(trials: PeripheralTrial[]): PeripheralScore {
  const byQuadrant: PeripheralScore['byQuadrant'] = {
    'upper-left': { shown: 0, hits: 0, accuracy: 0 },
    'upper-right': { shown: 0, hits: 0, accuracy: 0 },
    'lower-left': { shown: 0, hits: 0, accuracy: 0 },
    'lower-right': { shown: 0, hits: 0, accuracy: 0 },
  };
  const latencies: number[] = [];
  let hits = 0;
  for (const trial of trials) {
    byQuadrant[trial.quadrant].shown += 1;
    if (trial.responded) {
      byQuadrant[trial.quadrant].hits += 1;
      hits += 1;
      if (trial.latencyMs !== null) latencies.push(trial.latencyMs);
    }
  }
  for (const key of Object.keys(byQuadrant) as Quadrant[]) {
    const entry = byQuadrant[key];
    entry.accuracy = entry.shown === 0 ? 0 : entry.hits / entry.shown;
  }
  latencies.sort((a, b) => a - b);
  const medianLatency =
    latencies.length === 0
      ? null
      : latencies.length % 2 === 1
        ? latencies[Math.floor(latencies.length / 2)]
        : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) / 2;
  return {
    trials: trials.length,
    byQuadrant,
    overallAccuracy: trials.length === 0 ? 0 : hits / trials.length,
    medianLatencyMs: medianLatency,
  };
}

/** A planned sequence of peripheral flashes, deterministic per seed. */
export function planPeripheralFlashes(seed: number, count = 12): Quadrant[] {
  const rng = createRng(seed);
  const quadrants: Quadrant[] = ['upper-left', 'upper-right', 'lower-left', 'lower-right'];
  const plan: Quadrant[] = [];
  for (let i = 0; i < count; i += 1) {
    plan.push(quadrants[Math.floor(rng() * quadrants.length)]);
  }
  return plan;
}

export type PatientProfile = 'left-inattention' | 'right-inattention' | 'left-field-cut';

export const PATIENT_PROFILE_LABELS: Record<PatientProfile, string> = {
  'left-inattention': 'Programmed illustration: left sided inattention pattern',
  'right-inattention': 'Programmed illustration: right sided inattention pattern',
  'left-field-cut': 'Programmed illustration: left visual field cut pattern',
};

/**
 * Simulate a programmed patient profile on a cancellation field.
 * This generates demonstration data only. The miss pattern comes from a
 * fixed rule plus seeded randomness, so the result is an illustration of
 * what a response pattern can look like, never a measurement of a person.
 */
export function simulatePatient(
  items: FieldItem[],
  profile: PatientProfile,
  seed: number,
): { foundIds: Set<number>; falseTaps: number } {
  const rng = createRng(seed);
  const foundIds = new Set<number>();
  let falseTaps = 0;
  for (const item of items) {
    if (item.kind === 'distractor') {
      if (rng() < 0.04) falseTaps += 1;
      continue;
    }
    const side = sideOf(item.x);
    let missProbability = 0.05;
    if (profile === 'left-inattention') {
      missProbability = side === 'left' ? 0.25 + (0.5 - item.x) * 1.3 : 0.05;
    } else if (profile === 'right-inattention') {
      missProbability = side === 'right' ? 0.25 + (item.x - 0.5) * 1.3 : 0.05;
    } else if (profile === 'left-field-cut') {
      missProbability = item.x < 0.42 ? 1 : 0.06;
    }
    if (rng() >= missProbability) foundIds.add(item.id);
  }
  return { foundIds, falseTaps };
}
