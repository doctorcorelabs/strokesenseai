// Standard reading phrases for the Dysarthria and Slurred Speech Analyzer.
// Sentences are short, phonetically varied, and written for this project.
// The target sentence is always known in advance, which is what makes the
// clarity measurement deterministic: the transcript is aligned to the
// target instead of being judged in the abstract.

export type PhraseLanguage = 'en' | 'id';

export interface TestPhrase {
  id: string;
  language: PhraseLanguage;
  text: string;
  /** What makes the sentence useful as a reading probe. */
  note: string;
}

export const TEST_PHRASES: TestPhrase[] = [
  {
    id: 'en-fox',
    language: 'en',
    text: 'The quick brown fox jumps over the lazy dog',
    note: 'Pangram: touches nearly every letter sound in English.',
  },
  {
    id: 'en-cat',
    language: 'en',
    text: 'Please put the cat outside before dinner tonight',
    note: 'Plosives and clusters (p, t, k, ts) that expose slurring early.',
  },
  {
    id: 'en-grandmother',
    language: 'en',
    text: 'My grandmother bakes fresh bread every Saturday morning',
    note: 'Longer sentence with blends (gr, br, fr) and a steady rhythm.',
  },
  {
    id: 'en-rainbow',
    language: 'en',
    text: 'The rainbow appeared slowly after the heavy summer rain',
    note: 'Liquids and diphthongs (r, l, ow, ay) across a calm sentence.',
  },
  {
    id: 'id-kucing',
    language: 'id',
    text: 'Kucing itu melompat ke atas meja kayu cokelat',
    note: 'Konsonan rangkap dan diftong dalam kalimat sehari-hari.',
  },
  {
    id: 'id-ibu',
    language: 'id',
    text: 'Ibu membeli sayur dan buah segar di pasar pagi ini',
    note: 'Bunyi b, s, dan r dalam kalimat belanja yang familiar.',
  },
  {
    id: 'id-sekolah',
    language: 'id',
    text: 'Kami berangkat ke sekolah sebelum matahari terbit',
    note: 'Awalan ber- dan ter- serta bunyi ng di tengah kalimat.',
  },
  {
    id: 'id-burung',
    language: 'id',
    text: 'Suara burung terdengar jelas dari halaman rumah kami',
    note: 'Bunyi r beruntun dan kata berimbuhan ter- untuk laju bicara.',
  },
];

/** All phrases for one language mode, in display order. */
export function phrasesForLanguage(language: PhraseLanguage): TestPhrase[] {
  return TEST_PHRASES.filter((phrase) => phrase.language === language);
}

/** Speech recognition locale matching a phrase language mode. */
export function recognitionLocale(language: PhraseLanguage): string {
  return language === 'id' ? 'id-ID' : 'en-US';
}
