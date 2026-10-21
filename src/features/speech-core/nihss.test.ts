import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_SCORE_ANCHORS,
  NIHSS_CASES,
  anchorFor,
  buildDocumentationDraft,
  evaluateScore,
  getNihssCase,
} from './nihss';

describe('LANGUAGE_SCORE_ANCHORS', () => {
  it('covers scores 0 to 3 in order with labels and descriptions', () => {
    expect(LANGUAGE_SCORE_ANCHORS.map((anchor) => anchor.score)).toEqual([0, 1, 2, 3]);
    for (const anchor of LANGUAGE_SCORE_ANCHORS) {
      expect(anchor.label.length).toBeGreaterThan(0);
      expect(anchor.description.length).toBeGreaterThan(30);
    }
  });

  it('anchorFor returns the matching anchor', () => {
    expect(anchorFor(2).label).toBe('Severe aphasia');
  });
});

describe('NIHSS_CASES integrity', () => {
  it('has unique ids and complete task material in every case', () => {
    const ids = NIHSS_CASES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of NIHSS_CASES) {
      expect(entry.naming.length).toBeGreaterThanOrEqual(4);
      for (const item of entry.naming) {
        expect(item.prompt.length).toBeGreaterThan(0);
        expect(item.patientResponse.length).toBeGreaterThan(0);
      }
      expect(entry.readingCard.length).toBeGreaterThan(10);
      expect(entry.readingPatientTranscript.length).toBeGreaterThan(0);
      expect(entry.conversationPrompt.length).toBeGreaterThan(0);
      expect(entry.conversationPatientResponse.length).toBeGreaterThan(0);
      expect(entry.authorRationale.length).toBeGreaterThan(30);
    }
  });

  it('covers every reference score from 0 to 3 across the case set', () => {
    const scores = new Set(NIHSS_CASES.map((entry) => entry.referenceScore));
    expect(scores).toEqual(new Set([0, 1, 2, 3]));
  });

  it('getNihssCase finds a case and returns undefined for unknown ids', () => {
    expect(getNihssCase(NIHSS_CASES[0].id)?.id).toBe(NIHSS_CASES[0].id);
    expect(getNihssCase('nope')).toBeUndefined();
  });

  it('the fluent case reproduces its reading card exactly', () => {
    const fluent = NIHSS_CASES.find((entry) => entry.referenceScore === 0);
    expect(fluent?.readingPatientTranscript).toBe(fluent?.readingCard);
  });
});

describe('evaluateScore', () => {
  it('reports an exact match', () => {
    const result = evaluateScore(1, 1);
    expect(result.verdict).toBe('exact');
  });

  it('reports a one-step gap as close, in both directions', () => {
    expect(evaluateScore(0, 1).verdict).toBe('close');
    expect(evaluateScore(2, 1).verdict).toBe('close');
    expect(evaluateScore(0, 1).detail).not.toBe(evaluateScore(2, 1).detail);
  });

  it('reports a larger gap as far', () => {
    expect(evaluateScore(0, 3).verdict).toBe('far');
    expect(evaluateScore(3, 1).verdict).toBe('far');
  });
});

describe('buildDocumentationDraft', () => {
  it('watermarks the draft and includes scores and justification', () => {
    const draft = buildDocumentationDraft(NIHSS_CASES[1], 1, 'Naming mostly correct.');
    expect(draft).toContain('TRAINING SIMULATION NOTE');
    expect(draft).toContain('NOT A MEDICAL RECORD');
    expect(draft).toContain('Student score: 1');
    expect(draft).toContain('Case key: 1');
    expect(draft).toContain('Naming mostly correct.');
    expect(draft).toContain('fictional patient');
  });

  it('notes a missing justification instead of inventing one', () => {
    const draft = buildDocumentationDraft(NIHSS_CASES[0], 0, '   ');
    expect(draft).toContain('(not provided)');
  });
});
