import { describe, expect, it } from 'vitest';
import {
  SCAN_CASES,
  buildQuiz,
  caseBrief,
  computeMismatch,
  getScanCase,
  scoreQuiz,
} from './scan';

describe('scan case library', () => {
  it('ships curated cases with source and license labels', () => {
    expect(SCAN_CASES.length).toBeGreaterThanOrEqual(3);
    for (const scanCase of SCAN_CASES) {
      expect(scanCase.source.length).toBeGreaterThan(0);
      expect(scanCase.license.length).toBeGreaterThan(0);
      expect(scanCase.annotations.length).toBeGreaterThanOrEqual(3);
      const ids = new Set(scanCase.annotations.map((a) => a.id));
      expect(ids.size).toBe(scanCase.annotations.length);
      for (const annotation of scanCase.annotations) {
        expect(annotation.x).toBeGreaterThanOrEqual(0);
        expect(annotation.x).toBeLessThanOrEqual(100);
        expect(annotation.y).toBeGreaterThanOrEqual(0);
        expect(annotation.y).toBeLessThanOrEqual(100);
        expect(annotation.explanation.length).toBeGreaterThan(20);
      }
    }
  });

  it('finds cases by id', () => {
    expect(getScanCase('normal-axial-schematic')?.title).toContain('basal ganglia');
    expect(getScanCase('does-not-exist')).toBeUndefined();
  });

  it('builds an offline brief from curator annotations only', () => {
    const scanCase = SCAN_CASES[0];
    const brief = caseBrief(scanCase);
    expect(brief).toContain(scanCase.title);
    for (const annotation of scanCase.annotations) {
      expect(brief).toContain(annotation.label);
    }
  });
});

describe('core and penumbra concept calculator', () => {
  it('computes total, mismatch volume, and ratio', () => {
    const result = computeMismatch(10, 30);
    expect(result.totalHypoperfusedMl).toBe(40);
    expect(result.mismatchVolumeMl).toBe(30);
    expect(result.mismatchRatio).toBeCloseTo(4, 6);
    expect(result.band).toBe('large');
  });

  it('handles a zero core without dividing by zero', () => {
    const result = computeMismatch(0, 25);
    expect(result.mismatchRatio).toBeNull();
    expect(result.band).toBe('no core entered');
    expect(result.totalHypoperfusedMl).toBe(25);
  });

  it('classifies small and moderate bands', () => {
    expect(computeMismatch(50, 5).band).toBe('small');
    expect(computeMismatch(40, 20).band).toBe('moderate');
    expect(computeMismatch(40, 20).mismatchRatio).toBeCloseTo(1.5, 6);
  });

  it('clamps negative inputs to zero', () => {
    const result = computeMismatch(-10, -5);
    expect(result.totalHypoperfusedMl).toBe(0);
    expect(result.mismatchVolumeMl).toBe(0);
  });
});

describe('structure quiz', () => {
  it('builds one question per annotation and scores taps', () => {
    const scanCase = SCAN_CASES[1];
    const questions = buildQuiz(scanCase);
    expect(questions.length).toBe(scanCase.annotations.length);
    const answers = new Map<string, string>();
    answers.set(questions[0].annotationId, questions[0].annotationId);
    answers.set(questions[1].annotationId, questions[0].annotationId);
    const score = scoreQuiz(questions, answers);
    expect(score.total).toBe(questions.length);
    expect(score.correct).toBe(1);
    expect(score.perQuestion[0].correct).toBe(true);
    expect(score.perQuestion[1].correct).toBe(false);
  });
});
