// Pure adaptive logic for the Adaptive AI Tutor.
//
// The adaptation is deliberately simple, deterministic, and explainable:
// there is no hidden profile and no server state. Difficulty moves after a
// short rolling window of recent answers, the next question prefers the
// learner's weakest topic at the current level, and missed questions come
// back once the unseen bank is exhausted. Progress is persisted by the UI
// in this browser's localStorage only; it never leaves the device.

import type { Difficulty, TutorQuestion, TutorTopic } from './question-bank';
import { QUESTION_BANK, TOPIC_LABELS, TOPICS } from './question-bank';

export interface TopicProgress {
  asked: number;
  correct: number;
}

export interface TutorProgress {
  version: 1;
  level: Difficulty;
  /** Results of the most recent answers at the current level, newest last. */
  recentResults: boolean[];
  topics: Record<TutorTopic, TopicProgress>;
  /** Ids of questions already answered in this bank cycle. */
  seenIds: string[];
  /** Ids answered incorrectly and not yet answered correctly since. */
  missedIds: string[];
  totalAnswered: number;
  totalCorrect: number;
}

export const PROGRESS_STORAGE_KEY = 'strokesenseai.adaptive-tutor.v1';

const WINDOW = 4;
const WINDOW_MIN = 3;

export function createProgress(): TutorProgress {
  const topics = {} as Record<TutorTopic, TopicProgress>;
  for (const topic of TOPICS) topics[topic] = { asked: 0, correct: 0 };
  return {
    version: 1,
    level: 1,
    recentResults: [],
    topics,
    seenIds: [],
    missedIds: [],
    totalAnswered: 0,
    totalCorrect: 0,
  };
}

function clampLevel(level: number): Difficulty {
  if (level <= 1) return 1;
  if (level >= 3) return 3;
  return 2;
}

/**
 * Record one answer and adapt the level. Level changes need a window of
 * recent answers at the current level: mostly correct moves up, mostly
 * wrong moves down, and the window resets on a change so the level cannot
 * oscillate on a single answer either way.
 */
export function recordAnswer(
  progress: TutorProgress,
  question: TutorQuestion,
  correct: boolean,
): TutorProgress {
  const topics = { ...progress.topics };
  const topicStats = topics[question.topic] ?? { asked: 0, correct: 0 };
  topics[question.topic] = {
    asked: topicStats.asked + 1,
    correct: topicStats.correct + (correct ? 1 : 0),
  };

  const seenIds = progress.seenIds.includes(question.id)
    ? progress.seenIds
    : [...progress.seenIds, question.id];
  const missedIds = correct
    ? progress.missedIds.filter((id) => id !== question.id)
    : progress.missedIds.includes(question.id)
      ? progress.missedIds
      : [...progress.missedIds, question.id];

  let level = progress.level;
  let recentResults = [...progress.recentResults, correct].slice(-WINDOW);
  if (recentResults.length >= WINDOW_MIN) {
    const correctInWindow = recentResults.filter(Boolean).length;
    if (correctInWindow >= 3 && level < 3) {
      level = clampLevel(level + 1);
      recentResults = [];
    } else if (correctInWindow <= 1 && level > 1) {
      level = clampLevel(level - 1);
      recentResults = [];
    }
  }

  return {
    ...progress,
    level,
    recentResults,
    topics,
    seenIds,
    missedIds,
    totalAnswered: progress.totalAnswered + 1,
    totalCorrect: progress.totalCorrect + (correct ? 1 : 0),
  };
}

function topicAccuracy(progress: TutorProgress, topic: TutorTopic): number | null {
  const stats = progress.topics[topic];
  if (!stats || stats.asked === 0) return null;
  return stats.correct / stats.asked;
}

/**
 * Choose the next question. Preference order: unseen questions at the
 * current level in the weakest topic; then unseen questions at the nearest
 * other level; then missed questions (retry); then null, meaning the bank
 * is finished for now. `random` is injectable for deterministic tests.
 */
export function pickNextQuestion(
  progress: TutorProgress,
  bank: TutorQuestion[] = QUESTION_BANK,
  random: () => number = Math.random,
): TutorQuestion | null {
  const unseen = bank.filter((question) => !progress.seenIds.includes(question.id));
  const pool = unseen.length > 0 ? unseen : bank.filter((q) => progress.missedIds.includes(q.id));
  if (pool.length === 0) return null;

  const levelsByDistance = ([1, 2, 3] as Difficulty[])
    .filter((level) => pool.some((question) => question.difficulty === level))
    .sort((a, b) => Math.abs(a - progress.level) - Math.abs(b - progress.level));
  const levelPool = pool.filter((question) => question.difficulty === levelsByDistance[0]);

  // Weakest topic first; topics never tried count as neutral (0.5) so new
  // ground is explored before topics the learner already aces.
  const topicsPresent = TOPICS.filter((topic) => levelPool.some((q) => q.topic === topic));
  const weakest = topicsPresent.reduce((best, topic) => {
    const accuracy = topicAccuracy(progress, topic) ?? 0.5;
    const bestAccuracy = topicAccuracy(progress, best) ?? 0.5;
    return accuracy < bestAccuracy ? topic : best;
  }, topicsPresent[0] as TutorTopic);
  const topicPool = levelPool.filter((question) => question.topic === weakest);

  const index = Math.min(topicPool.length - 1, Math.floor(random() * topicPool.length));
  return topicPool[index] ?? null;
}

export interface TopicSummary {
  topic: TutorTopic;
  label: string;
  asked: number;
  correct: number;
  /** Null when the topic has not been tried yet. */
  accuracy: number | null;
}

export interface TutorSummary {
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number | null;
  level: Difficulty;
  perTopic: TopicSummary[];
  weakestTopic: TutorTopic | null;
  recommendation: string;
}

/** Summarize progress and name the next practice focus in plain language. */
export function summarizeProgress(progress: TutorProgress): TutorSummary {
  const perTopic: TopicSummary[] = TOPICS.map((topic) => {
    const stats = progress.topics[topic] ?? { asked: 0, correct: 0 };
    return {
      topic,
      label: TOPIC_LABELS[topic],
      asked: stats.asked,
      correct: stats.correct,
      accuracy: stats.asked > 0 ? stats.correct / stats.asked : null,
    };
  });

  const tried = perTopic.filter((entry) => entry.asked >= 2 && entry.accuracy !== null);
  const weakest = tried.length
    ? tried.reduce((a, b) => ((a.accuracy ?? 1) <= (b.accuracy ?? 1) ? a : b))
    : null;

  let recommendation: string;
  if (progress.totalAnswered === 0) {
    recommendation =
      'No answers yet. Start anywhere: the tutor begins at Level 1 and adjusts as you answer.';
  } else if (weakest) {
    recommendation =
      `Your weakest area so far is ${weakest.label} ` +
      `(${weakest.correct} of ${weakest.asked} correct). The tutor will favour that topic next.`;
  } else {
    recommendation =
      'Keep answering across topics. Once a topic has a few answers, the tutor can spot your weakest area and favour it.';
  }

  return {
    totalAnswered: progress.totalAnswered,
    totalCorrect: progress.totalCorrect,
    accuracy: progress.totalAnswered > 0 ? progress.totalCorrect / progress.totalAnswered : null,
    level: progress.level,
    perTopic,
    weakestTopic: weakest?.topic ?? null,
    recommendation,
  };
}

// --- Persistence (browser localStorage only) -----------------------------

function isValidProgress(value: unknown): value is TutorProgress {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TutorProgress>;
  return (
    candidate.version === 1 &&
    typeof candidate.level === 'number' &&
    typeof candidate.totalAnswered === 'number' &&
    typeof candidate.totalCorrect === 'number' &&
    Array.isArray(candidate.seenIds) &&
    Array.isArray(candidate.missedIds) &&
    Array.isArray(candidate.recentResults) &&
    typeof candidate.topics === 'object' &&
    candidate.topics !== null
  );
}

/** Load saved progress, or start fresh when nothing valid is stored. */
export function loadProgress(
  storage: Pick<Storage, 'getItem'> | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): TutorProgress {
  if (!storage) return createProgress();
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return createProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgress(parsed)) return createProgress();
    // Fill any topic added to the bank after the save was written.
    const fresh = createProgress();
    return { ...fresh, ...parsed, topics: { ...fresh.topics, ...parsed.topics } };
  } catch {
    return createProgress();
  }
}

/** Save progress. Storage failures (private mode, quota) are ignored. */
export function saveProgress(
  progress: TutorProgress,
  storage: Pick<Storage, 'setItem'> | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Progress is a convenience, never a reason to break the session.
  }
}

/** Clear saved progress and return a fresh state. */
export function resetProgress(
  storage: Pick<Storage, 'removeItem'> | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : undefined,
): TutorProgress {
  if (storage) {
    try {
      storage.removeItem(PROGRESS_STORAGE_KEY);
    } catch {
      // Nothing to clean up.
    }
  }
  return createProgress();
}
