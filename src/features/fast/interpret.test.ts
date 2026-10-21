import { describe, expect, it } from 'vitest';
import { buildInterpretationContext, localInterpretation } from './interpret';
import {
  STAGES,
  answerGate,
  buildSummary,
  completeStage,
  createSession,
  markStageCannotAnalyze,
  setAnswer,
  setQuality,
  setTranscript,
  startStages,
} from './session';
import type { SessionState } from './session';

function clearedSession(): SessionState {
  let state = startStages(answerGate(createSession(), false));
  for (const def of STAGES) {
    for (const item of def.items) {
      state = setAnswer(state, def.id, item.id, 'not-observed');
    }
    state = completeStage(state);
  }
  return state;
}

describe('buildInterpretationContext', () => {
  it('covers every stage with derived numbers only and stays within the client limit', () => {
    const context = buildInterpretationContext(buildSummary(clearedSession()));
    expect(context.length).toBeLessThanOrEqual(1000);
    expect(context).toContain('Face: smile task');
    expect(context).toContain('Arms: raise and hold');
    expect(context).toContain('Speech: repeat the sentence');
    expect(context).toContain('no combined score');
    expect(context).not.toContain('@');
  });

  it('reports a failed stage as unanalyzed instead of describing a result', () => {
    let state = startStages(answerGate(createSession(), false));
    state = markStageCannotAnalyze(state, 'face');
    const context = buildInterpretationContext(buildSummary(state));
    expect(context).toContain('could not be analyzed');
  });
});

describe('localInterpretation', () => {
  it('describes each stage separately and ends with the mandatory closing line', () => {
    const text = localInterpretation(buildSummary(clearedSession()));
    expect(text).toContain('Face: smile task');
    expect(text).toContain('Arms: raise and hold');
    expect(text).toContain('Speech: repeat the sentence');
    expect(text).toContain('cannot rule out stroke');
    expect(text).toContain('Data contribution by modality');
    expect(text).toContain('not a risk estimate');
  });

  it('includes the speech word match as a practice measure, not a score', () => {
    let state = startStages(answerGate(createSession(), false));
    for (const def of STAGES) {
      if (def.id !== 'speech') {
        for (const item of def.items) state = setAnswer(state, def.id, item.id, 'not-observed');
        state = completeStage(state);
      }
    }
    state = setTranscript(state, 'the early bird catches');
    for (const item of STAGES[2]?.items ?? []) {
      state = setAnswer(state, 'speech', item.id, 'not-observed');
    }
    const text = localInterpretation(buildSummary(state));
    expect(text).toContain('matched 4 of 6 target words');
  });

  it('never reassures and never claims a diagnosis outcome', () => {
    const text = localInterpretation(buildSummary(clearedSession())).toLowerCase();
    expect(text).not.toContain('you do not have a stroke');
    expect(text).not.toContain('no stroke detected');
    expect(text).not.toContain('is normal');
    expect(text).not.toContain('diagnosis');
  });

  it('keeps a failed stage unanalyzed in words too', () => {
    let state = startStages(answerGate(createSession(), false));
    state = markStageCannotAnalyze(state, 'arm');
    state = setQuality(state, 'face', 'limited');
    const text = localInterpretation(buildSummary(state));
    expect(text).toContain('Arms: raise and hold: this stage could not be analyzed');
    expect(text).toContain('do not fill in for it');
  });
});
