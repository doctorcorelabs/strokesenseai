// PII redaction layer. Runs in the Worker after validation and before any
// prompt is assembled, so obvious identifiers never reach a model provider.
// Replacements are neutral English markers in square brackets. The count of
// redactions may be logged; the original values never are.

interface RedactionRule {
  pattern: RegExp;
  marker: string;
}

// Order matters: labelled identifiers and long digit strings are claimed
// before the generic phone pattern can partially match them. In
// particular the spaced NIK rule runs before the phone rule, because the
// phone pattern would otherwise swallow the first three NIK groups and
// leave the last group behind in the text.
const RULES: RedactionRule[] = [
  {
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    marker: '[email removed]',
  },
  {
    // Labelled medical record numbers, English and Indonesian labels.
    // The label only counts when a digit follows within a few characters
    // (optional "no."/"number"/"nomor", optional colon, then the number),
    // so clinical uses of the same letters survive: "MR angiography",
    // "MR grade 3", and the honorific "Mr" are not record numbers.
    pattern:
      /\b(?:medical record(?: number)?|nomor rekam medis|rekam medis|no\.?\s*rm|mrn|mr)\s*(?:no\.?|number|nomor)?\s*[:#]?\s*\d[A-Za-z0-9-]{2,}\b/gi,
    marker: '[medical record number removed]',
  },
  {
    // Indonesian national identity number (NIK): exactly 16 digits,
    // written contiguously or in the common grouped form of four groups
    // of four digits separated by spaces or hyphens.
    pattern: /\b\d{16}\b/g,
    marker: '[national id removed]',
  },
  {
    pattern: /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/g,
    marker: '[national id removed]',
  },
  {
    // Labelled dates of birth in common formats: 12/03/1985, 1985-03-12,
    // 12 March 1985, March 12, 1985. The Indonesian labels include the
    // everyday short forms "lahir" and "tgl lahir"; the label must sit
    // directly in front of the date, so a bare clinical date in running
    // text (an onset or last-known-well date) is never touched by this
    // rule. Bare dates are deliberately NOT redacted anywhere in this
    // file: in stroke education text a bare date is far more often a
    // clinically essential onset or last-known-well date than an
    // identifier, and removing it would destroy the timeline the user is
    // asking about. Birth dates stay protected whenever a birth label is
    // present, in every format above including ISO.
    pattern:
      /\b(?:dob|date of birth|tanggal lahir|tgl\.?\s*lahir|born|lahir)\s*[:#-]?\s*(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})/gi,
    marker: '[date of birth removed]',
  },
  {
    // Phone numbers: international format with or without the plus sign
    // (Indonesian numbers are often written as a bare 628... string),
    // grouped formats with separators, and Indonesian local format
    // starting with 0, contiguous or in spaced groups.
    pattern:
      /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-])\d{3,4}[\s.-]\d{3,4}\b|\+\d{1,3}(?:[\s.-]?\d){7,13}\b|\b628\d{8,11}\b|\b08\d{2}(?:[\s.-]\d{3,4}){2}\b|\b0\d{9,12}\b/g,
    marker: '[phone number removed]',
  },
];

export function redactPii(text: string): { text: string; count: number } {
  let count = 0;
  let result = text;
  for (const rule of RULES) {
    result = result.replace(rule.pattern, () => {
      count += 1;
      return rule.marker;
    });
  }
  return { text: result, count };
}
