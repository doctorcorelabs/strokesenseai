// Rule-based local parser for Discharge Lens AI.
// Pipeline (a local, deterministic subset of PLANNING.md section 6.6):
// the pasted text is split into numbered lines; section headers and
// keyword rules assign each line to a category; every fact keeps the
// exact quote it came from; a verbatim re-check then decides whether the
// fact may be shown as verified. Doses stay as raw text and relative
// dates ("in two weeks") are never converted into calendar dates.

import { findVerbatimSpan, splitIntoLines, stripBullet } from './text-utils';
import type { DischargeCategory, DischargeExtraction, DischargeFact, SourceLine } from './types';

const CATEGORY_LABELS: Record<DischargeCategory, string> = {
  diagnosis: 'Diagnoses',
  medication: 'Medications',
  'follow-up': 'Follow-up',
  'warning-sign': 'Warning signs',
  activity: 'Activity and diet',
};

export function dischargeCategoryLabel(category: DischargeCategory): string {
  return CATEGORY_LABELS[category];
}

const HEADER_PATTERNS: { category: DischargeCategory; regex: RegExp }[] = [
  { category: 'diagnosis', regex: /^(primary |secondary |admission |discharge )?(diagnos[ei]s|diagnosa|assessment)\b/i },
  { category: 'medication', regex: /^(medications?|medicines?|drugs?|prescriptions?|obat|pengobatan)\b/i },
  { category: 'follow-up', regex: /^(follow[ -]?up|kontrol|control|appointments?|review plan|rencana kontrol)\b/i },
  { category: 'warning-sign', regex: /^(warning signs?|red flags?|tanda bahaya|seek (help|care)|when to (return|seek|call))\b/i },
  { category: 'activity', regex: /^(activity|activities|diet|aktivitas|lifestyle|rehabilitation|physiotherapy|instructions?|advice)\b/i },
];

const DRUG_NAMES = [
  'aspirin', 'clopidogrel', 'ticagrelor', 'prasugrel', 'atorvastatin', 'simvastatin',
  'rosuvastatin', 'ezetimibe', 'amlodipine', 'nifedipine', 'diltiazem', 'lisinopril',
  'ramipril', 'losartan', 'valsartan', 'candesartan', 'bisoprolol', 'metoprolol',
  'carvedilol', 'furosemide', 'spironolactone', 'hydrochlorothiazide', 'metformin',
  'glimepiride', 'gliclazide', 'insulin', 'warfarin', 'apixaban', 'rivaroxaban',
  'dabigatran', 'heparin', 'enoxaparin', 'omeprazole', 'pantoprazole', 'paracetamol',
  'acetaminophen', 'ibuprofen', 'gabapentin', 'pregabalin', 'levetiracetam',
  'phenytoin', 'valproate', 'carbamazepine', 'amitriptyline', 'sertraline',
  'citicoline', 'piracetam', 'digoxin', 'amiodarone', 'folic acid', 'mecobalamin',
];

const DOSE_PATTERN = /\d+(?:[.,]\d+)?\s?(?:mg|mcg|g|ml|iu|units?)\b/i;
const MEDICATION_SHAPE = /\b(tablets?|capsules?|once daily|twice daily|three times daily|at night|in the morning|after (?:breakfast|meals?)|before (?:breakfast|meals?)|\bBID\b|\bTID\b|\bOD\b)\b/i;

const WARNING_CUES =
  /\b(warning|red flag|emergency|seek|call 119|call 112|go to|return to|come back to|if you (?:notice|have|develop|feel|see)|tanda bahaya|segera|igd|unit gawat darurat)\b/i;
const FOLLOWUP_CUES =
  /\b(follow[ -]?up|appointment|clinic|klinik|return in|review|kontrol|control|check (?:at|in|again)|visit|jadwal)\b/i;
const ACTIVITY_CUES =
  /\b(walk|walking|exercise|rest|diet|low salt|salt|fried food|physiotherapy|rehab|lifting|lift heavy|driving|drive|no smoking|no alcohol|avoid|hindari|olahraga|jalan kaki)\b/i;
const DIAGNOSIS_CUES =
  /\b(diagnos(?:ed|is|es)|stroke|infarct|hemorrhage|haemorrhage|hypertension|diabetes|dyslipidemia|atrial fibrillation|pneumonia)\b/i;

interface ParsedLine {
  line: SourceLine;
  category: DischargeCategory | null;
  /** The text to extract facts from (header prefix and bullet removed). */
  content: string;
  /** The full line (bullet removed) shown as the fact detail. */
  detail: string;
}

function matchHeader(text: string): { category: DischargeCategory; rest: string } | null {
  for (const { category, regex } of HEADER_PATTERNS) {
    const match = regex.exec(text);
    if (!match) continue;
    const rest = text.slice(match[0].length).replace(/^\s*[:\-]\s*/, '').trim();
    return { category, rest };
  }
  return null;
}

function findDrug(content: string): { name: string; at: number } | null {
  const lower = content.toLowerCase();
  for (const drug of DRUG_NAMES) {
    const at = lower.indexOf(drug);
    if (at !== -1) {
      return { name: content.slice(at, at + drug.length), at };
    }
  }
  return null;
}

function classifyFreeLine(content: string, position: number): DischargeCategory | null {
  if (findDrug(content) || (DOSE_PATTERN.test(content) && MEDICATION_SHAPE.test(content))) {
    return 'medication';
  }
  if (WARNING_CUES.test(content)) return 'warning-sign';
  if (FOLLOWUP_CUES.test(content)) return 'follow-up';
  if (DIAGNOSIS_CUES.test(content) && (/\bdiagnos/i.test(content) || position < 2)) {
    return 'diagnosis';
  }
  if (ACTIVITY_CUES.test(content)) return 'activity';
  return null;
}

function looksUnreadable(text: string): boolean {
  if (/illegible|unreadable|tidak terbaca/i.test(text)) return true;
  const stripped = stripBullet(text).replace(/[\s\-_*•·.,;:()]/g, '');
  if (stripped.length < 4) return false;
  const readable = stripped.replace(/[^A-Za-z0-9]/g, '').length;
  return readable / stripped.length < 0.55;
}

let factCounter = 0;

function makeFact(
  category: DischargeCategory,
  label: string,
  detail: string,
  line: SourceLine,
  quote: string,
  doseText: string | null,
  flags: string[],
): DischargeFact {
  factCounter += 1;
  const verified = findVerbatimSpan(line.text, quote) !== null;
  return {
    id: `fact-${line.id}-${factCounter}`,
    category,
    label,
    detail,
    doseText,
    flags,
    sourceLineIds: [line.id],
    sourceQuote: quote,
    status: verified ? 'verified' : 'unverified',
  };
}

function factsForLine(parsed: ParsedLine): DischargeFact[] {
  const { line, category, content, detail } = parsed;
  if (!category || !content) return [];
  if (category === 'medication') {
    const drug = findDrug(content);
    if (drug) {
      const after = content
        .slice(drug.at + drug.name.length)
        .replace(/^\s*[,:\-]\s*/, '')
        .trim();
      const flags: string[] = [];
      if (!DOSE_PATTERN.test(content)) flags.push('Dose not stated in the source line');
      return [
        makeFact(
          category,
          drug.name,
          detail,
          line,
          content,
          after.length > 0 ? after : null,
          flags,
        ),
      ];
    }
    return [makeFact(category, content, detail, line, content, null, [])];
  }
  if (category === 'diagnosis' && content.includes(',')) {
    // A diagnosis line can list several problems on one line; with three
    // or more comma items each becomes its own fact citing the same line.
    // Two parts are usually one diagnosis plus its detail, kept whole.
    const items = content
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 1);
    if (items.length >= 3) {
      return items.map((item) => makeFact(category, item, detail, line, item, null, []));
    }
  }
  return [makeFact(category, content, detail, line, content, null, [])];
}

/**
 * Verify a discharge fact against source lines: the fact is verified only
 * when its quote is a verbatim substring of the lines it cites. Exported
 * so the deterministic check can be unit tested on its own, including
 * against facts that did not come from this parser.
 */
export function validateDischargeFact(fact: DischargeFact, lines: SourceLine[]): boolean {
  const cited = lines
    .filter((line) => fact.sourceLineIds.includes(line.id))
    .map((line) => line.text)
    .join('\n');
  if (!cited) return false;
  return findVerbatimSpan(cited, fact.sourceQuote) !== null;
}

/** Parse discharge summary text into cited, structured facts. Pure. */
export function parseDischargeText(text: string): DischargeExtraction {
  factCounter = 0;
  const sourceLines = splitIntoLines(text);
  const unreadableLines: SourceLine[] = [];
  const parsed: ParsedLine[] = [];
  let section: DischargeCategory | null = null;
  let position = 0;

  for (const line of sourceLines) {
    if (looksUnreadable(line.text)) {
      unreadableLines.push(line);
      continue;
    }
    const header = matchHeader(line.text);
    if (header) {
      if (header.rest && !header.rest.endsWith(':')) {
        // A header that carries its own content ("Diagnosis: ...",
        // "Control again in one month ...") classifies only its own line;
        // it does not open a section for the lines that follow.
        parsed.push({
          line,
          category: header.category,
          content: stripBullet(header.rest),
          detail: stripBullet(line.text),
        });
        position += 1;
      } else {
        // A bare header, or one whose remainder ends with a colon as an
        // instruction introducing the lines below, opens a section.
        section = header.category;
      }
      continue;
    }
    const content = stripBullet(line.text);
    const category = section ?? classifyFreeLine(content, position);
    parsed.push({ line, category, content, detail: content });
    position += 1;
  }

  const facts = parsed.flatMap(factsForLine);
  const notes: string[] = [];
  const present = new Set(facts.map((fact) => fact.category));
  if (!present.has('medication')) {
    notes.push('No medication lines were recognized. Check the original document by eye.');
  }
  if (!present.has('follow-up')) {
    notes.push('No follow-up lines were recognized. Check the original document by eye.');
  }
  if (unreadableLines.length > 0) {
    notes.push(
      `${unreadableLines.length} line(s) look unreadable and were not extracted. Read them on the original document.`,
    );
  }
  return { facts, sourceLines, unreadableLines, notes };
}

/** Static, ready-to-use questions for the care team (template, not advice). */
export const CARE_TEAM_QUESTIONS: string[] = [
  'Which medicines should never be stopped suddenly, and what should we do if a dose is missed?',
  'Which warning signs mean we should go straight to the emergency department?',
  'When exactly is the next control visit, and which clinic do we visit?',
  'Are there foods, activities, or other medicines to avoid with this prescription?',
  'Who do we contact outside clinic hours if something changes?',
];
