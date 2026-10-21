// Generic, framework-free quiz and scoring engine shared by the clinical
// case labs (Mimic Detective, Localization Challenge, Virtual Patient OSCE).
// Everything here is pure and deterministic: the same inputs always produce
// the same outputs, so scores never depend on a model or on wall-clock luck
// beyond the explicit timer inputs.

export type ScoreBand = 'Strong' | 'Developing' | 'Needs more practice';

export interface ScorePart {
  id: string;
  label: string;
  earned: number;
  max: number;
  note?: string;
}

export interface ScoreSummary {
  earned: number;
  max: number;
  percent: number;
  band: ScoreBand;
  parts: ScorePart[];
}

/** Deterministic pseudo-random generator (mulberry32) for a numeric seed. */
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

/** Fisher-Yates shuffle driven by the supplied generator. Input untouched. */
export function shuffleWith<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Shuffle a copy of the list using a fixed seed, so sessions are reproducible. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  return shuffleWith(items, mulberry32(seed));
}

/** Pick the first `count` items of a seeded shuffle of the bank. */
export function pickSeeded<T>(items: readonly T[], count: number, seed: number): T[] {
  return seededShuffle(items, seed).slice(0, Math.max(0, count));
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Map a 0 to 100 percent onto the descriptive practice band used by all labs. */
export function bandForPercent(percent: number): ScoreBand {
  if (percent >= 80) return 'Strong';
  if (percent >= 50) return 'Developing';
  return 'Needs more practice';
}

/**
 * Combine scored parts into one summary. Each part's earned value is clamped
 * into 0..max so a scoring bug in one lab can never inflate the total.
 */
export function summarizeScore(parts: readonly ScorePart[]): ScoreSummary {
  const clean = parts.map((part) => ({
    ...part,
    earned: clamp(Math.round(part.earned), 0, part.max),
  }));
  const earned = clean.reduce((sum, part) => sum + part.earned, 0);
  const max = clean.reduce((sum, part) => sum + part.max, 0);
  const percent = max === 0 ? 0 : Math.round((earned / max) * 100);
  return { earned, max, percent, band: bandForPercent(percent), parts: clean };
}

/** Proportion helper: points scaled by how many of the key items were hit. */
export function proportionalPoints(found: number, total: number, points: number): number {
  if (total <= 0) return 0;
  return Math.round((clamp(found, 0, total) / total) * points);
}

/** Format a second count as m:ss, never negative. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** Whole seconds remaining until a deadline timestamp, never negative. */
export function remainingSeconds(deadlineMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

/** True once the deadline has been reached or passed. */
export function isExpired(deadlineMs: number, nowMs: number): boolean {
  return nowMs >= deadlineMs;
}
