import { describe, expect, it } from 'vitest';
import { TEST_PHRASES, recognitionLocale } from './phrases';

// P0 contract: this release of the speech analyzer is English only. The
// phrase list ships no Indonesian phrases, no phrase carries an
// Indonesian locale, and the speech recognition locale is never id-ID.

// Distinctive Indonesian words that must not appear in a phrase or its
// explanatory note. Matched as whole words so English text ("and",
// "diphthongs", "in English") cannot false-positive.
const INDONESIAN_WORDS =
  /\b(yang|dan|atau|dari|dengan|untuk|adalah|tidak|kami|kita|itu|ini|dalam|sebelum|sesudah|membeli|berangkat|sekolah|matahari|terdengar|melompat|burung|sayur|buah|pasar|halaman|cokelat|kalimat|belanja|bunyi|awalan|berimbuhan|rangkap|diftong|laju|bicara)\b/i;

describe('speech analyzer phrases (English only)', () => {
  it('ships at least one reading phrase', () => {
    expect(TEST_PHRASES.length).toBeGreaterThan(0);
  });

  it('gives every phrase an English phrase id', () => {
    for (const phrase of TEST_PHRASES) {
      expect(phrase.id).toMatch(/^en-/);
    }
  });

  it('contains no Indonesian text in any phrase or note', () => {
    const offenders: string[] = [];
    for (const phrase of TEST_PHRASES) {
      if (INDONESIAN_WORDS.test(phrase.text)) offenders.push(`${phrase.id} text: ${phrase.text}`);
      if (INDONESIAN_WORDS.test(phrase.note)) offenders.push(`${phrase.id} note: ${phrase.note}`);
    }
    expect(offenders).toEqual([]);
  });

  it('never exposes an id-ID recognition locale', () => {
    expect(recognitionLocale()).toBe('en-US');
    expect(recognitionLocale()).not.toBe('id-ID');
  });
});
