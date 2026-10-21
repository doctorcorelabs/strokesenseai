import { describe, expect, it } from 'vitest';
import {
  alignWords,
  analyzeReading,
  analyzeWaveform,
  compareToBaseline,
  computeTempo,
  countSyllables,
  normalizeWords,
} from './analysis';

describe('normalizeWords', () => {
  it('lowercases, strips punctuation, and splits on whitespace', () => {
    expect(normalizeWords('The Quick, brown FOX!')).toEqual(['the', 'quick', 'brown', 'fox']);
  });

  it('keeps Indonesian words intact', () => {
    expect(normalizeWords('Kucing itu melompat.')).toEqual(['kucing', 'itu', 'melompat']);
  });

  it('returns an empty list for empty input', () => {
    expect(normalizeWords('   ')).toEqual([]);
  });
});

describe('alignWords', () => {
  it('marks a perfect reading as fully correct with zero WER', () => {
    const result = alignWords('the cat sat', 'The cat sat.');
    expect(result.correctCount).toBe(3);
    expect(result.wer).toBe(0);
    expect(result.accuracy).toBe(1);
    expect(result.items.every((item) => item.status === 'correct')).toBe(true);
  });

  it('classifies a replaced word as a substitution', () => {
    const result = alignWords('the cat sat', 'the dog sat');
    expect(result.substitutions).toBe(1);
    expect(result.wer).toBeCloseTo(1 / 3);
    const replaced = result.items.find((item) => item.status === 'substituted');
    expect(replaced?.target).toBe('cat');
    expect(replaced?.heard).toBe('dog');
  });

  it('classifies a skipped word as missing', () => {
    const result = alignWords('the cat sat down', 'the cat sat');
    expect(result.deletions).toBe(1);
    expect(result.items[3].status).toBe('missing');
    expect(result.items[3].heard).toBeNull();
  });

  it('classifies an added word as extra', () => {
    const result = alignWords('the cat sat', 'the big cat sat');
    expect(result.insertions).toBe(1);
    const extra = result.items.find((item) => item.status === 'extra');
    expect(extra?.heard).toBe('big');
    expect(extra?.target).toBeNull();
  });

  it('combines error kinds in the WER', () => {
    const result = alignWords('one two three four', 'one too three');
    expect(result.substitutions).toBe(1);
    expect(result.deletions).toBe(1);
    expect(result.wer).toBeCloseTo(2 / 4);
  });

  it('handles an empty transcript as all deletions', () => {
    const result = alignWords('the cat sat', '');
    expect(result.deletions).toBe(3);
    expect(result.wer).toBe(1);
  });
});

describe('countSyllables', () => {
  it('counts vowel groups in English words', () => {
    expect(countSyllables('banana')).toBe(3);
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('beautiful')).toBe(3);
  });

  it('does not count a trailing silent e', () => {
    expect(countSyllables('cake')).toBe(1);
    expect(countSyllables('the')).toBe(1);
  });

  it('counts syllables in Indonesian words', () => {
    expect(countSyllables('makanan')).toBe(3);
    expect(countSyllables('sekolah')).toBe(3);
    expect(countSyllables('kucing')).toBe(2);
  });

  it('returns at least one for a word without vowels and zero for non-words', () => {
    expect(countSyllables('rhythm')).toBeGreaterThanOrEqual(1);
    expect(countSyllables('123')).toBe(0);
  });
});

describe('computeTempo', () => {
  it('computes words per minute and syllables per second', () => {
    const tempo = computeTempo('one two three four five six', 6);
    expect(tempo).not.toBeNull();
    expect(tempo?.wordsPerMinute).toBe(60);
    expect(tempo?.syllablesPerSecond).toBeGreaterThan(0);
  });

  it('returns null without a positive duration', () => {
    expect(computeTempo('hello world', 0)).toBeNull();
    expect(computeTempo('hello world', -3)).toBeNull();
  });
});

describe('analyzeWaveform', () => {
  it('returns null for empty input', () => {
    expect(analyzeWaveform(new Float32Array(0), 16000)).toBeNull();
  });

  it('reports pure silence as all pause', () => {
    const result = analyzeWaveform(new Float32Array(16000), 16000);
    expect(result?.pauseRatio).toBe(1);
    expect(result?.estimatedSyllableRate).toBe(0);
  });

  it('reports a continuous loud tone as almost no pause', () => {
    const samples = new Float32Array(16000).fill(0.5);
    const result = analyzeWaveform(samples, 16000);
    expect(result?.pauseRatio).toBeLessThan(0.05);
    expect(result?.durationSeconds).toBeCloseTo(1);
  });

  it('counts separated loud bursts as syllable-like peaks', () => {
    const sampleRate = 16000;
    const samples = new Float32Array(sampleRate);
    // Three 150 ms bursts at 0.1 s, 0.45 s, and 0.8 s.
    for (const start of [0.1, 0.45, 0.8]) {
      const from = Math.floor(start * sampleRate);
      const to = from + Math.floor(0.15 * sampleRate);
      for (let i = from; i < to; i += 1) samples[i] = 0.6;
    }
    const result = analyzeWaveform(samples, sampleRate);
    expect(result?.estimatedSyllableRate).toBeGreaterThanOrEqual(2);
    expect(result?.pauseRatio).toBeGreaterThan(0.3);
  });
});

describe('analyzeReading and compareToBaseline', () => {
  it('bundles alignment and tempo', () => {
    const reading = analyzeReading('the cat sat', 'the cat sat', 2);
    expect(reading.alignment.wer).toBe(0);
    expect(reading.tempo?.wordsPerMinute).toBe(90);
    expect(reading.waveform).toBeNull();
  });

  it('compares a new reading with the user baseline only', () => {
    const baseline = analyzeReading('the cat sat down', 'the cat sat down', 4);
    const current = analyzeReading('the cat sat down', 'the dog sat down', 2);
    const comparison = compareToBaseline(current, baseline);
    expect(comparison.werDelta).toBeCloseTo(0.25);
    expect(comparison.wordsPerMinuteDelta).toBe(60);
    expect(comparison.summary).toContain('your own baseline');
  });
});
