import { describe, expect, it } from 'vitest';
import { QUESTION_BANK, TOPICS } from './question-bank';
import type { TutorQuestion } from './question-bank';
import type { TutorProgress } from './tutor-logic';
import {
  PROGRESS_STORAGE_KEY,
  createProgress,
  loadProgress,
  pickNextQuestion,
  recordAnswer,
  resetProgress,
  saveProgress,
  summarizeProgress,
} from './tutor-logic';

function question(id: string): TutorQuestion {
  const found = QUESTION_BANK.find((entry) => entry.id === id);
  if (!found) throw new Error(`unknown question ${id}`);
  return found;
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    dump: () => values.get(PROGRESS_STORAGE_KEY),
  };
}

describe('question bank integrity', () => {
  it('covers every topic at every difficulty with valid answers', () => {
    for (const topic of TOPICS) {
      for (const difficulty of [1, 2, 3] as const) {
        const inCell = QUESTION_BANK.filter(
          (entry) => entry.topic === topic && entry.difficulty === difficulty,
        );
        expect(inCell.length).toBeGreaterThanOrEqual(2);
      }
    }
    for (const entry of QUESTION_BANK) {
      expect(entry.options).toHaveLength(4);
      expect(entry.answerIndex).toBeGreaterThanOrEqual(0);
      expect(entry.answerIndex).toBeLessThan(entry.options.length);
      expect(entry.explanation.length).toBeGreaterThan(20);
    }
    const ids = QUESTION_BANK.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('recordAnswer', () => {
  it('tracks per-topic and total counts', () => {
    let progress = createProgress();
    progress = recordAnswer(progress, question('fast-1-1'), true);
    progress = recordAnswer(progress, question('fast-1-2'), false);
    expect(progress.totalAnswered).toBe(2);
    expect(progress.totalCorrect).toBe(1);
    expect(progress.topics.fast).toEqual({ asked: 2, correct: 1 });
    expect(progress.seenIds).toEqual(['fast-1-1', 'fast-1-2']);
    expect(progress.missedIds).toEqual(['fast-1-2']);
  });

  it('clears a missed question once it is answered correctly', () => {
    let progress = recordAnswer(createProgress(), question('risk-1-1'), false);
    expect(progress.missedIds).toContain('risk-1-1');
    progress = recordAnswer(progress, question('risk-1-1'), true);
    expect(progress.missedIds).not.toContain('risk-1-1');
  });

  it('levels up after a strong window and resets the window', () => {
    let progress = createProgress();
    progress = recordAnswer(progress, question('fast-1-1'), true);
    progress = recordAnswer(progress, question('nihss-1-1'), true);
    progress = recordAnswer(progress, question('risk-1-1'), false);
    expect(progress.level).toBe(1);
    progress = recordAnswer(progress, question('vascular-1-1'), true);
    // Window is [true, true, false, true]: 3 of 4 correct moves up.
    expect(progress.level).toBe(2);
    expect(progress.recentResults).toEqual([]);
  });

  it('levels down after a weak window but never below 1', () => {
    let progress: TutorProgress = { ...createProgress(), level: 2 };
    progress = recordAnswer(progress, question('fast-2-1'), false);
    progress = recordAnswer(progress, question('fast-2-2'), false);
    progress = recordAnswer(progress, question('nihss-2-1'), true);
    progress = recordAnswer(progress, question('nihss-2-2'), false);
    // Window is [false, false, true, false]: 1 of 4 correct moves down.
    expect(progress.level).toBe(1);
    progress = recordAnswer(progress, question('risk-1-1'), false);
    progress = recordAnswer(progress, question('risk-1-2'), false);
    progress = recordAnswer(progress, question('vascular-1-1'), false);
    expect(progress.level).toBe(1);
  });

  it('does not level up on a short window', () => {
    let progress = createProgress();
    progress = recordAnswer(progress, question('fast-1-1'), true);
    progress = recordAnswer(progress, question('fast-1-2'), true);
    expect(progress.level).toBe(1);
  });
});

describe('pickNextQuestion', () => {
  it('starts at level 1 and returns an unseen question', () => {
    const next = pickNextQuestion(createProgress(), QUESTION_BANK, () => 0);
    expect(next?.difficulty).toBe(1);
  });

  it('favours the weakest topic at the current level', () => {
    let progress = createProgress();
    // Vascular accuracy is 0 (from level 2 attempts) while FAST is perfect,
    // so the level 1 pick should come from vascular, which still has
    // unseen questions at this level.
    progress = recordAnswer(progress, question('vascular-2-1'), false);
    progress = recordAnswer(progress, question('vascular-2-2'), false);
    progress = recordAnswer(progress, question('fast-1-1'), true);
    const next = pickNextQuestion(progress, QUESTION_BANK, () => 0);
    expect(next?.topic).toBe('vascular');
    expect(next?.difficulty).toBe(1);
  });

  it('falls back to the nearest level when the current level is exhausted', () => {
    const levelOneIds = QUESTION_BANK.filter((q) => q.difficulty === 1).map((q) => q.id);
    const progress = { ...createProgress(), seenIds: levelOneIds };
    const next = pickNextQuestion(progress, QUESTION_BANK, () => 0);
    expect(next?.difficulty).toBe(2);
  });

  it('retries missed questions once everything was seen', () => {
    const allIds = QUESTION_BANK.map((q) => q.id);
    const progress = { ...createProgress(), seenIds: allIds, missedIds: ['risk-3-2'] };
    const next = pickNextQuestion(progress, QUESTION_BANK, () => 0);
    expect(next?.id).toBe('risk-3-2');
  });

  it('returns null when the bank is finished and nothing is missed', () => {
    const allIds = QUESTION_BANK.map((q) => q.id);
    const progress = { ...createProgress(), seenIds: allIds };
    expect(pickNextQuestion(progress, QUESTION_BANK, () => 0)).toBeNull();
  });
});

describe('summarizeProgress', () => {
  it('names the weakest topic once it has enough answers', () => {
    let progress = createProgress();
    progress = recordAnswer(progress, question('vascular-1-1'), false);
    progress = recordAnswer(progress, question('vascular-1-2'), false);
    progress = recordAnswer(progress, question('fast-1-1'), true);
    progress = recordAnswer(progress, question('fast-1-2'), true);
    const summary = summarizeProgress(progress);
    expect(summary.weakestTopic).toBe('vascular');
    expect(summary.recommendation).toContain('Vascular anatomy');
    expect(summary.accuracy).toBe(0.5);
  });

  it('handles an untouched progress record', () => {
    const summary = summarizeProgress(createProgress());
    expect(summary.accuracy).toBeNull();
    expect(summary.weakestTopic).toBeNull();
    expect(summary.recommendation).toContain('No answers yet');
  });
});

describe('persistence', () => {
  it('round-trips through storage and resets cleanly', () => {
    const storage = memoryStorage();
    let progress = recordAnswer(createProgress(), question('fast-1-1'), true);
    saveProgress(progress, storage);
    expect(storage.dump()).toContain('fast-1-1');
    const loaded = loadProgress(storage);
    expect(loaded).toEqual(progress);
    progress = resetProgress(storage);
    expect(progress.totalAnswered).toBe(0);
    expect(loadProgress(storage).totalAnswered).toBe(0);
  });

  it('falls back to a fresh record on corrupt stored data', () => {
    const storage = memoryStorage();
    storage.setItem(PROGRESS_STORAGE_KEY, '{"version":99}');
    expect(loadProgress(storage).version).toBe(1);
    storage.setItem(PROGRESS_STORAGE_KEY, 'not json');
    expect(loadProgress(storage).totalAnswered).toBe(0);
  });
});
