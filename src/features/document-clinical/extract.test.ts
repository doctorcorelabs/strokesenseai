import { describe, expect, it } from 'vitest';
import { analyzeDischargeText, analyzeRiskText } from './extract';
import { PiiBlockedError } from './pii';
import { DISCHARGE_SAMPLES, RISK_SAMPLES } from './samples';

describe('analyzeDischargeText', () => {
  it('analyzes a clean synthetic sample with the local engine', async () => {
    const outcome = await analyzeDischargeText(DISCHARGE_SAMPLES[0].text);
    expect(outcome.engine).toBe('local-rules');
    expect(outcome.data.facts.length).toBeGreaterThan(10);
  });

  it('blocks analysis and reports findings when personal data is present', async () => {
    const dirty = 'Name: Budi Santoso\nDiagnosis: Acute ischemic stroke';
    await expect(analyzeDischargeText(dirty)).rejects.toBeInstanceOf(PiiBlockedError);
    try {
      await analyzeDischargeText(dirty);
      expect.unreachable('should have thrown');
    } catch (caught) {
      expect(caught).toBeInstanceOf(PiiBlockedError);
      const findings = (caught as PiiBlockedError).findings;
      expect(findings.some((finding) => finding.kind === 'labelled-name')).toBe(true);
    }
  });
});

describe('analyzeRiskText', () => {
  it('returns the fixed 10 factor profile for a clean sample', async () => {
    const outcome = await analyzeRiskText(RISK_SAMPLES[0].text);
    expect(outcome.engine).toBe('local-rules');
    expect(outcome.data.results).toHaveLength(10);
  });

  it('blocks analysis when a phone number is present', async () => {
    await expect(
      analyzeRiskText('Family can be reached at 0812 3456 7890. He smokes daily.'),
    ).rejects.toBeInstanceOf(PiiBlockedError);
  });
});
