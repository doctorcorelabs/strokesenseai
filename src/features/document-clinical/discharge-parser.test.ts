import { describe, expect, it } from 'vitest';
import { parseDischargeText, validateDischargeFact } from './discharge-parser';
import { DISCHARGE_SAMPLES } from './samples';
import type { DischargeFact } from './types';

const sample1 = DISCHARGE_SAMPLES[0].text;
const sample2 = DISCHARGE_SAMPLES[1].text;

function byCategory(facts: DischargeFact[], category: DischargeFact['category']) {
  return facts.filter((fact) => fact.category === category);
}

describe('parseDischargeText with synthetic sample 1', () => {
  const result = parseDischargeText(sample1);

  it('extracts the four medications with doses kept as raw text', () => {
    const meds = byCategory(result.facts, 'medication');
    expect(meds.map((fact) => fact.label)).toEqual([
      'Aspirin',
      'Clopidogrel',
      'Atorvastatin',
      'Amlodipine',
    ]);
    const aspirin = meds[0];
    expect(aspirin.doseText).toContain('100 mg');
    expect(aspirin.doseText).toContain('once daily');
  });

  it('keeps the primary diagnosis whole and splits the secondary list', () => {
    const diagnoses = byCategory(result.facts, 'diagnosis');
    expect(diagnoses.map((fact) => fact.label)).toEqual([
      'Acute ischemic stroke, left middle cerebral artery territory',
      'Hypertension',
      'type 2 diabetes mellitus',
      'dyslipidemia',
    ]);
  });

  it('extracts follow-up, warning sign, and activity facts', () => {
    expect(byCategory(result.facts, 'follow-up')).toHaveLength(3);
    expect(byCategory(result.facts, 'warning-sign')).toHaveLength(3);
    expect(byCategory(result.facts, 'activity')).toHaveLength(3);
  });

  it('keeps relative dates exactly as written, never converted', () => {
    const followUps = byCategory(result.facts, 'follow-up');
    expect(followUps.some((fact) => fact.detail.includes('in two weeks'))).toBe(true);
    expect(followUps.some((fact) => fact.detail.includes('next week'))).toBe(true);
  });

  it('cites lines that really contain each fact quote', () => {
    for (const fact of result.facts) {
      expect(fact.status).toBe('verified');
      expect(validateDischargeFact(fact, result.sourceLines)).toBe(true);
      const cited = result.sourceLines.find((line) => line.id === fact.sourceLineIds[0]);
      expect(cited).toBeDefined();
      expect(cited?.text.replace(/\s+/g, ' ')).toContain(
        fact.sourceQuote.replace(/\s+/g, ' '),
      );
    }
  });

  it('points the aspirin fact at the aspirin line', () => {
    const aspirin = byCategory(result.facts, 'medication')[0];
    const line = result.sourceLines.find((entry) => entry.id === aspirin.sourceLineIds[0]);
    expect(line?.text).toContain('Aspirin 100 mg');
  });
});

describe('parseDischargeText with synthetic sample 2', () => {
  const result = parseDischargeText(sample2);

  it('extracts both medicines and flags the one without a dose', () => {
    const meds = byCategory(result.facts, 'medication');
    expect(meds.map((fact) => fact.label)).toEqual(['Metformin', 'Citicoline']);
    expect(meds[0].doseText).toContain('500 mg');
    expect(meds[1].flags).toContain('Dose not stated in the source line');
  });

  it('reports the illegible line instead of extracting it', () => {
    expect(result.unreadableLines).toHaveLength(1);
    expect(result.notes.some((note) => note.includes('unreadable'))).toBe(true);
    expect(result.facts.some((fact) => fact.detail.includes('illegible'))).toBe(false);
  });

  it('classifies the control line as follow-up and the fever line as a warning sign', () => {
    expect(byCategory(result.facts, 'follow-up')).toHaveLength(1);
    expect(byCategory(result.facts, 'warning-sign')).toHaveLength(1);
    expect(byCategory(result.facts, 'diagnosis')).toHaveLength(1);
  });
});

describe('validateDischargeFact', () => {
  it('rejects a fact whose quote does not appear in the cited line', () => {
    const result = parseDischargeText(sample1);
    const aspirin = byCategory(result.facts, 'medication')[0];
    const tampered: DischargeFact = { ...aspirin, sourceQuote: 'Aspirin 999 mg' };
    expect(validateDischargeFact(tampered, result.sourceLines)).toBe(false);
  });
});

describe('parseDischargeText with empty text', () => {
  it('extracts nothing and says what is missing', () => {
    const result = parseDischargeText('   ');
    expect(result.facts).toHaveLength(0);
    expect(result.notes.some((note) => note.includes('No medication lines'))).toBe(true);
  });
});
