// Shared types for the Document and Data AI labs (Discharge Lens AI and
// Risk Factor Extractor). Everything in this folder runs locally in the
// browser: no document text, history text, or extraction result is sent
// anywhere or stored. See PLANNING.md section 6.6 for the design contract.

/** One numbered line of the input text, exactly as the person pasted it. */
export interface SourceLine {
  /** 1-based line number shown in the UI and cited by facts. */
  id: number;
  /** The line text, trimmed of surrounding whitespace only. */
  text: string;
}

/** A sentence of the input text with its exact character span. */
export interface SourceSentence {
  /** 0-based sentence index. */
  index: number;
  /** The exact sentence text (a true substring of the input). */
  text: string;
  start: number;
  end: number;
}

export type DischargeCategory =
  | 'diagnosis'
  | 'medication'
  | 'follow-up'
  | 'warning-sign'
  | 'activity';

export interface DischargeFact {
  id: string;
  category: DischargeCategory;
  /** Short headline for the fact, always a verbatim slice of a source line. */
  label: string;
  /** Fuller display text (usually the whole source line, bullet removed). */
  detail: string;
  /** Medications only: the dose and schedule kept as raw source text. */
  doseText: string | null;
  /** Extra deterministic flags, for example a medication with no dose stated. */
  flags: string[];
  /** Line numbers this fact cites. */
  sourceLineIds: number[];
  /** The exact quote the fact rests on; validated against the cited lines. */
  sourceQuote: string;
  /** 'verified' only when the quote is a verbatim substring of the cited lines. */
  status: 'verified' | 'unverified';
}

export interface DischargeExtraction {
  facts: DischargeFact[];
  sourceLines: SourceLine[];
  /** Lines that look unreadable (marked illegible or mostly symbols). */
  unreadableLines: SourceLine[];
  /** Deterministic observations, for example a category that found nothing. */
  notes: string[];
}

export type RiskFactorId =
  | 'hypertension'
  | 'diabetes'
  | 'atrial-fibrillation'
  | 'smoking'
  | 'dyslipidemia'
  | 'prior-stroke-tia'
  | 'obesity'
  | 'inactivity'
  | 'alcohol'
  | 'family-history';

export type RiskFactorStatus = 'present' | 'absent_stated' | 'not_mentioned';

export interface RiskFactorResult {
  factor: RiskFactorId;
  /** Display name of the factor. */
  label: string;
  status: RiskFactorStatus;
  /** Exact sentence quoted as evidence, or null when not mentioned. */
  evidenceSpan: string | null;
  /** 0-based index of the evidence sentence, or null. */
  evidenceSentenceIndex: number | null;
  /** True when the evidence span is a verbatim substring of the input. */
  evidenceValid: boolean;
  /** Optional deterministic qualifier, for example a former smoker. */
  note: string | null;
}

export interface RiskExtraction {
  /** Always exactly the fixed 10 factors, in profile order. */
  results: RiskFactorResult[];
  /** Factors with status 'not_mentioned', listed explicitly, never hidden. */
  notMentioned: RiskFactorId[];
  sentences: SourceSentence[];
}

export type PiiKind =
  | 'national-id'
  | 'phone'
  | 'email'
  | 'date-of-birth'
  | 'labelled-name'
  | 'honorific-name'
  | 'medical-record-number';

export interface PiiFinding {
  kind: PiiKind;
  /** The matched text (shown back only so the person can remove it). */
  match: string;
  /** Character offset of the match in the scanned text. */
  index: number;
  /** Plain-language description of what was found. */
  description: string;
}
