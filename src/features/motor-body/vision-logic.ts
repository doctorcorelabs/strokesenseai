// Pure quadrant mapping and trial accounting for the FAST Vision Check.
//
// The check shows brief dots in four screen areas while the other eye is
// covered and records which dots were noticed in time. Everything here is
// counting and geometry over screen coordinates. Screen areas are described
// as seen by the person looking at the screen, and a count of noticed dots
// is an observation about this session, never a visual field measurement.

export type Quadrant = 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';

export type EyeSide = 'left' | 'right';

export const QUADRANTS: readonly Quadrant[] = [
  'upper-left',
  'upper-right',
  'lower-left',
  'lower-right',
];

export const EYE_SIDES: readonly EyeSide[] = ['left', 'right'];

const QUADRANT_LABELS: Record<Quadrant, string> = {
  'upper-left': 'Upper left',
  'upper-right': 'Upper right',
  'lower-left': 'Lower left',
  'lower-right': 'Lower right',
};

/** Display label for a screen quadrant, as seen by the person looking at it. */
export function quadrantLabel(quadrant: Quadrant): string {
  return QUADRANT_LABELS[quadrant];
}

/**
 * Map a point given in ratio coordinates (0 to 1 across the test area) to
 * a screen quadrant. Points inside the central dead zone around the
 * fixation cross return 'fixation', because a dot that close to the center
 * says nothing about a quadrant. Points exactly on a midline outside the
 * dead zone are assigned to the right or lower side consistently.
 */
export function quadrantForPoint(
  xRatio: number,
  yRatio: number,
  deadZoneRatio = 0.08,
): Quadrant | 'fixation' {
  const dx = xRatio - 0.5;
  const dy = yRatio - 0.5;
  if (Math.abs(dx) < deadZoneRatio && Math.abs(dy) < deadZoneRatio) return 'fixation';
  const horizontal = dx < 0 ? 'left' : 'right';
  const vertical = dy < 0 ? 'upper' : 'lower';
  return `${vertical}-${horizontal}` as Quadrant;
}

/** Small deterministic random generator so trial plans are reproducible. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StimulusPoint {
  xRatio: number;
  yRatio: number;
}

/**
 * Pick a stimulus position inside a quadrant, in ratio coordinates. The
 * position keeps a margin from the screen edges and from the fixation
 * cross, so the dot is clearly inside one area of the screen.
 */
export function stimulusPointFor(quadrant: Quadrant, rng: () => number): StimulusPoint {
  // Each quadrant band spans ratio 0.06 to 0.38 on its own side of the
  // center, which keeps the dot clear of the edges and of the fixation
  // cross in the middle.
  return {
    xRatio: quadrant.endsWith('left') ? 0.06 + rng() * 0.32 : 0.62 + rng() * 0.32,
    yRatio: quadrant.startsWith('upper') ? 0.06 + rng() * 0.32 : 0.62 + rng() * 0.32,
  };
}

/**
 * Build a shuffled trial plan that shows each quadrant exactly
 * `perQuadrant` times. The order is shuffled with a seeded generator so a
 * session plan can be reproduced in tests and audits.
 */
export function buildTrialPlan(perQuadrant: number, seed: number): Quadrant[] {
  const plan: Quadrant[] = [];
  for (const quadrant of QUADRANTS) {
    for (let i = 0; i < perQuadrant; i += 1) plan.push(quadrant);
  }
  const rng = mulberry32(seed);
  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = plan[i];
    plan[i] = plan[j];
    plan[j] = swap;
  }
  return plan;
}

export interface VisionTrial {
  eye: EyeSide;
  quadrant: Quadrant;
  /** True when the person tapped while the dot was on screen. */
  seen: boolean;
}

export interface QuadrantStat {
  shown: number;
  seen: number;
  missed: number;
}

export type EyeQuadrantStats = Record<Quadrant, QuadrantStat>;

export type VisionSummary = Record<EyeSide, EyeQuadrantStats>;

function emptyQuadrantStats(): EyeQuadrantStats {
  return {
    'upper-left': { shown: 0, seen: 0, missed: 0 },
    'upper-right': { shown: 0, seen: 0, missed: 0 },
    'lower-left': { shown: 0, seen: 0, missed: 0 },
    'lower-right': { shown: 0, seen: 0, missed: 0 },
  };
}

/**
 * Tally recorded trials into a per-eye, per-quadrant result map. Every
 * quadrant is present in the result, including ones that were never shown,
 * so a caller can render a complete map without inventing values.
 */
export function summarizeVisionTrials(trials: readonly VisionTrial[]): VisionSummary {
  const summary: VisionSummary = { left: emptyQuadrantStats(), right: emptyQuadrantStats() };
  for (const trial of trials) {
    const stat = summary[trial.eye][trial.quadrant];
    stat.shown += 1;
    if (trial.seen) stat.seen += 1;
    else stat.missed += 1;
  }
  return summary;
}

/** Total counts for one eye across all quadrants. */
export function eyeTotals(summary: VisionSummary, eye: EyeSide): QuadrantStat {
  const total: QuadrantStat = { shown: 0, seen: 0, missed: 0 };
  for (const quadrant of QUADRANTS) {
    const stat = summary[eye][quadrant];
    total.shown += stat.shown;
    total.seen += stat.seen;
    total.missed += stat.missed;
  }
  return total;
}
