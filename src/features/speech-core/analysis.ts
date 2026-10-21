// Pure analysis logic for the speech tools.
//
// Everything here is deterministic: given the known target sentence, a
// transcript, and a recording duration, the same numbers always come out.
// No function in this file talks to a model, and no output is a clinical
// score. The numbers describe how a machine transcript matched a known
// sentence, and how the reading was paced.

// ---------------------------------------------------------------------------
// Word normalisation and alignment
// ---------------------------------------------------------------------------

/** Split text into comparable words: lowercase, punctuation removed. */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/['-]/g, '')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

export type WordStatus = 'correct' | 'substituted' | 'missing' | 'extra';

export interface AlignedWord {
  /** Word from the target sentence, or null for an inserted word. */
  target: string | null;
  /** Word heard in the transcript, or null when the target word is missing. */
  heard: string | null;
  status: WordStatus;
}

export interface AlignmentResult {
  items: AlignedWord[];
  targetWordCount: number;
  heardWordCount: number;
  correctCount: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  /** Word error rate: (substitutions + deletions + insertions) / target words. */
  wer: number;
  /** Share of target words reproduced exactly, between 0 and 1. */
  accuracy: number;
}

/**
 * Align a transcript to the target sentence with a word-level edit
 * distance (dynamic programming) and classify every word. Ties in the
 * backtrace prefer substitution over a delete plus insert pair, which
 * matches how a reader experiences a replaced word.
 */
export function alignWords(targetText: string, heardText: string): AlignmentResult {
  const target = normalizeWords(targetText);
  const heard = normalizeWords(heardText);
  const rows = target.length + 1;
  const cols = heard.length + 1;
  const cost: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j += 1) cost[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = target[i - 1] === heard[j - 1] ? 0 : 1;
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + substitutionCost,
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
    }
  }

  const items: AlignedWord[] = [];
  let i = target.length;
  let j = heard.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const substitutionCost = target[i - 1] === heard[j - 1] ? 0 : 1;
      if (cost[i][j] === cost[i - 1][j - 1] + substitutionCost) {
        items.push({
          target: target[i - 1],
          heard: heard[j - 1],
          status: substitutionCost === 0 ? 'correct' : 'substituted',
        });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      items.push({ target: target[i - 1], heard: null, status: 'missing' });
      i -= 1;
      continue;
    }
    items.push({ target: null, heard: heard[j - 1], status: 'extra' });
    j -= 1;
  }
  items.reverse();

  const correctCount = items.filter((item) => item.status === 'correct').length;
  const substitutions = items.filter((item) => item.status === 'substituted').length;
  const deletions = items.filter((item) => item.status === 'missing').length;
  const insertions = items.filter((item) => item.status === 'extra').length;
  const errors = substitutions + deletions + insertions;
  return {
    items,
    targetWordCount: target.length,
    heardWordCount: heard.length,
    correctCount,
    substitutions,
    deletions,
    insertions,
    wer: target.length === 0 ? 0 : errors / target.length,
    accuracy: target.length === 0 ? 0 : correctCount / target.length,
  };
}

// ---------------------------------------------------------------------------
// Tempo metrics
// ---------------------------------------------------------------------------

const VOWELS = 'aeiouàáâäèéêëìíîïòóôöùúûü';

/** Rough syllable estimate: count vowel groups, at least one per word. */
export function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-zà-öù-ÿ]/g, '');
  if (!clean) return 0;
  let groups = 0;
  let inVowelRun = false;
  for (const char of clean) {
    const isVowel = VOWELS.includes(char);
    if (isVowel && !inVowelRun) groups += 1;
    inVowelRun = isVowel;
  }
  // A trailing silent e in English adds no syllable.
  if (clean.length > 2 && clean.endsWith('e') && !VOWELS.includes(clean[clean.length - 2])) {
    groups = Math.max(1, groups - 1);
  }
  return Math.max(1, groups);
}

export interface TempoMetrics {
  durationSeconds: number;
  heardWordCount: number;
  /** Words spoken per minute, from the heard transcript and duration. */
  wordsPerMinute: number;
  /** Estimated syllables per second, from the heard transcript. */
  syllablesPerSecond: number;
}

/** Tempo of a reading, derived only from the transcript and the clock. */
export function computeTempo(
  heardText: string,
  durationSeconds: number,
): TempoMetrics | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const words = normalizeWords(heardText);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  return {
    durationSeconds,
    heardWordCount: words.length,
    wordsPerMinute: Math.round((words.length / durationSeconds) * 60),
    syllablesPerSecond: Math.round((syllables / durationSeconds) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Waveform metrics (descriptive acoustics from raw samples)
// ---------------------------------------------------------------------------

export interface WaveformMetrics {
  durationSeconds: number;
  /** Share of the recording that sits near silence, between 0 and 1. */
  pauseRatio: number;
  /** How uneven the loudness is across voiced windows (coefficient of variation). */
  intensityVariability: number;
  /** Rough count of syllable-like loudness peaks per second. */
  estimatedSyllableRate: number;
}

const WINDOW_MS = 20;
const MIN_PEAK_GAP_MS = 130;

/**
 * Descriptive acoustics from decoded audio samples. Windows of 20 ms are
 * classified as voiced or quiet against a threshold tied to the recording's
 * own peak, so the numbers describe this recording only. Nothing here is
 * compared with any population norm.
 */
export function analyzeWaveform(samples: Float32Array, sampleRate: number): WaveformMetrics | null {
  if (samples.length === 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) return null;
  const windowSize = Math.max(1, Math.floor((sampleRate * WINDOW_MS) / 1000));
  const windowCount = Math.floor(samples.length / windowSize);
  if (windowCount === 0) return null;

  const rms: number[] = [];
  let peak = 0;
  for (let w = 0; w < windowCount; w += 1) {
    let sumSquares = 0;
    for (let s = 0; s < windowSize; s += 1) {
      const value = samples[w * windowSize + s];
      sumSquares += value * value;
    }
    const value = Math.sqrt(sumSquares / windowSize);
    rms.push(value);
    if (value > peak) peak = value;
  }
  if (peak === 0) {
    return {
      durationSeconds: samples.length / sampleRate,
      pauseRatio: 1,
      intensityVariability: 0,
      estimatedSyllableRate: 0,
    };
  }

  const threshold = Math.max(0.015, peak * 0.12);
  const voiced = rms.filter((value) => value >= threshold);
  const pauseRatio = (windowCount - voiced.length) / windowCount;

  const mean = voiced.reduce((sum, value) => sum + value, 0) / Math.max(1, voiced.length);
  const variance =
    voiced.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) /
    Math.max(1, voiced.length);
  const intensityVariability = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0;

  // Syllable nuclei estimate: local loudness peaks above the threshold,
  // separated by a minimum gap so one long vowel counts once.
  const minGapWindows = Math.max(1, Math.round(MIN_PEAK_GAP_MS / WINDOW_MS));
  let peaks = 0;
  let lastPeak = -minGapWindows;
  for (let w = 1; w < windowCount - 1; w += 1) {
    if (
      rms[w] >= threshold &&
      rms[w] >= rms[w - 1] &&
      rms[w] > rms[w + 1] &&
      w - lastPeak >= minGapWindows
    ) {
      peaks += 1;
      lastPeak = w;
    }
  }
  const durationSeconds = samples.length / sampleRate;
  return {
    durationSeconds,
    pauseRatio: Math.round(pauseRatio * 100) / 100,
    intensityVariability,
    estimatedSyllableRate: Math.round((peaks / durationSeconds) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Reading analysis and baseline comparison
// ---------------------------------------------------------------------------

export interface ReadingAnalysis {
  alignment: AlignmentResult;
  tempo: TempoMetrics | null;
  waveform: WaveformMetrics | null;
}

/** Full deterministic analysis of one reading attempt. */
export function analyzeReading(
  targetText: string,
  heardText: string,
  durationSeconds: number,
  waveform: WaveformMetrics | null = null,
): ReadingAnalysis {
  return {
    alignment: alignWords(targetText, heardText),
    tempo: computeTempo(heardText, durationSeconds),
    waveform,
  };
}

export interface AnalysisComparison {
  werDelta: number;
  wordsPerMinuteDelta: number | null;
  pauseRatioDelta: number | null;
  summary: string;
}

function signed(value: number, digits = 0): string {
  const rounded = value.toFixed(digits);
  return value > 0 ? `+${rounded}` : rounded;
}

/**
 * Compare a new reading with the user's own earlier baseline recording.
 * The comparison is always against the user's own baseline, never against
 * native speaker norms, so accent differences are not treated as errors.
 */
export function compareToBaseline(
  current: ReadingAnalysis,
  baseline: ReadingAnalysis,
): AnalysisComparison {
  const werDelta = Math.round((current.alignment.wer - baseline.alignment.wer) * 100) / 100;
  const wordsPerMinuteDelta =
    current.tempo && baseline.tempo
      ? current.tempo.wordsPerMinute - baseline.tempo.wordsPerMinute
      : null;
  const pauseRatioDelta =
    current.waveform && baseline.waveform
      ? Math.round((current.waveform.pauseRatio - baseline.waveform.pauseRatio) * 100) / 100
      : null;

  const parts = [`word error rate ${signed(werDelta * 100)} points versus your baseline`];
  if (wordsPerMinuteDelta !== null) {
    parts.push(`pace ${signed(wordsPerMinuteDelta)} words per minute`);
  }
  if (pauseRatioDelta !== null) {
    parts.push(`pause share ${signed(pauseRatioDelta * 100)} points`);
  }
  return {
    werDelta,
    wordsPerMinuteDelta,
    pauseRatioDelta,
    summary: `Compared with your own baseline recording: ${parts.join('; ')}.`,
  };
}
