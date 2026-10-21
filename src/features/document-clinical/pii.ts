// Local personal-data guard for the document labs (PiiGuard in PLANNING.md
// section 6.6). It runs entirely in the browser, before any analysis, and
// blocks the workflow while likely personal data is present. It is a
// deterministic pattern check, not a guarantee: it catches common shapes
// (national id numbers, phone numbers, emails, labelled names, birth
// dates) and the person stays responsible for what they paste.

import type { PiiFinding, PiiKind } from './types';

interface PiiPattern {
  kind: PiiKind;
  regex: RegExp;
  description: string;
}

const PATTERNS: PiiPattern[] = [
  {
    kind: 'national-id',
    // Indonesian NIK: 16 digits, optionally grouped with spaces or dashes.
    regex: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    description: 'A 16 digit number that looks like a national identity number (NIK).',
  },
  {
    kind: 'national-id',
    regex: /\b(?:NIK|KTP)\s*(?:no\.?|number|nomor)?\s*[:#]?\s*\d{6,}/gi,
    description: 'A number written next to a national identity label (NIK or KTP).',
  },
  {
    kind: 'phone',
    // Indonesian mobile numbers first, then any long digit run with separators.
    regex: /(?:\+62|62|0)8\d{2,3}[ -]?\d{3,4}[ -]?\d{3,5}\b/g,
    description: 'A phone number.',
  },
  {
    kind: 'phone',
    regex: /\b\d[\d -]{7,13}\d\b/g,
    description: 'A long number that could be a phone number.',
  },
  {
    kind: 'email',
    regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
    description: 'An email address.',
  },
  {
    kind: 'date-of-birth',
    regex:
      /(?:date of birth|dob|born on|born in|tanggal lahir|tgl\.? lahir)\s*[:\-]?\s*(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}|[A-Z][a-z]+ \d{1,2},? \d{4})?/gi,
    description: 'A date of birth or birth reference.',
  },
  {
    kind: 'medical-record-number',
    regex: /(?:medical record|rekam medis|mrn|no\.?\s*rm)\s*(?:no\.?|number)?\s*[:#]?\s*[A-Z0-9-]{4,}/gi,
    description: 'A medical record number.',
  },
  {
    kind: 'labelled-name',
    regex:
      /(?:Patient name|patient name|Full name|full name|Name|name|Nama pasien|nama pasien|Nama|nama)\s*:\s*[A-Z][^\n,;:]{1,60}/g,
    description: 'A name written next to a name label.',
  },
  {
    kind: 'honorific-name',
    regex: /\b(?:Mr|Mrs|Ms|Miss|Tn|Ny|Sdr|Sdri)\.\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g,
    description: 'A name written with an honorific (Mr, Mrs, Ny, and similar).',
  },
];

/**
 * Scan text for likely personal data. Overlapping matches are merged so
 * the same number is never reported twice.
 */
export function scanForPii(text: string): PiiFinding[] {
  const raw: PiiFinding[] = [];
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      const value = match[0];
      if (!value || match.index === undefined) continue;
      // The loose "long number" pattern must carry at least 9 digits to be
      // phone-like; smaller runs are doses, ages, and lab values.
      const digitCount = value.replace(/\D/g, '').length;
      if (pattern.description.startsWith('A long number') && digitCount < 9) continue;
      raw.push({
        kind: pattern.kind,
        match: value,
        index: match.index,
        description: pattern.description,
      });
    }
  }
  raw.sort((a, b) => a.index - b.index || b.match.length - a.match.length);
  const merged: PiiFinding[] = [];
  let coveredUntil = -1;
  for (const finding of raw) {
    if (finding.index < coveredUntil) continue;
    merged.push(finding);
    coveredUntil = finding.index + finding.match.length;
  }
  return merged;
}

/** Replace every finding in the text with a fixed "[removed]" marker. */
export function redactPii(text: string, findings: PiiFinding[]): string {
  if (findings.length === 0) return text;
  const ordered = [...findings].sort((a, b) => a.index - b.index);
  let out = '';
  let cursor = 0;
  for (const finding of ordered) {
    if (finding.index < cursor) continue;
    out += text.slice(cursor, finding.index);
    out += '[removed]';
    cursor = finding.index + finding.match.length;
  }
  out += text.slice(cursor);
  return out;
}

/** Thrown by the extraction entry points when personal data blocks analysis. */
export class PiiBlockedError extends Error {
  readonly findings: PiiFinding[];

  constructor(findings: PiiFinding[]) {
    super(
      'Possible personal data was found in the text. Remove or redact it before running the analysis.',
    );
    this.name = 'PiiBlockedError';
    this.findings = findings;
  }
}
