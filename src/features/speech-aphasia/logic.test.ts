import { describe, expect, it } from 'vitest';
import { NAMING_ITEMS } from './content';
import type { NamingItem } from './content';
import {
  buildSentence,
  firstSoundCue,
  judgeNamingAnswer,
  levenshtein,
  multipleChoiceOptions,
  nextCueLevel,
  nextComprehensionStage,
  scoreNamingAttempt,
  scoreSequenceSelection,
  scoreYesNo,
  suggestExpansions,
  summarizeComprehension,
  summarizeNamingSession,
} from './logic';
import type { ComprehensionRecord, NamingAttemptRecord } from './logic';

function item(id: string): NamingItem {
  const found = NAMING_ITEMS.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing test item ${id}`);
  return found;
}

describe('levenshtein and normalization through judging', () => {
  it('computes basic edit distances', () => {
    expect(levenshtein('apple', 'apple')).toBe(0);
    expect(levenshtein('apple', 'apples')).toBe(1);
    expect(levenshtein('', 'dog')).toBe(3);
    expect(levenshtein('cat', 'dog')).toBe(3);
  });
});

describe('judgeNamingAnswer', () => {
  it('accepts an exact answer regardless of case and punctuation', () => {
    expect(judgeNamingAnswer(item('apple'), ' Apple! ').band).toBe('correct');
  });

  it('accepts the target as the head word of a longer answer', () => {
    expect(judgeNamingAnswer(item('dog'), 'it is a dog').band).toBe('correct');
  });

  it('marks a curated semantic relative as a close semantic answer', () => {
    const judgement = judgeNamingAnswer(item('apple'), 'orange');
    expect(judgement.band).toBe('close');
    expect(judgement.errorKind).toBe('semantic');
  });

  it('marks a sound alike answer as a close phonemic answer', () => {
    const judgement = judgeNamingAnswer(item('cup'), 'cap');
    expect(judgement.band).toBe('close');
    expect(judgement.errorKind).toBe('phonemic');
  });

  it('marks a long description as circumlocution', () => {
    const judgement = judgeNamingAnswer(item('cup'), 'the thing you drink tea from');
    expect(judgement.band).toBe('miss');
    expect(judgement.errorKind).toBe('circumlocution');
  });

  it('marks an unrelated single word as a miss', () => {
    const judgement = judgeNamingAnswer(item('apple'), 'bicycle');
    expect(judgement.band).toBe('miss');
    expect(judgement.errorKind).toBe('unrelated');
  });

  it('marks an empty answer as no response', () => {
    const judgement = judgeNamingAnswer(item('apple'), '   ');
    expect(judgement.band).toBe('no-response');
    expect(judgement.errorKind).toBe('no-response');
  });
});

describe('cue ladder', () => {
  it('advances one step at a time and stops at multiple choice', () => {
    expect(nextCueLevel(0)).toBe(1);
    expect(nextCueLevel(1)).toBe(2);
    expect(nextCueLevel(2)).toBe(3);
    expect(nextCueLevel(3)).toBe(3);
  });

  it('builds a first sound cue with a letter skeleton', () => {
    expect(firstSoundCue('apple')).toEqual({ letter: 'A', skeleton: 'a _ _ _ _' });
    expect(firstSoundCue('key').skeleton).toBe('k _ _');
  });

  it('offers four deterministic options including the target', () => {
    const options = multipleChoiceOptions(item('dog'), NAMING_ITEMS);
    expect(options).toHaveLength(4);
    expect(options).toContain('dog');
    expect(new Set(options).size).toBe(4);
    expect(multipleChoiceOptions(item('dog'), NAMING_ITEMS)).toEqual(options);
  });
});

describe('scoreNamingAttempt', () => {
  it('rewards unaided correct answers most and never drops below 1 with cues', () => {
    expect(scoreNamingAttempt('correct', 0)).toBe(3);
    expect(scoreNamingAttempt('correct', 1)).toBe(2);
    expect(scoreNamingAttempt('correct', 2)).toBe(1);
    expect(scoreNamingAttempt('correct', 3)).toBe(1);
  });

  it('gives partial credit only for unaided close answers', () => {
    expect(scoreNamingAttempt('close', 0)).toBe(1);
    expect(scoreNamingAttempt('close', 1)).toBe(0);
    expect(scoreNamingAttempt('miss', 0)).toBe(0);
    expect(scoreNamingAttempt('no-response', 0)).toBe(0);
  });
});

describe('summarizeNamingSession', () => {
  it('aggregates bands, points, and cued correct answers', () => {
    const records: NamingAttemptRecord[] = [
      { itemId: 'apple', word: 'apple', level: 1, answer: 'apple', band: 'correct', errorKind: 'none', cuesUsed: 0, points: 3 },
      { itemId: 'cup', word: 'cup', level: 1, answer: 'cap', band: 'close', errorKind: 'phonemic', cuesUsed: 0, points: 1 },
      { itemId: 'dog', word: 'dog', level: 1, answer: 'dog', band: 'correct', errorKind: 'none', cuesUsed: 2, points: 1 },
      { itemId: 'key', word: 'key', level: 1, answer: 'spoon', band: 'miss', errorKind: 'unrelated', cuesUsed: 1, points: 0 },
    ];
    const summary = summarizeNamingSession(records);
    expect(summary.attempts).toBe(4);
    expect(summary.correct).toBe(2);
    expect(summary.close).toBe(1);
    expect(summary.missed).toBe(1);
    expect(summary.points).toBe(5);
    expect(summary.maxPoints).toBe(12);
    expect(summary.percent).toBe(42);
    expect(summary.cuedCorrect).toBe(1);
  });

  it('handles an empty session', () => {
    const summary = summarizeNamingSession([]);
    expect(summary.attempts).toBe(0);
    expect(summary.percent).toBe(0);
  });
});

describe('buildSentence and suggestExpansions', () => {
  it('joins tokens in tap order with capitalization and a full stop', () => {
    expect(
      buildSentence([
        { label: 'I', kind: 'person' },
        { label: 'want', kind: 'action' },
        { label: 'water', kind: 'thing' },
      ]),
    ).toBe('I want water.');
    expect(buildSentence([])).toBe('');
  });

  it('suggests inserting want or need after a person when no action is present', () => {
    const suggestions = suggestExpansions([
      { label: 'I', kind: 'person' },
      { label: 'water', kind: 'thing' },
    ]);
    expect(suggestions).toEqual(['I want water.', 'I need water.']);
  });

  it('suggests a full sentence for a single thing token', () => {
    expect(suggestExpansions([{ label: 'phone', kind: 'thing' }])).toEqual([
      'I want phone.',
      'I need phone.',
    ]);
  });

  it('suggests nothing once an action word is already present', () => {
    expect(
      suggestExpansions([
        { label: 'I', kind: 'person' },
        { label: 'want', kind: 'action' },
        { label: 'water', kind: 'thing' },
      ]),
    ).toEqual([]);
  });
});

describe('comprehension scoring', () => {
  it('scores one step selections', () => {
    expect(scoreSequenceSelection(['apple'], ['apple'])).toEqual({
      correct: true,
      points: 1,
      maxPoints: 1,
      rightObjectsWrongOrder: false,
    });
    expect(scoreSequenceSelection(['apple'], ['key']).correct).toBe(false);
  });

  it('scores two step order exactly and flags right objects in wrong order', () => {
    expect(scoreSequenceSelection(['cup', 'book'], ['cup', 'book'])).toEqual({
      correct: true,
      points: 2,
      maxPoints: 2,
      rightObjectsWrongOrder: false,
    });
    const reversed = scoreSequenceSelection(['cup', 'book'], ['book', 'cup']);
    expect(reversed.correct).toBe(false);
    expect(reversed.points).toBe(0);
    expect(reversed.rightObjectsWrongOrder).toBe(true);
    expect(scoreSequenceSelection(['cup', 'book'], ['cup', 'key']).points).toBe(1);
  });

  it('scores yes or no answers', () => {
    expect(scoreYesNo(true, true)).toEqual({ correct: true, points: 1 });
    expect(scoreYesNo(true, false)).toEqual({ correct: false, points: 0 });
  });

  it('walks the fixed stage order and stops at summary', () => {
    expect(nextComprehensionStage('setup')).toBe('one-step');
    expect(nextComprehensionStage('one-step')).toBe('two-step');
    expect(nextComprehensionStage('two-step')).toBe('yes-no');
    expect(nextComprehensionStage('yes-no')).toBe('summary');
    expect(nextComprehensionStage('summary')).toBe('summary');
  });

  it('summarizes by kind with average response times', () => {
    const records: ComprehensionRecord[] = [
      { itemId: 'one-1', kind: 'one-step', correct: true, points: 1, maxPoints: 1, responseMs: 1000 },
      { itemId: 'one-2', kind: 'one-step', correct: false, points: 0, maxPoints: 1, responseMs: 3000 },
      { itemId: 'two-1', kind: 'two-step', correct: false, points: 1, maxPoints: 2, responseMs: 5000 },
      { itemId: 'q1', kind: 'yes-no', correct: true, points: 1, maxPoints: 1, responseMs: 2000 },
    ];
    const summary = summarizeComprehension(records);
    expect(summary.totalItems).toBe(4);
    expect(summary.totalCorrect).toBe(2);
    expect(summary.points).toBe(3);
    expect(summary.maxPoints).toBe(5);
    const oneStep = summary.byKind.find((row) => row.kind === 'one-step');
    expect(oneStep?.averageResponseMs).toBe(2000);
    expect(oneStep?.correct).toBe(1);
  });
});
