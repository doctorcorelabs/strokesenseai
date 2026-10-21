// Pure, deterministic logic for the speech and aphasia labs.
// Everything in this file runs on the device and is unit tested. No score
// here is a clinical measure: the numbers describe one practice session.

import type { BoardWord, NamingItem } from './content';

// ---------------------------------------------------------------------------
// Naming: answer classification (the deterministic layer)
// ---------------------------------------------------------------------------

/** Normalize a typed answer before comparison: case, spacing, punctuation. */
export function normalizeAnswer(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein edit distance between two strings. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current: number[] = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length];
}

/** Similarity of two words as a ratio from 0 (unrelated) to 1 (identical). */
export function similarityRatio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

export type NamingBand = 'correct' | 'close' | 'miss' | 'no-response';

/**
 * Experimental error kinds, mirroring the categories named in PLANNING.md.
 * These labels are unvalidated practice observations, never findings.
 */
export type NamingErrorKind =
  | 'none'
  | 'semantic'
  | 'phonemic'
  | 'circumlocution'
  | 'unrelated'
  | 'no-response';

export interface NamingJudgement {
  band: NamingBand;
  errorKind: NamingErrorKind;
  /** The normalized form of the answer that was judged. */
  normalized: string;
}

/**
 * Judge one naming answer against a target item.
 * Order matters: exact match first, then the curated semantic field, then
 * phonetic closeness (same first sound and a high letter similarity), then
 * a multi word description (circumlocution), else an unrelated miss.
 * The last word of a multi word answer is also tried as the head word, so
 * "it is a dog" can still match "dog".
 */
export function judgeNamingAnswer(item: NamingItem, rawAnswer: string): NamingJudgement {
  const normalized = normalizeAnswer(rawAnswer);
  if (!normalized) return { band: 'no-response', errorKind: 'no-response', normalized };
  const target = normalizeAnswer(item.word);
  const words = normalized.split(' ');
  const headWord = words[words.length - 1] ?? normalized;
  if (normalized === target || headWord === target) {
    return { band: 'correct', errorKind: 'none', normalized };
  }
  const relatives = item.semanticRelatives.map((word) => normalizeAnswer(word));
  if (relatives.includes(normalized) || relatives.includes(headWord)) {
    return { band: 'close', errorKind: 'semantic', normalized };
  }
  const phoneticCandidate = headWord;
  const sameFirstSound = phoneticCandidate.charAt(0) === target.charAt(0);
  if (sameFirstSound && similarityRatio(phoneticCandidate, target) >= 0.5) {
    return { band: 'close', errorKind: 'phonemic', normalized };
  }
  if (words.length >= 3) {
    return { band: 'miss', errorKind: 'circumlocution', normalized };
  }
  return { band: 'miss', errorKind: 'unrelated', normalized };
}

// ---------------------------------------------------------------------------
// Naming: cue ladder and scoring
// ---------------------------------------------------------------------------

/**
 * Cue levels in reveal order: 0 nothing, 1 semantic hint, 2 first sound,
 * 3 multiple choice. The ladder only ever moves one step at a time.
 */
export type CueLevel = 0 | 1 | 2 | 3;

export const MAX_CUE_LEVEL: CueLevel = 3;

export function nextCueLevel(current: CueLevel): CueLevel {
  return Math.min(MAX_CUE_LEVEL, current + 1) as CueLevel;
}

/** The first sound cue for a word: its first letter and a letter skeleton. */
export function firstSoundCue(word: string): { letter: string; skeleton: string } {
  const clean = normalizeAnswer(word);
  const letter = clean.charAt(0).toUpperCase();
  const skeleton = clean
    .split('')
    .map((char, index) => (index === 0 ? char : '_'))
    .join(' ');
  return { letter, skeleton };
}

/**
 * Deterministic multiple choice options for an item: three other words at
 * the same level plus the target, ordered by a stable hash of the item id
 * so the correct word is not always in the same position and the layout
 * never changes between renders.
 */
export function multipleChoiceOptions(item: NamingItem, bank: NamingItem[]): string[] {
  const peers = bank.filter((entry) => entry.level === item.level && entry.id !== item.id);
  const distractors: string[] = [];
  for (let offset = 1; offset <= peers.length && distractors.length < 3; offset += 2) {
    const peer = peers[(item.id.length + offset) % peers.length];
    if (peer && !distractors.includes(peer.word)) distractors.push(peer.word);
  }
  const options = [item.word, ...distractors];
  const seed = [...item.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return options
    .map((word, index) => ({ word, key: (seed * (index + 3)) % 7 }))
    .sort((a, b) => a.key - b.key || a.word.localeCompare(b.word))
    .map((entry) => entry.word);
}

/**
 * Points for one scored naming attempt.
 * A correct answer earns 3 points with no cue, then 2, 1, and 1 as cues are
 * revealed (the last step, multiple choice, never drops below 1). A close
 * answer earns 1 point when produced with no cue and 0 after any cue, so
 * cues are never a way to farm partial credit. A miss earns 0.
 */
export function scoreNamingAttempt(band: NamingBand, cuesUsed: CueLevel): number {
  if (band === 'correct') return Math.max(1, 3 - cuesUsed);
  if (band === 'close') return cuesUsed === 0 ? 1 : 0;
  return 0;
}

// ---------------------------------------------------------------------------
// Naming: session records and summary
// ---------------------------------------------------------------------------

export interface NamingAttemptRecord {
  itemId: string;
  word: string;
  level: NamingItem['level'];
  answer: string;
  band: NamingBand;
  errorKind: NamingErrorKind;
  cuesUsed: CueLevel;
  points: number;
}

export interface NamingSummary {
  attempts: number;
  correct: number;
  close: number;
  missed: number;
  points: number;
  maxPoints: number;
  /** Points as a rounded percentage of the maximum, 0 when no attempts. */
  percent: number;
  /** Attempts that needed at least one cue before a correct answer. */
  cuedCorrect: number;
}

export function summarizeNamingSession(records: NamingAttemptRecord[]): NamingSummary {
  const attempts = records.length;
  const correct = records.filter((record) => record.band === 'correct').length;
  const close = records.filter((record) => record.band === 'close').length;
  const points = records.reduce((sum, record) => sum + record.points, 0);
  const maxPoints = attempts * 3;
  return {
    attempts,
    correct,
    close,
    missed: attempts - correct - close,
    points,
    maxPoints,
    percent: maxPoints === 0 ? 0 : Math.round((points / maxPoints) * 100),
    cuedCorrect: records.filter((record) => record.band === 'correct' && record.cuesUsed > 0)
      .length,
  };
}

// ---------------------------------------------------------------------------
// Communication board: sentence building and local pattern suggestions
// ---------------------------------------------------------------------------

export interface SentenceToken {
  label: string;
  kind: BoardWord['kind'];
}

/**
 * Join tapped tokens into a display sentence: labels in tap order, first
 * letter capitalized, a closing full stop. Tokens are never reordered,
 * because the order the person chose is part of what they meant.
 */
export function buildSentence(tokens: SentenceToken[]): string {
  const words = tokens.map((token) => token.label.trim()).filter(Boolean);
  if (words.length === 0) return '';
  const joined = words.join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

/**
 * Small deterministic pattern suggestions, computed locally. These are not
 * AI reconstructions: each rule names exactly what it changed, and the
 * person always confirms or edits before anything is spoken. Returns up to
 * two candidate sentences, never duplicating the built sentence.
 */
export function suggestExpansions(tokens: SentenceToken[]): string[] {
  const current = buildSentence(tokens);
  if (tokens.length === 0) return [];
  const labels = tokens.map((token) => token.label);
  const hasAction = tokens.some((token) => token.kind === 'action');
  const suggestions: string[] = [];
  if (!hasAction) {
    const personIndex = tokens.findIndex((token) => token.kind === 'person');
    if (personIndex >= 0) {
      for (const verb of ['want', 'need']) {
        const expanded = [...labels];
        expanded.splice(personIndex + 1, 0, verb);
        const sentence = buildSentence(expanded.map((label) => ({ label, kind: 'thing' as const })));
        if (sentence && sentence !== current) suggestions.push(sentence);
      }
    } else if (tokens.length === 1 && tokens[0].kind === 'thing') {
      suggestions.push(`I want ${labels[0]}.`, `I need ${labels[0]}.`);
    }
  }
  return suggestions.slice(0, 2);
}

// ---------------------------------------------------------------------------
// Comprehension check: scoring and stage progression
// ---------------------------------------------------------------------------

export type ComprehensionKind = 'one-step' | 'two-step' | 'yes-no';

export interface ComprehensionRecord {
  itemId: string;
  kind: ComprehensionKind;
  correct: boolean;
  points: number;
  maxPoints: number;
  /** Milliseconds from the command being presented to the final response. */
  responseMs: number;
}

/**
 * Score a sequence selection against the expected target order.
 * Each step tapped correctly in its position earns 1 point, so a two step
 * command with both objects tapped in the wrong order earns 0 for order
 * but the caller can still show that the right objects were found.
 */
export function scoreSequenceSelection(
  expected: string[],
  selected: string[],
): { correct: boolean; points: number; maxPoints: number; rightObjectsWrongOrder: boolean } {
  const maxPoints = expected.length;
  const points = expected.reduce(
    (sum, target, index) => sum + (selected[index] === target ? 1 : 0),
    0,
  );
  const correct = points === maxPoints;
  const sameSet =
    expected.length === selected.length &&
    expected.every((target) => selected.includes(target));
  return { correct, points, maxPoints, rightObjectsWrongOrder: !correct && sameSet };
}

/** Score one yes or no answer. */
export function scoreYesNo(expected: boolean, given: boolean): { correct: boolean; points: number } {
  const correct = expected === given;
  return { correct, points: correct ? 1 : 0 };
}

export type ComprehensionStage = 'setup' | 'one-step' | 'two-step' | 'yes-no' | 'summary';

export const COMPREHENSION_STAGE_ORDER: ComprehensionStage[] = [
  'setup',
  'one-step',
  'two-step',
  'yes-no',
  'summary',
];

/** The next stage in the fixed session order, or the same stage at the end. */
export function nextComprehensionStage(stage: ComprehensionStage): ComprehensionStage {
  const index = COMPREHENSION_STAGE_ORDER.indexOf(stage);
  return COMPREHENSION_STAGE_ORDER[Math.min(index + 1, COMPREHENSION_STAGE_ORDER.length - 1)];
}

export interface ComprehensionKindSummary {
  kind: ComprehensionKind;
  items: number;
  correct: number;
  points: number;
  maxPoints: number;
  averageResponseMs: number;
}

export interface ComprehensionSummary {
  totalItems: number;
  totalCorrect: number;
  points: number;
  maxPoints: number;
  byKind: ComprehensionKindSummary[];
}

export function summarizeComprehension(records: ComprehensionRecord[]): ComprehensionSummary {
  const kinds: ComprehensionKind[] = ['one-step', 'two-step', 'yes-no'];
  const byKind = kinds.map((kind) => {
    const subset = records.filter((record) => record.kind === kind);
    const totalMs = subset.reduce((sum, record) => sum + record.responseMs, 0);
    return {
      kind,
      items: subset.length,
      correct: subset.filter((record) => record.correct).length,
      points: subset.reduce((sum, record) => sum + record.points, 0),
      maxPoints: subset.reduce((sum, record) => sum + record.maxPoints, 0),
      averageResponseMs: subset.length === 0 ? 0 : Math.round(totalMs / subset.length),
    };
  });
  return {
    totalItems: records.length,
    totalCorrect: records.filter((record) => record.correct).length,
    points: records.reduce((sum, record) => sum + record.points, 0),
    maxPoints: records.reduce((sum, record) => sum + record.maxPoints, 0),
    byKind,
  };
}
