import { describe, expect, it } from 'vitest';

import { detectDocument } from './detect';
import { DISCHARGE_SAMPLES, RISK_SAMPLES } from '../../document-clinical/samples';

describe('detectDocument', () => {
  it('detects a pure discharge summary as discharge', () => {
    const result = detectDocument(DISCHARGE_SAMPLES[0].text);
    expect(result.kind).toBe('discharge');
    expect(result.dischargeSections).toBeGreaterThanOrEqual(2);
    expect(result.discharge.facts.length).toBeGreaterThan(0);
  });

  it('detects a pure health history as history', () => {
    const result = detectDocument(RISK_SAMPLES[0].text);
    expect(result.kind).toBe('history');
    expect(result.riskFactorsFound).toBeGreaterThanOrEqual(3);
    // The history names a medicine (amlodipine), so the discharge probe
    // finds exactly one medication section. That single section must not
    // flip the kind, and the medication fact is kept for the checklist.
    expect(result.dischargeSections).toBe(1);
    expect(
      result.discharge.facts.some((fact) => fact.category === 'medication'),
    ).toBe(true);
  });

  it('detects the mostly-absent history sample as history', () => {
    const result = detectDocument(RISK_SAMPLES[1].text);
    expect(result.kind).toBe('history');
    expect(result.risk.results.some((factor) => factor.status === 'absent_stated')).toBe(true);
  });

  it('keeps both blocks for a hybrid document: discharge leads, risk still computed', () => {
    const hybrid = [
      DISCHARGE_SAMPLES[0].text,
      '',
      'History: The patient has had high blood pressure for ten years and has diabetes. He smokes about ten cigarettes a day and rarely exercises. His father had a stroke at the age of 70.',
    ].join('\n');
    const result = detectDocument(hybrid);
    expect(result.kind).toBe('discharge');
    expect(result.discharge.facts.length).toBeGreaterThan(0);
    const stated = result.risk.results.filter((factor) => factor.status === 'present');
    expect(stated.length).toBeGreaterThanOrEqual(3);
    expect(result.riskFactorsFound).toBeGreaterThanOrEqual(3);
  });

  it('reports random text honestly as unknown with both extractions empty or near empty', () => {
    const result = detectDocument(
      'The weather was fine on Tuesday. We went to the market and bought rice, eggs, and vegetables for dinner.',
    );
    expect(result.kind).toBe('unknown');
    expect(result.dischargeSections).toBe(0);
    expect(result.riskFactorsFound).toBe(0);
  });

  it('always returns the full fixed risk profile of 10 factors', () => {
    const result = detectDocument(RISK_SAMPLES[2].text);
    expect(result.risk.results).toHaveLength(10);
  });
});
