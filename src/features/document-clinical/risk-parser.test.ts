import { describe, expect, it } from 'vitest';
import { extractRiskProfile } from './risk-parser';
import { RISK_SAMPLES } from './samples';
import type { RiskFactorId, RiskFactorStatus } from './types';

function statusOf(text: string, factor: RiskFactorId): RiskFactorStatus {
  const result = extractRiskProfile(text);
  const entry = result.results.find((item) => item.factor === factor);
  if (!entry) throw new Error(`missing factor ${factor}`);
  return entry.status;
}

describe('extractRiskProfile with fictional history 1', () => {
  const text = RISK_SAMPLES[0].text;
  const result = extractRiskProfile(text);
  const byId = (factor: RiskFactorId) => result.results.find((item) => item.factor === factor);

  it('always returns exactly the fixed 10 factors', () => {
    expect(result.results).toHaveLength(10);
    expect(new Set(result.results.map((item) => item.factor)).size).toBe(10);
  });

  it('marks the stated factors present with verbatim evidence', () => {
    for (const factor of ['hypertension', 'smoking', 'inactivity', 'dyslipidemia'] as const) {
      const entry = byId(factor);
      expect(entry?.status, factor).toBe('present');
      expect(entry?.evidenceSpan).toBeTruthy();
      expect(entry?.evidenceValid).toBe(true);
      expect(text).toContain(entry?.evidenceSpan ?? '');
    }
  });

  it('treats "no history of diabetes" as stated absent, not present', () => {
    const entry = byId('diabetes');
    expect(entry?.status).toBe('absent_stated');
    expect(entry?.evidenceSpan).toContain('no history of diabetes');
  });

  it('attributes the father stroke to family history, never to the patient', () => {
    expect(byId('prior-stroke-tia')?.status).toBe('not_mentioned');
    const family = byId('family-history');
    expect(family?.status).toBe('present');
    expect(family?.evidenceSpan).toContain('father had a stroke');
  });

  it('lists the unmentioned factors explicitly', () => {
    expect(result.notMentioned).toEqual(
      expect.arrayContaining(['atrial-fibrillation', 'obesity', 'alcohol', 'prior-stroke-tia']),
    );
    expect(result.notMentioned).not.toContain('hypertension');
  });
});

describe('extractRiskProfile with fictional history 2 (mostly stated absent)', () => {
  const text = RISK_SAMPLES[1].text;

  it('marks smoking, alcohol, atrial fibrillation, and family history as stated absent', () => {
    expect(statusOf(text, 'smoking')).toBe('absent_stated');
    expect(statusOf(text, 'alcohol')).toBe('absent_stated');
    expect(statusOf(text, 'atrial-fibrillation')).toBe('absent_stated');
    expect(statusOf(text, 'family-history')).toBe('absent_stated');
  });

  it('reads a normal range statement and an explicit "no diabetes" as stated absent', () => {
    expect(statusOf(text, 'hypertension')).toBe('absent_stated');
    expect(statusOf(text, 'diabetes')).toBe('absent_stated');
  });

  it('does not leak the family history sentence into the patient stroke factor', () => {
    expect(statusOf(text, 'prior-stroke-tia')).toBe('not_mentioned');
  });

  it('keeps daily walking as not mentioned for inactivity instead of inventing absent', () => {
    expect(statusOf(text, 'inactivity')).toBe('not_mentioned');
  });
});

describe('extractRiskProfile with the Indonesian fictional history', () => {
  const text = RISK_SAMPLES[2].text;
  const result = extractRiskProfile(text);
  const byId = (factor: RiskFactorId) => result.results.find((item) => item.factor === factor);

  it('finds hypertension, diabetes, dyslipidemia in Bahasa Indonesia', () => {
    expect(byId('hypertension')?.status).toBe('present');
    expect(byId('diabetes')?.status).toBe('present');
    expect(byId('dyslipidemia')?.status).toBe('present');
  });

  it('counts a former smoker as present with a former smoker note', () => {
    const smoking = byId('smoking');
    expect(smoking?.status).toBe('present');
    expect(smoking?.note).toContain('Former smoker');
  });

  it('attributes the mother stroke to family history only', () => {
    expect(byId('family-history')?.status).toBe('present');
    expect(byId('prior-stroke-tia')?.status).toBe('not_mentioned');
  });
});

describe('negation and attribution rules', () => {
  it('honors stacked negations in one sentence', () => {
    const text = 'He has no history of diabetes and no hypertension.';
    expect(statusOf(text, 'diabetes')).toBe('absent_stated');
    expect(statusOf(text, 'hypertension')).toBe('absent_stated');
  });

  it('honors Indonesian negation', () => {
    expect(statusOf('Tidak ada riwayat diabetes pada pasien ini.', 'diabetes')).toBe(
      'absent_stated',
    );
  });

  it('does not attribute a relative condition to the patient or to stroke family history', () => {
    const text = 'His mother has hypertension and takes amlodipine.';
    expect(statusOf(text, 'hypertension')).toBe('not_mentioned');
    expect(statusOf(text, 'family-history')).toBe('not_mentioned');
  });

  it('marks the patient own previous stroke as present', () => {
    expect(statusOf('She had a stroke two years ago and recovered well.', 'prior-stroke-tia')).toBe(
      'present',
    );
  });

  it('reads a stated BMI in the obese range as obesity present', () => {
    expect(statusOf('Her BMI is 34 and she is being counseled on weight.', 'obesity')).toBe(
      'present',
    );
  });

  it('reads an explicit denial of smoking as stated absent', () => {
    expect(statusOf('He denies smoking and never drank alcohol.', 'smoking')).toBe('absent_stated');
    expect(statusOf('He denies smoking and never drank alcohol.', 'alcohol')).toBe('absent_stated');
  });
});
