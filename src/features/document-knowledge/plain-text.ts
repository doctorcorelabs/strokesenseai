// Pure text logic for the Plain-Language Translator: readability metrics,
// locked-element extraction and verification, and the glossary based local
// rewrite used when no AI is available. Everything here is deterministic
// and unit tested. The safety rule mirrors the product plan: numbers,
// units, dates, and medicine names must survive a rewrite unchanged, and
// any difference is reported instead of hidden.

import { GLOSSARY } from './glossary';

// ---------------------------------------------------------------------------
// Readability
// ---------------------------------------------------------------------------

export interface ReadabilityStats {
  words: number;
  sentences: number;
  syllables: number;
  averageWordsPerSentence: number;
  /** Flesch Reading Ease, roughly 0 (hard) to 100 (easy). English text. */
  readingEase: number;
  /** Flesch-Kincaid grade estimate. English text. */
  gradeLevel: number;
  /** Short plain label for the grade estimate. */
  label: string;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/.test(word));
}

/** Rough English syllable count for one word. */
export function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return 0;
  if (cleaned.length <= 3) return 1;
  const groups = cleaned
    .replace(/e$/, '')
    .match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function gradeLabel(grade: number): string {
  if (grade <= 6) return 'Easy: most adults can read this';
  if (grade <= 8) return 'Plain: aimed at grade 6 to 8';
  if (grade <= 10) return 'Fairly hard: some medical wording remains';
  if (grade <= 12) return 'Hard: dense medical wording';
  return 'Very hard: specialist wording';
}

export function readabilityStats(text: string): ReadabilityStats {
  const words = splitWords(text);
  const sentences = Math.max(1, splitSentences(text).length);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const wordCount = words.length;
  if (wordCount === 0) {
    return {
      words: 0,
      sentences: 0,
      syllables: 0,
      averageWordsPerSentence: 0,
      readingEase: 0,
      gradeLevel: 0,
      label: 'No text yet',
    };
  }
  const wordsPerSentence = wordCount / sentences;
  const syllablesPerWord = syllables / wordCount;
  const readingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const roundedGrade = Math.max(0, Math.round(grade * 10) / 10);
  return {
    words: wordCount,
    sentences,
    syllables,
    averageWordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    readingEase: Math.round(Math.max(0, Math.min(100, readingEase))),
    gradeLevel: roundedGrade,
    label: gradeLabel(roundedGrade),
  };
}

// ---------------------------------------------------------------------------
// Locked elements and verification
// ---------------------------------------------------------------------------

const UNITS = [
  'mg/dL', 'mmol/L', 'mmHg', 'mg', 'mcg', 'g', 'mL', 'L', '%', 'IU',
  'hours', 'hour', 'hrs', 'hr', 'minutes', 'minute', 'days', 'day',
];

export const MEDICINE_NAMES = [
  'aspirin', 'clopidogrel', 'ticagrelor', 'dipyridamole', 'warfarin',
  'apixaban', 'rivaroxaban', 'dabigatran', 'edoxaban', 'alteplase',
  'tenecteplase', 'heparin', 'enoxaparin', 'atorvastatin', 'rosuvastatin',
  'simvastatin', 'ezetimibe', 'metformin', 'insulin', 'amlodipine',
  'lisinopril', 'losartan', 'bisoprolol', 'furosemide', 'levetiracetam',
];

export interface LockedElements {
  /** Numbers as written, normalized only for spacing around the unit. */
  numbers: string[];
  /** Medicine names found, lowercase. */
  medicines: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract the elements a rewrite is not allowed to change. */
export function extractLockedElements(text: string): LockedElements {
  const unitPattern = UNITS.map(escapeRegExp).join('|');
  const numberPattern = new RegExp(`\\d+(?:[.,]\\d+)?\\s?(?:${unitPattern})?`, 'g');
  const rawNumbers = text.match(numberPattern) ?? [];
  const numbers = rawNumbers.map((match) => match.replace(/\s+/g, ' ').trim());
  const lower = text.toLowerCase();
  const medicines = MEDICINE_NAMES.filter((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`).test(lower),
  );
  return { numbers, medicines };
}

function multisetMissing(source: string[], other: string[]): string[] {
  const pool = [...other];
  const missing: string[] = [];
  for (const item of source) {
    const index = pool.indexOf(item);
    if (index === -1) missing.push(item);
    else pool.splice(index, 1);
  }
  return missing;
}

export interface VerificationResult {
  ok: boolean;
  missingNumbers: string[];
  addedNumbers: string[];
  missingMedicines: string[];
  addedMedicines: string[];
}

/**
 * Deterministic post-rewrite check: the multiset of numbers (with units)
 * and the set of medicine names must be identical between original and
 * rewrite. Any difference fails the check with the specifics listed.
 */
export function verifyPreserved(original: string, rewritten: string): VerificationResult {
  const before = extractLockedElements(original);
  const after = extractLockedElements(rewritten);
  const missingNumbers = multisetMissing(before.numbers, after.numbers);
  const addedNumbers = multisetMissing(after.numbers, before.numbers);
  const missingMedicines = before.medicines.filter((name) => !after.medicines.includes(name));
  const addedMedicines = after.medicines.filter((name) => !before.medicines.includes(name));
  return {
    ok:
      missingNumbers.length === 0 &&
      addedNumbers.length === 0 &&
      missingMedicines.length === 0 &&
      addedMedicines.length === 0,
    missingNumbers,
    addedNumbers,
    missingMedicines,
    addedMedicines,
  };
}

// ---------------------------------------------------------------------------
// Glossary based local rewrite
// ---------------------------------------------------------------------------

export type PlainTarget = 'en' | 'id';

export interface RewriteResult {
  text: string;
  replacedTerms: string[];
}

/**
 * Local plain-language pass: replace glossary terms with their everyday
 * wording, longest terms first so phrases win over single words. Numbers
 * and medicine names are never touched, so the result passes
 * verifyPreserved by construction.
 */
export function plainRewriteLocal(text: string, target: PlainTarget): RewriteResult {
  const entries = [...GLOSSARY].sort((a, b) => b.term.length - a.term.length);
  const replaced = new Set<string>();
  let output = text;
  for (const entry of entries) {
    const pattern = new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, 'gi');
    if (pattern.test(output)) {
      replaced.add(entry.term);
      const replacement = target === 'en' ? entry.plainEn : entry.plainId;
      output = output.replace(pattern, (match) =>
        match.charAt(0) === match.charAt(0).toUpperCase() && match.charAt(0) !== match.charAt(0).toLowerCase()
          ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
          : replacement,
      );
    }
  }
  return { text: output, replacedTerms: [...replaced].sort() };
}

export const SAMPLE_TEXTS: { id: string; label: string; text: string }[] = [
  {
    id: 'sample-discharge',
    label: 'Sample: discharge note',
    text: 'The patient was admitted with an ischemic stroke due to atrial fibrillation. A CT scan excluded hemorrhage. Aspirin 300 mg was given on day one, followed by antiplatelet therapy. Blood pressure was 168/94 mmHg and blood glucose was 190 mg/dL. Rehabilitation and physiotherapy were started, and follow-up was arranged in 14 days.',
  },
  {
    id: 'sample-plan',
    label: 'Sample: care plan',
    text: 'Secondary prevention: high-intensity statin therapy for cholesterol control, oral medication for hypertension, and monitoring of blood pressure twice daily. The patient has dysphagia and remains nil by mouth until speech therapy assessment. Prognosis depends on rehabilitation progress.',
  },
];
