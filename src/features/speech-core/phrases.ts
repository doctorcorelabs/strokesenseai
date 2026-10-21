// Standard reading phrases for the Dysarthria and Slurred Speech Analyzer.
// Sentences are short, phonetically varied, and written for this project.
// The target sentence is always known in advance, which is what makes the
// clarity measurement deterministic: the transcript is aligned to the
// target instead of being judged in the abstract.
// This release is English only.

export interface TestPhrase {
  id: string;
  text: string;
  /** What makes the sentence useful as a reading probe. */
  note: string;
}

export const TEST_PHRASES: TestPhrase[] = [
  {
    id: 'en-fox',
    text: 'The quick brown fox jumps over the lazy dog',
    note: 'Pangram: touches nearly every letter sound in English.',
  },
  {
    id: 'en-cat',
    text: 'Please put the cat outside before dinner tonight',
    note: 'Plosives and clusters (p, t, k, ts) that expose slurring early.',
  },
  {
    id: 'en-grandmother',
    text: 'My grandmother bakes fresh bread every Saturday morning',
    note: 'Longer sentence with blends (gr, br, fr) and a steady rhythm.',
  },
  {
    id: 'en-rainbow',
    text: 'The rainbow appeared slowly after the heavy summer rain',
    note: 'Liquids and diphthongs (r, l, ow, ay) across a calm sentence.',
  },
];

/** Speech recognition locale for the English reading phrases. */
export function recognitionLocale(): string {
  return 'en-US';
}
