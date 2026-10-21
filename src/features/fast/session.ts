// Pure session logic for the Digital FAST Multimodal Lab.
//
// No DOM, no timers, no network in this module. Every function takes a
// session state and returns a new one, so the whole flow is unit testable.
// The UI layer owns the camera, the microphone, and the clock; this module
// owns the rules: the symptom gate, the stage order, checklist answers,
// the emergency escalation, per modality quality, and the summary.
//
// Safety rules encoded here, mirroring PLANNING.md section 6.1:
// - A person with sudden symptoms never starts the session (the gate).
// - If a possible sign is observed, or an answer is "not sure", the
//   session stops and the UI must direct the person to call 119. The
//   escalation latches: editing answers afterwards never clears it.
// - A modality that fails reports cannot analyze. Other modalities never
//   fill in for it, and there is no combined score anywhere in this file.
// - The fusion weights in the summary describe data contribution only
//   (quality and completeness), never a risk estimate or a verdict.

export type StageId = 'face' | 'arm' | 'speech';

export type CheckStatus = 'observed' | 'not-observed' | 'unsure' | 'cannot';

export type DataQuality = 'good' | 'limited' | 'failed';

export type SessionPhase = 'gate' | 'intro' | 'stage' | 'summary' | 'emergency';

export interface ChecklistItemDef {
  id: string;
  prompt: string;
  hint: string;
}

export interface StageDef {
  id: StageId;
  letter: string;
  title: string;
  task: string;
  guidance: string;
  durationSec: number;
  usesCamera: boolean;
  items: ChecklistItemDef[];
}

/** The standard sentence repeated in the speech stage. */
export const STANDARD_SENTENCE = 'The early bird catches the worm.';

/** Mandatory closing line for every summary this lab produces. */
export const CLOSING_LINE =
  'This session cannot rule out stroke. If any sign was observed, or you are unsure about a sudden change, call 119 in Indonesia now instead of repeating the session.';

export const STAGES: StageDef[] = [
  {
    id: 'face',
    letter: 'F',
    title: 'Face: smile task',
    task: 'Ask the person to smile and hold the smile while the timer runs.',
    guidance:
      'Watch the whole face, not just the mouth. Record what you actually see; use "Could not check" when the view was blocked or the task was not possible.',
    durationSec: 6,
    usesCamera: true,
    items: [
      {
        id: 'face-lag',
        prompt: 'One side of the mouth moved less, or lagged behind the other side',
        hint: 'Compare the first moment of the smile on both sides.',
      },
      {
        id: 'face-uneven',
        prompt: 'One corner of the mouth stayed lower, so the smile looked uneven',
        hint: 'Ordinary faces are a little asymmetric. Record only a clear, one-sided difference.',
      },
    ],
  },
  {
    id: 'arm',
    letter: 'A',
    title: 'Arms: raise and hold',
    task: 'Ask the person to raise both arms to shoulder height and hold them there while the timer runs.',
    guidance:
      'Do not force movement and stop if the person feels pain. Watch for one arm sinking or failing to rise, and record only what you see.',
    durationSec: 10,
    usesCamera: true,
    items: [
      {
        id: 'arm-drift',
        prompt: 'One arm drifted down during the hold',
        hint: 'A slow sink counts, not only a sudden drop.',
      },
      {
        id: 'arm-height',
        prompt: 'One arm could not be raised as high as the other',
        hint: 'Compare both arms at the start of the hold, before any drifting.',
      },
    ],
  },
  {
    id: 'speech',
    letter: 'S',
    title: 'Speech: repeat the sentence',
    task: 'Ask the person to repeat the standard sentence out loud, then record or type what you heard.',
    guidance:
      'Difficulty producing the sentence and difficulty understanding it both count as observations. Accent and dialect are not observations.',
    durationSec: 15,
    usesCamera: false,
    items: [
      {
        id: 'speech-slur',
        prompt: 'Speech sounded slurred or hard to understand',
        hint: 'Compare with how this person usually sounds, if you know them.',
      },
      {
        id: 'speech-repeat',
        prompt: 'The sentence was not repeated correctly',
        hint: 'Wrong words, missing words, or being unable to attempt the sentence all count.',
      },
    ],
  },
];

export function stageDef(stageId: StageId): StageDef {
  const def = STAGES.find((stage) => stage.id === stageId);
  if (!def) throw new Error(`Unknown stage id: ${stageId}`);
  return def;
}

export interface StageState {
  answers: Record<string, CheckStatus | null>;
  quality: DataQuality;
  transcript: string;
}

export interface Escalation {
  stageId: StageId;
  itemId: string;
  status: 'observed' | 'unsure';
  source: 'gate' | 'checklist';
}

export interface SessionState {
  phase: SessionPhase;
  gateSymptoms: boolean | null;
  activeStageIndex: number;
  stages: Record<StageId, StageState>;
  escalation: Escalation | null;
}

function emptyStageState(def: StageDef): StageState {
  const answers: Record<string, CheckStatus | null> = {};
  for (const item of def.items) answers[item.id] = null;
  return { answers, quality: 'good', transcript: '' };
}

/** A fresh session, waiting at the symptom gate. */
export function createSession(): SessionState {
  return {
    phase: 'gate',
    gateSymptoms: null,
    activeStageIndex: 0,
    stages: {
      face: emptyStageState(stageDef('face')),
      arm: emptyStageState(stageDef('arm')),
      speech: emptyStageState(stageDef('speech')),
    },
    escalation: null,
  };
}

/**
 * Answer the symptom gate. A person with sudden symptoms goes straight to
 * the emergency phase and never reaches the stages.
 */
export function answerGate(state: SessionState, hasSymptoms: boolean): SessionState {
  if (state.phase !== 'gate') return state;
  if (!hasSymptoms) return { ...state, gateSymptoms: false, phase: 'intro' };
  return {
    ...state,
    gateSymptoms: true,
    phase: 'emergency',
    escalation: { stageId: 'face', itemId: 'gate', status: 'observed', source: 'gate' },
  };
}

/** Move from the introduction into the first stage. */
export function startStages(state: SessionState): SessionState {
  if (state.phase !== 'intro') return state;
  return { ...state, phase: 'stage', activeStageIndex: 0 };
}

/**
 * The first escalation anywhere in the session, in stage order, or null.
 * Both an observed sign and an unsure answer escalate, matching the
 * product rule that uncertainty about a sudden sign is treated as urgent.
 */
export function findEscalation(state: SessionState): Escalation | null {
  if (state.escalation) return state.escalation;
  for (const def of STAGES) {
    const stage = state.stages[def.id];
    for (const item of def.items) {
      const answer = stage.answers[item.id];
      if (answer === 'observed' || answer === 'unsure') {
        return { stageId: def.id, itemId: item.id, status: answer, source: 'checklist' };
      }
    }
  }
  return null;
}

/**
 * Record one checklist answer. If the answer observes a sign or expresses
 * uncertainty, the session escalates immediately and halts: the phase
 * becomes emergency and later edits change nothing (see findEscalation
 * and the guard in this function).
 */
export function setAnswer(
  state: SessionState,
  stageId: StageId,
  itemId: string,
  status: CheckStatus,
): SessionState {
  if (state.phase !== 'stage' || state.escalation) return state;
  const def = stageDef(stageId);
  if (!def.items.some((item) => item.id === itemId)) return state;
  const stage = state.stages[stageId];
  const next: SessionState = {
    ...state,
    stages: {
      ...state.stages,
      [stageId]: { ...stage, answers: { ...stage.answers, [itemId]: status } },
    },
  };
  const escalation = findEscalation(next);
  if (escalation) return { ...next, escalation, phase: 'emergency' };
  return next;
}

/** Record the data quality the person attests for one stage. */
export function setQuality(
  state: SessionState,
  stageId: StageId,
  quality: DataQuality,
): SessionState {
  if (state.phase !== 'stage' || state.escalation) return state;
  const stage = state.stages[stageId];
  return { ...state, stages: { ...state.stages, [stageId]: { ...stage, quality } } };
}

/** Record what was heard in the speech stage (typed or transcribed). */
export function setTranscript(state: SessionState, transcript: string): SessionState {
  if (state.phase !== 'stage' || state.escalation) return state;
  const stage = state.stages.speech;
  return { ...state, stages: { ...state.stages, speech: { ...stage, transcript } } };
}

/**
 * Mark a whole stage as cannot analyze: every check becomes "cannot" and
 * the quality becomes failed. The stage is still completed so the session
 * can move on, and the summary reports it as cannot analyze.
 */
export function markStageCannotAnalyze(state: SessionState, stageId: StageId): SessionState {
  if (state.phase !== 'stage' || state.escalation) return state;
  const def = stageDef(stageId);
  const answers: Record<string, CheckStatus | null> = {};
  for (const item of def.items) answers[item.id] = 'cannot';
  return {
    ...state,
    stages: {
      ...state.stages,
      [stageId]: { ...state.stages[stageId], answers, quality: 'failed' },
    },
  };
}

/** A stage can be completed only when every check has an answer. */
export function canCompleteStage(def: StageDef, stage: StageState): boolean {
  return def.items.every((item) => stage.answers[item.id] !== null);
}

/** Advance to the next stage, or to the summary after the last stage. */
export function completeStage(state: SessionState): SessionState {
  if (state.phase !== 'stage' || state.escalation) return state;
  const def = STAGES[state.activeStageIndex];
  if (!def || !canCompleteStage(def, state.stages[def.id])) return state;
  if (state.activeStageIndex >= STAGES.length - 1) return { ...state, phase: 'summary' };
  return { ...state, activeStageIndex: state.activeStageIndex + 1 };
}

// ---------------------------------------------------------------------------
// Timers (the UI owns the clock; these helpers only do the arithmetic)
// ---------------------------------------------------------------------------

/** Whole seconds left in a task window, never negative. */
export function remainingSeconds(durationSec: number, elapsedSec: number): number {
  return Math.max(0, Math.ceil(durationSec - Math.max(0, elapsedSec)));
}

/** Fraction of the task window that has elapsed, clamped to 0..1. */
export function progressFraction(durationSec: number, elapsedSec: number): number {
  if (durationSec <= 0) return 1;
  const fraction = elapsedSec / durationSec;
  if (fraction < 0) return 0;
  if (fraction > 1) return 1;
  return fraction;
}

// ---------------------------------------------------------------------------
// Speech: deterministic word overlap against the standard sentence
// ---------------------------------------------------------------------------

export interface WordOverlap {
  targetWords: { word: string; matched: boolean }[];
  matchedCount: number;
  totalCount: number;
  /** matchedCount / totalCount, or 0 when the target is empty. */
  ratio: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^[-']+|[-']+$/g, ''))
    .filter((word) => word.length > 0);
}

/**
 * Align a transcript to the known target sentence word by word. Each
 * target word is matched at most once, in order, against the remaining
 * transcript words, so the result is a deterministic clarity measure for
 * practice, never a clinical score.
 */
export function wordOverlap(transcript: string, target: string = STANDARD_SENTENCE): WordOverlap {
  const targetWords = tokenize(target);
  const remaining = tokenize(transcript);
  const aligned = targetWords.map((word) => {
    const index = remaining.indexOf(word);
    if (index === -1) return { word, matched: false };
    remaining.splice(index, 1);
    return { word, matched: true };
  });
  const matchedCount = aligned.filter((entry) => entry.matched).length;
  return {
    targetWords: aligned,
    matchedCount,
    totalCount: targetWords.length,
    ratio: targetWords.length === 0 ? 0 : matchedCount / targetWords.length,
  };
}

// ---------------------------------------------------------------------------
// Summary: per modality observation sheets plus data contribution weights
// ---------------------------------------------------------------------------

export type StageStatus = 'observation-noted' | 'no-observation' | 'cannot-analyze';

export interface StageSummary {
  stageId: StageId;
  quality: DataQuality;
  status: StageStatus;
  answeredCount: number;
  itemCount: number;
  observedCount: number;
  unsureCount: number;
  cannotCount: number;
  /** Word overlap for the speech stage; null for the other stages. */
  transcriptMatch: WordOverlap | null;
}

export interface SessionSummary {
  stages: StageSummary[];
  /** Data contribution per stage (quality and completeness only). */
  weights: { stageId: StageId; weight: number }[];
  anyCannotAnalyze: boolean;
}

const QUALITY_POINTS: Record<DataQuality, number> = { good: 1, limited: 0.5, failed: 0 };

export function summarizeStage(def: StageDef, stage: StageState): StageSummary {
  const answers = def.items.map((item) => stage.answers[item.id]);
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const observedCount = answers.filter((answer) => answer === 'observed').length;
  const unsureCount = answers.filter((answer) => answer === 'unsure').length;
  const cannotCount = answers.filter((answer) => answer === 'cannot').length;
  let status: StageStatus = 'no-observation';
  if (stage.quality === 'failed' || (answeredCount > 0 && cannotCount === answeredCount)) {
    status = 'cannot-analyze';
  } else if (observedCount > 0 || unsureCount > 0) {
    status = 'observation-noted';
  }
  return {
    stageId: def.id,
    quality: stage.quality,
    status,
    answeredCount,
    itemCount: def.items.length,
    observedCount,
    unsureCount,
    cannotCount,
    transcriptMatch: def.id === 'speech' ? wordOverlap(stage.transcript) : null,
  };
}

/**
 * Build the full summary. The weights are a transparent fusion of data
 * contribution: each stage contributes in proportion to its attested data
 * quality (good 1, limited 0.5, failed 0) times its completeness (share of
 * checks answered). Weights sum to 1 when any stage contributed usable
 * data, and are all 0 when none did. They are never a combined score.
 */
export function buildSummary(state: SessionState): SessionSummary {
  const stages = STAGES.map((def) => summarizeStage(def, state.stages[def.id]));
  const raw = stages.map((summary) => {
    const completeness = summary.itemCount === 0 ? 0 : summary.answeredCount / summary.itemCount;
    return QUALITY_POINTS[summary.quality] * completeness;
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  const weights = stages.map((summary, index) => ({
    stageId: summary.stageId,
    weight: total > 0 ? (raw[index] ?? 0) / total : 0,
  }));
  return {
    stages,
    weights,
    anyCannotAnalyze: stages.some((summary) => summary.status === 'cannot-analyze'),
  };
}
