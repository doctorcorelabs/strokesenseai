import { describe, expect, it } from 'vitest';
import { liveWordMap, paceSentence, paceZone } from './speechLabLogic';

describe('paceZone', () => {
  it('classifies slow, steady, and fast reading pace', () => {
    expect(paceZone(60)).toBe('slow');
    expect(paceZone(89)).toBe('slow');
    expect(paceZone(90)).toBe('steady');
    expect(paceZone(130)).toBe('steady');
    expect(paceZone(170)).toBe('steady');
    expect(paceZone(171)).toBe('fast');
    expect(paceZone(240)).toBe('fast');
  });

  it('returns null for unknown pace instead of inventing a zone', () => {
    expect(paceZone(0)).toBeNull();
    expect(paceZone(-10)).toBeNull();
    expect(paceZone(Number.NaN)).toBeNull();
    expect(paceZone(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('names the zone in one plain sentence without numbers', () => {
    expect(paceSentence('steady')).toBe('Your pace stayed in the steady zone.');
    expect(paceSentence('slow')).not.toMatch(/\d/);
  });
});

describe('liveWordMap', () => {
  const target = 'The quick brown fox jumps over the lazy dog';

  it('marks every word upcoming before anything is heard', () => {
    const map = liveWordMap(target, '');
    expect(map.words).toHaveLength(9);
    expect(map.words.every((word) => word.state === 'upcoming')).toBe(true);
    expect(map.extraWords).toEqual([]);
  });

  it('lights matched words and leaves the rest upcoming mid-sentence', () => {
    const map = liveWordMap(target, 'The quick brown');
    expect(map.words.map((word) => word.state)).toEqual([
      'matched',
      'matched',
      'matched',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('reports a different heard word with the word that was heard', () => {
    const map = liveWordMap(target, 'The quick brown box jumps');
    const fox = map.words[3];
    expect(fox.word).toBe('fox');
    expect(fox.state).toBe('different');
    expect(fox.heard).toBe('box');
    expect(map.words[4].state).toBe('matched');
  });

  it('marks a word skipped only once a later word has been heard', () => {
    const map = liveWordMap(target, 'The quick fox jumps');
    const brown = map.words[2];
    expect(brown.word).toBe('brown');
    expect(brown.state).toBe('skipped');
    // Words after the last heard word stay upcoming, not skipped.
    expect(map.words[8].state).toBe('upcoming');
  });

  it('collects extra heard words separately from the target words', () => {
    const map = liveWordMap(target, 'The quick brown fox jumps over the lazy dog today');
    expect(map.words.every((word) => word.state === 'matched')).toBe(true);
    expect(map.extraWords).toEqual(['today']);
  });
});
