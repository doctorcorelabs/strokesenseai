import { describe, expect, it } from 'vitest';
import {
  STANDARD_SENTENCE,
  STAGES,
  answerGate,
  buildSummary,
  canCompleteStage,
  completeStage,
  createSession,
  findEscalation,
  markStageCannotAnalyze,
  progressFraction,
  remainingSeconds,
  setAnswer,
  setQuality,
  setTranscript,
  stageDef,
  startStages,
  summarizeStage,
  wordOverlap,
} from './session';

/** Session in the stage phase, ready for answers. */
function inStagePhase() {
  return startStages(answerGate(createSession(), false));
}

/** Answer every item of the active stage as not observed, then complete it. */
function clearStage(state: ReturnType<typeof inStagePhase>) {
  let next = state;
  const def = STAGES[next.activeStageIndex];
  if (!def) throw new Error('expected an active stage');
  for (const item of def.items) {
    next = setAnswer(next, def.id, item.id, 'not-observed');
  }
  return completeStage(next);
}

describe('symptom gate', () => {
  it('sends a symptomatic person to the emergency phase and never starts stages', () => {
    const gated = answerGate(createSession(), true);
    expect(gated.phase).toBe('emergency');
    expect(gated.gateSymptoms).toBe(true);
    expect(gated.escalation?.source).toBe('gate');
    // The gate answer is final for this session object: starting is a no-op.
    expect(startStages(gated).phase).toBe('emergency');
  });

  it('lets a well practice person through to the intro and then stage one', () => {
    const intro = answerGate(createSession(), false);
    expect(intro.phase).toBe('intro');
    const running = startStages(intro);
    expect(running.phase).toBe('stage');
    expect(running.activeStageIndex).toBe(0);
  });

  it('ignores a second gate answer', () => {
    const intro = answerGate(createSession(), false);
    expect(answerGate(intro, true).phase).toBe('intro');
  });
});

describe('stage flow and checklist scoring', () => {
  it('blocks completion until every check is answered', () => {
    let state = inStagePhase();
    const face = stageDef('face');
    expect(canCompleteStage(face, state.stages.face)).toBe(false);
    expect(completeStage(state).activeStageIndex).toBe(0);
    state = setAnswer(state, 'face', 'face-lag', 'not-observed');
    expect(canCompleteStage(face, state.stages.face)).toBe(false);
    state = setAnswer(state, 'face', 'face-uneven', 'not-observed');
    expect(canCompleteStage(face, state.stages.face)).toBe(true);
  });

  it('walks face, arm, speech, then lands on the summary', () => {
    let state = inStagePhase();
    state = clearStage(state);
    expect(state.activeStageIndex).toBe(1);
    state = clearStage(state);
    expect(state.activeStageIndex).toBe(2);
    state = clearStage(state);
    expect(state.phase).toBe('summary');
  });

  it('rejects answers for unknown items and answers outside the stage phase', () => {
    const state = inStagePhase();
    expect(setAnswer(state, 'face', 'nope', 'observed')).toBe(state);
    const intro = answerGate(createSession(), false);
    expect(setAnswer(intro, 'face', 'face-lag', 'observed')).toBe(intro);
  });

  it('records quality and transcript immutably', () => {
    const state = inStagePhase();
    const withQuality = setQuality(state, 'arm', 'limited');
    expect(withQuality.stages.arm.quality).toBe('limited');
    expect(state.stages.arm.quality).toBe('good');
    const withText = setTranscript(state, 'the early bird');
    expect(withText.stages.speech.transcript).toBe('the early bird');
    expect(state.stages.speech.transcript).toBe('');
  });
});

describe('emergency escalation', () => {
  it('escalates immediately when a sign is observed and halts the session', () => {
    let state = inStagePhase();
    state = setAnswer(state, 'face', 'face-lag', 'observed');
    expect(state.phase).toBe('emergency');
    expect(state.escalation).toMatchObject({ stageId: 'face', itemId: 'face-lag', status: 'observed' });
    // Halted: further answers and stage completion change nothing.
    expect(setAnswer(state, 'face', 'face-uneven', 'not-observed')).toBe(state);
    expect(completeStage(state)).toBe(state);
  });

  it('treats a not sure answer as an escalation too', () => {
    let state = inStagePhase();
    state = clearStage(state); // face cleared
    state = setAnswer(state, 'arm', 'arm-drift', 'unsure');
    expect(state.phase).toBe('emergency');
    expect(state.escalation?.status).toBe('unsure');
  });

  it('latches: changing the triggering answer later never clears the escalation', () => {
    let state = inStagePhase();
    state = setAnswer(state, 'face', 'face-lag', 'observed');
    const escalation = findEscalation(state);
    expect(escalation).not.toBeNull();
    // setAnswer is a no-op once escalated, so the latch cannot be edited away.
    const attempted = setAnswer(state, 'face', 'face-lag', 'not-observed');
    expect(attempted).toBe(state);
    expect(findEscalation(attempted)).toEqual(escalation);
  });

  it('does not escalate on not observed or could not check answers', () => {
    let state = inStagePhase();
    state = setAnswer(state, 'face', 'face-lag', 'cannot');
    state = setAnswer(state, 'face', 'face-uneven', 'not-observed');
    expect(state.phase).toBe('stage');
    expect(findEscalation(state)).toBeNull();
  });
});

describe('cannot analyze handling', () => {
  it('marks a whole stage as cannot analyze and still lets the session finish it', () => {
    let state = inStagePhase();
    state = markStageCannotAnalyze(state, 'face');
    expect(state.stages.face.quality).toBe('failed');
    expect(canCompleteStage(stageDef('face'), state.stages.face)).toBe(true);
    const summary = summarizeStage(stageDef('face'), state.stages.face);
    expect(summary.status).toBe('cannot-analyze');
    expect(summary.cannotCount).toBe(2);
  });

  it('derives cannot analyze from a failed quality even with mixed answers', () => {
    let state = inStagePhase();
    state = setAnswer(state, 'face', 'face-lag', 'not-observed');
    state = setAnswer(state, 'face', 'face-uneven', 'cannot');
    state = setQuality(state, 'face', 'failed');
    expect(summarizeStage(stageDef('face'), state.stages.face).status).toBe('cannot-analyze');
  });

  it('never fills a failed modality with another one in the summary', () => {
    let state = inStagePhase();
    state = markStageCannotAnalyze(state, 'face');
    state = completeStage(state);
    state = clearStage(state); // arm cleared with good quality
    state = clearStage(state); // speech cleared with good quality
    const summary = buildSummary(state);
    const faceWeight = summary.weights.find((entry) => entry.stageId === 'face');
    expect(faceWeight?.weight).toBe(0);
    expect(summary.anyCannotAnalyze).toBe(true);
    const faceSummary = summary.stages.find((entry) => entry.stageId === 'face');
    expect(faceSummary?.status).toBe('cannot-analyze');
  });
});

describe('summary and contribution weights', () => {
  it('gives equal weights to three equally good, complete stages', () => {
    let state = inStagePhase();
    state = clearStage(clearStage(clearStage(state)));
    const summary = buildSummary(state);
    for (const entry of summary.weights) expect(entry.weight).toBeCloseTo(1 / 3);
    const total = summary.weights.reduce((sum, entry) => sum + entry.weight, 0);
    expect(total).toBeCloseTo(1);
  });

  it('halves the contribution of a limited quality stage', () => {
    let state = inStagePhase();
    state = setQuality(state, 'face', 'limited');
    state = clearStage(clearStage(clearStage(state)));
    const summary = buildSummary(state);
    const face = summary.weights.find((entry) => entry.stageId === 'face');
    const arm = summary.weights.find((entry) => entry.stageId === 'arm');
    expect(face?.weight).toBeCloseTo(0.2);
    expect(arm?.weight).toBeCloseTo(0.4);
  });

  it('returns all zero weights when no stage produced usable data', () => {
    let state = inStagePhase();
    state = markStageCannotAnalyze(state, 'face');
    state = completeStage(state);
    state = markStageCannotAnalyze(state, 'arm');
    state = completeStage(state);
    state = markStageCannotAnalyze(state, 'speech');
    state = completeStage(state);
    const summary = buildSummary(state);
    expect(summary.weights.every((entry) => entry.weight === 0)).toBe(true);
  });

  it('scales contribution by completeness for a partially answered stage', () => {
    let state = inStagePhase();
    state = setAnswer(state, 'face', 'face-lag', 'not-observed');
    const summary = buildSummary(state);
    const face = summary.weights.find((entry) => entry.stageId === 'face');
    // One of two checks answered at good quality: raw 0.5 of a total 0.5.
    expect(face?.weight).toBeCloseTo(1);
  });
});

describe('timer helpers', () => {
  it('computes remaining seconds with a ceiling and a floor of zero', () => {
    expect(remainingSeconds(10, 0)).toBe(10);
    expect(remainingSeconds(10, 3.2)).toBe(7);
    expect(remainingSeconds(10, 10)).toBe(0);
    expect(remainingSeconds(10, 25)).toBe(0);
  });

  it('clamps the progress fraction to 0..1', () => {
    expect(progressFraction(10, 0)).toBe(0);
    expect(progressFraction(10, 5)).toBe(0.5);
    expect(progressFraction(10, 99)).toBe(1);
    expect(progressFraction(0, 0)).toBe(1);
  });
});

describe('word overlap', () => {
  it('matches an exact repetition, ignoring case and punctuation', () => {
    const result = wordOverlap('The early bird catches the worm!', STANDARD_SENTENCE);
    expect(result.matchedCount).toBe(6);
    expect(result.totalCount).toBe(6);
    expect(result.ratio).toBe(1);
    expect(result.targetWords.every((entry) => entry.matched)).toBe(true);
  });

  it('marks only the words that were actually said', () => {
    const result = wordOverlap('the early bird');
    expect(result.matchedCount).toBe(3);
    expect(result.targetWords.map((entry) => entry.matched)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
  });

  it('matches each target word at most once', () => {
    // The target contains "the" twice, so four spoken copies still fill
    // only those two slots and nothing else.
    const result = wordOverlap('the the the the');
    expect(result.matchedCount).toBe(2);
    expect(result.targetWords.filter((entry) => entry.matched)).toHaveLength(2);
  });

  it('handles an empty transcript without inventing matches', () => {
    const result = wordOverlap('');
    expect(result.matchedCount).toBe(0);
    expect(result.ratio).toBe(0);
  });
});
