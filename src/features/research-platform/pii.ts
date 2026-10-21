// Local personal-data detection and masking for Privacy Shield.
//
// Everything in this module runs in the browser on text the person pasted
// into the page. Nothing is sent anywhere. The patterns deliberately mirror
// the server-side redaction layer in worker/src/redact.ts (same rule order,
// same neutral English markers) so what learners see here matches what the
// Worker would do before any text reaches a model provider. Two additions
// serve this tool's purpose, preparing text for sharing: bare calendar
// dates are masked as well (the Worker keeps them because they are usually
// clinical timeline dates), and names after honorifics or name labels are
// masked.
//
// This is pattern matching, not understanding. It can miss identifiers and
// it can mask words that are not identifiers. It is a learning and
// preparation aid, never a compliance tool or a guarantee.

export type PiiCategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'medical-record'
  | 'national-id'
  | 'date-of-birth'
  | 'date';

export interface PiiMatch {
  category: PiiCategory;
  /** Human readable label for the category, for the summary list. */
  label: string;
  /** The exact substring that was found, kept for the on-screen preview only. */
  original: string;
  /** The neutral marker that replaces it in the masked output. */
  replacement: string;
  /** Start index in the original text. */
  start: number;
  /** End index (exclusive) in the original text. */
  end: number;
}

export const PII_CATEGORY_LABELS: Record<PiiCategory, string> = {
  name: 'Name',
  email: 'Email address',
  phone: 'Phone number',
  'medical-record': 'Medical record number',
  'national-id': 'National ID number',
  'date-of-birth': 'Date of birth',
  date: 'Date',
};

interface Span {
  start: number;
  end: number;
}

interface Rule {
  category: PiiCategory;
  marker: string;
  find: (text: string, claimed: Span[]) => Span[];
}

function overlapsAny(span: Span, claimed: Span[]): boolean {
  return claimed.some((other) => span.start < other.end && other.start < span.end);
}

function regexSpans(pattern: RegExp, text: string): Span[] {
  const spans: Span[] = [];
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

function regexRule(category: PiiCategory, marker: string, pattern: RegExp): Rule {
  return {
    category,
    marker,
    find: (text, claimed) => regexSpans(pattern, text).filter((span) => !overlapsAny(span, claimed)),
  };
}

// Month names in English and Indonesian, shared by the date rules.
const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|' +
  'januari|februari|maret|mei|juni|juli|agustus|oktober|november|desember';

// --- Name scanning -------------------------------------------------------
// Honorifics and labels are found with a regex, then the name itself is
// scanned token by token: one to three capitalized words. Scanning by hand
// keeps the span exact and avoids guessing at name structure with a single
// large expression.

const HONORIFICS =
  /\b(?:Mr|Mrs|Ms|Miss|Dr|Prof|Bapak|Ibu|Tn|Ny|Nn|Sdr|Sdri)\.?\s+/g;
const NAME_LABELS = /\b(?:patient name|nama pasien|patient|name|nama|pasien)\s*[:#]\s*/gi;

// Capitalized words that are not personal names when they directly follow
// an honorific in Indonesian text (for example "Ibu Kota", capital city).
const NOT_A_NAME = new Set(['Kota', 'Rumah', 'Sakit', 'Negara', 'Tim']);

const NAME_TOKEN = /^[A-Z][A-Za-z]*(?:[-'][A-Za-z]+)?/;

/** Scan up to three capitalized name tokens starting at `from`. */
function scanNameTokens(text: string, from: number): Span | null {
  let cursor = from;
  let end = -1;
  let tokens = 0;
  while (tokens < 3) {
    const rest = text.slice(cursor);
    const token = NAME_TOKEN.exec(rest);
    if (!token) break;
    if (tokens === 0 && NOT_A_NAME.has(token[0])) return null;
    if (token[0].length < 2) break;
    end = cursor + token[0].length;
    tokens += 1;
    cursor = end;
    // Continue only across a single space followed by another capital.
    if (text[cursor] === ' ' && /[A-Z]/.test(text[cursor + 1] ?? '')) {
      cursor += 1;
    } else {
      break;
    }
  }
  if (tokens === 0 || end < 0) return null;
  return { start: from, end };
}

function nameSpans(text: string, claimed: Span[]): Span[] {
  const spans: Span[] = [];
  const taken = [...claimed];
  const claim = (span: Span | null) => {
    if (span && !overlapsAny(span, taken)) {
      spans.push(span);
      taken.push(span);
    }
  };
  // Labelled names: the label stays visible, only the name is masked.
  for (const match of text.matchAll(NAME_LABELS)) {
    const nameStart = (match.index ?? 0) + match[0].length;
    claim(scanNameTokens(text, nameStart));
  }
  // Honorific names: the honorific is part of the identifier phrase here,
  // so the whole phrase is masked.
  for (const match of text.matchAll(HONORIFICS)) {
    const start = match.index ?? 0;
    const nameSpan = scanNameTokens(text, start + match[0].length);
    if (nameSpan) claim({ start, end: nameSpan.end });
  }
  return spans;
}

// Rule order mirrors worker/src/redact.ts: labelled identifiers and long
// digit strings are claimed before the generic phone pattern can partially
// match them, and dates are claimed before phone numbers for the same
// reason. Name scanning runs last, on whatever text is still unclaimed.
const RULES: Rule[] = [
  regexRule(
    'email',
    '[email removed]',
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  ),
  regexRule(
    'medical-record',
    '[medical record number removed]',
    /\b(?:medical record(?: number)?|nomor rekam medis|rekam medis|no\.?\s*rm|mrn|mr)\s*(?:no\.?|number|nomor)?\s*[:#]?\s*\d[A-Za-z0-9-]{2,}\b/gi,
  ),
  regexRule('national-id', '[national id removed]', /\b\d{16}\b/g),
  regexRule('national-id', '[national id removed]', /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b/g),
  regexRule(
    'date-of-birth',
    '[date of birth removed]',
    new RegExp(
      `\\b(?:dob|date of birth|tanggal lahir|tgl\\.?\\s*lahir|born|lahir)\\s*[:#-]?\\s*(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4})`,
      'gi',
    ),
  ),
  // Bare calendar dates, in the numeric and written forms people paste.
  regexRule('date', '[date removed]', /\b\d{4}-\d{2}-\d{2}\b/g),
  regexRule('date', '[date removed]', /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g),
  regexRule(
    'date',
    '[date removed]',
    new RegExp(`\\b\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}\\b`, 'gi'),
  ),
  regexRule(
    'date',
    '[date removed]',
    new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi'),
  ),
  regexRule(
    'phone',
    '[phone number removed]',
    /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-])\d{3,4}[\s.-]\d{3,4}\b|\+\d{1,3}(?:[\s.-]?\d){7,13}\b|\b628\d{8,11}\b|\b08\d{2}(?:[\s.-]\d{3,4}){2}\b|\b0\d{9,12}\b/g,
  ),
  { category: 'name', marker: '[name removed]', find: nameSpans },
];

/** Detect likely personal identifiers in `text`, in reading order. */
export function detectPii(text: string): PiiMatch[] {
  const claimed: Span[] = [];
  const matches: PiiMatch[] = [];
  for (const rule of RULES) {
    for (const span of rule.find(text, claimed)) {
      claimed.push(span);
      matches.push({
        category: rule.category,
        label: PII_CATEGORY_LABELS[rule.category],
        original: text.slice(span.start, span.end),
        replacement: rule.marker,
        start: span.start,
        end: span.end,
      });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

export interface MaskResult {
  /** The text with every detected identifier replaced by its marker. */
  text: string;
  matches: PiiMatch[];
  /** Count of replacements per category (only categories that occurred). */
  counts: Partial<Record<PiiCategory, number>>;
  total: number;
}

/** Detect and mask identifiers in one pass. The input is never modified. */
export function maskPii(text: string): MaskResult {
  const matches = detectPii(text);
  const counts: Partial<Record<PiiCategory, number>> = {};
  let masked = '';
  let cursor = 0;
  for (const match of matches) {
    counts[match.category] = (counts[match.category] ?? 0) + 1;
    masked += text.slice(cursor, match.start) + match.replacement;
    cursor = match.end;
  }
  masked += text.slice(cursor);
  return { text: masked, matches, counts, total: matches.length };
}
