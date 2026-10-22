// Pure logic for the rebuilt Speech Lab.
//
// Everything here is deterministic and side-effect free so it can be
// unit tested without a microphone: the pace zones shown to the reader,
// the live word map that follows an in-progress transcript, and the
// worked example that step 1 shows before any permission is asked.
// The heavy lifting (word alignment against the target sentence) reuses
// the deterministic aligner from the original speech tools.

import { alignWords, normalizeWords } from '../../speech-core/analysis';

// ---------------------------------------------------------------------------
// Pace zones
// ---------------------------------------------------------------------------

/**
 * Three reading pace zones. The main screens show only the zone label,
 * never a words-per-minute number; the number lives in folded details.
 * The bands describe reading a short practice sentence aloud, nothing
 * clinical: they only say whether the pace was slow, steady, or fast
 * compared with an ordinary read-aloud rhythm.
 */
export type PaceZone = 'slow' | 'steady' | 'fast';

export const PACE_ZONE_LABELS: Record<PaceZone, string> = {
  slow: 'Slow',
  steady: 'Steady',
  fast: 'Fast',
};

const STEADY_MIN_WPM = 90;
const STEADY_MAX_WPM = 170;

/** Zone for a words-per-minute value, or null when pace is unknown. */
export function paceZone(wordsPerMinute: number): PaceZone | null {
  if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) return null;
  if (wordsPerMinute < STEADY_MIN_WPM) return 'slow';
  if (wordsPerMinute > STEADY_MAX_WPM) return 'fast';
  return 'steady';
}

/** One plain sentence naming the zone, for result headlines and bodies. */
export function paceSentence(zone: PaceZone): string {
  return `Your pace stayed in the ${zone} zone.`;
}

// ---------------------------------------------------------------------------
// Live word map
// ---------------------------------------------------------------------------

export type LiveWordState = 'matched' | 'different' | 'skipped' | 'upcoming';

export interface LiveWord {
  /** Target word as written in the sentence. */
  word: string;
  state: LiveWordState;
  /** The word actually heard, for the 'different' state. */
  heard: string | null;
}

export interface LiveWordMap {
  words: LiveWord[];
  /** Words heard that are not part of the target sentence. */
  extraWords: string[];
}

/**
 * Map a still-growing transcript onto the target sentence for the live
 * highlight. Words the recognizer has not reached yet are 'upcoming',
 * not 'not heard': a missing word only counts as 'skipped' once a later
 * word has been heard. That distinction keeps the live display honest
 * while the reader is mid-sentence.
 */
export function liveWordMap(targetText: string, heardText: string): LiveWordMap {
  const alignment = alignWords(targetText, heardText);
  const displayWords = normalizeWords(targetText);

  const lastHeardIndex = alignment.items.reduce(
    (last, item, index) => (item.status === 'correct' || item.status === 'substituted' ? index : last),
    -1,
  );

  const words: LiveWord[] = [];
  let targetIndex = 0;
  alignment.items.forEach((item, index) => {
    if (item.status === 'extra') return;
    const word = displayWords[targetIndex] ?? item.target ?? '';
    targetIndex += 1;
    if (item.status === 'correct') {
      words.push({ word, state: 'matched', heard: item.heard });
    } else if (item.status === 'substituted') {
      words.push({ word, state: 'different', heard: item.heard });
    } else {
      words.push({ word, state: index < lastHeardIndex ? 'skipped' : 'upcoming', heard: null });
    }
  });

  return {
    words,
    extraWords: alignment.items
      .filter((item) => item.status === 'extra' && item.heard)
      .map((item) => item.heard as string),
  };
}

// ---------------------------------------------------------------------------
// Worked example for step 1
// ---------------------------------------------------------------------------

/**
 * The finished example shown before any microphone permission exists.
 * The heard side is a written example transcript, labelled as such in
 * the UI: it demonstrates one word heard differently (rain heard as
 * train) and one word not heard (the second "the"), so a first-time
 * visitor learns to read the word map on the example, not on themselves.
 */
export const EXAMPLE_TARGET = 'The rainbow appeared slowly after the heavy summer rain';
export const EXAMPLE_HEARD = 'The rainbow appeared slowly after heavy summer train';
