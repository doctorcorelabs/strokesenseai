import { describe, expect, it } from 'vitest';
import { redactPii, scanForPii } from './pii';
import { DISCHARGE_SAMPLES, RISK_SAMPLES } from './samples';

describe('scanForPii', () => {
  it('finds a grouped 16 digit national identity number', () => {
    const findings = scanForPii('NIK on file: 3201 0101 0101 0001, admitted yesterday.');
    expect(findings.some((finding) => finding.kind === 'national-id')).toBe(true);
  });

  it('finds an Indonesian mobile phone number', () => {
    const findings = scanForPii('Call the family at 0812 3456 7890 after rounds.');
    expect(findings.some((finding) => finding.kind === 'phone')).toBe(true);
  });

  it('finds an email address', () => {
    const findings = scanForPii('Send the report to budi.santoso@example.com please.');
    expect(findings.some((finding) => finding.kind === 'email')).toBe(true);
  });

  it('finds a labelled name', () => {
    const findings = scanForPii('Name: Budi Santoso\nDiagnosis: stroke');
    expect(findings.some((finding) => finding.kind === 'labelled-name')).toBe(true);
  });

  it('finds a name with an honorific', () => {
    const findings = scanForPii('Ny. Sari visited the clinic for control.');
    expect(findings.some((finding) => finding.kind === 'honorific-name')).toBe(true);
  });

  it('finds a date of birth reference', () => {
    const findings = scanForPii('Date of birth: 12/05/1960. Diagnosis: stroke.');
    expect(findings.some((finding) => finding.kind === 'date-of-birth')).toBe(true);
  });

  it('does not flag ordinary clinical numbers such as doses and ages', () => {
    const findings = scanForPii(
      'Aspirin 100 mg once daily for a 68-year-old. Fever above 38 degrees. Call 119 if needed.',
    );
    expect(findings).toHaveLength(0);
  });

  it('reports no findings in any built-in synthetic sample', () => {
    for (const sample of [...DISCHARGE_SAMPLES, ...RISK_SAMPLES]) {
      expect(scanForPii(sample.text), sample.id).toHaveLength(0);
    }
  });
});

describe('redactPii', () => {
  it('replaces findings so a rescan is clean', () => {
    const text = 'NIK 3201010101010001 and phone 0812 3456 7890.';
    const findings = scanForPii(text);
    expect(findings.length).toBeGreaterThan(0);
    const redacted = redactPii(text, findings);
    expect(redacted).not.toContain('3201010101010001');
    expect(redacted).not.toContain('0812');
    expect(scanForPii(redacted)).toHaveLength(0);
  });

  it('returns the text unchanged when there are no findings', () => {
    const text = 'A short clean history.';
    expect(redactPii(text, [])).toBe(text);
  });
});
