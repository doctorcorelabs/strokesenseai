// Two-stage document kind detection for Document Studio.
// Stage one probes for discharge-summary section markers by running the
// real discharge parser and counting how many distinct sections produced
// facts. Stage two probes for a health history by running the real risk
// extractor and counting stated factors, plus a few narrative markers.
// Both extractions are always computed in full and returned, so a hybrid
// document never produces an empty result: detection only decides which
// block leads, never which block exists. Everything runs locally.

import { parseDischargeText } from '../../document-clinical/discharge-parser';
import { extractRiskProfile } from '../../document-clinical/risk-parser';
import type { DischargeExtraction, RiskExtraction } from '../../document-clinical/types';

export type DocumentKind = 'discharge' | 'history' | 'unknown';

export interface DetectionResult {
  kind: DocumentKind;
  /** Distinct discharge sections (of 5) that produced at least one fact. */
  dischargeSections: number;
  /** Risk factors stated present or stated absent (of 10). */
  riskFactorsFound: number;
  /** Narrative history markers found (first person, family history, habits). */
  narrativeMarkers: number;
  discharge: DischargeExtraction;
  risk: RiskExtraction;
}

const NARRATIVE_PATTERNS: RegExp[] = [
  /\b(i|he|she|the patient) (has|have|had) (a )?(history|riwayat)\b/i,
  /\bhistory of\b/i,
  /\briwayat\b/i,
  /\b(father|mother|parent|family) (had|has|mengalami|pernah)\b/i,
  /\b(smokes|smoking|stopped smoking|berhenti merokok|merokok)\b/i,
  /\bfor (ten|five|twenty|\d+) years\b/i,
];

/**
 * Detect the document kind and compute both extractions.
 * Decision rules (from the rebuild design, section on Discharge Checker):
 * - Two or more discharge sections found: discharge summary.
 * - Otherwise, three or more stated risk factors and no discharge
 *   sections: health history.
 * - Otherwise the higher probe wins; a tie or both probes near zero is
 *   reported honestly as 'unknown'.
 */
export function detectDocument(text: string): DetectionResult {
  const discharge = parseDischargeText(text);
  const risk = extractRiskProfile(text);

  const dischargeSections = new Set(discharge.facts.map((fact) => fact.category)).size;
  const riskFactorsFound = risk.results.filter(
    (result) => result.status !== 'not_mentioned',
  ).length;
  const narrativeMarkers = NARRATIVE_PATTERNS.filter((pattern) => pattern.test(text)).length;

  let kind: DocumentKind;
  if (dischargeSections >= 2) {
    kind = 'discharge';
  } else if (riskFactorsFound >= 3 && dischargeSections === 0) {
    kind = 'history';
  } else if (dischargeSections === 0 && riskFactorsFound === 0) {
    kind = 'unknown';
  } else if (dischargeSections > 0 && dischargeSections >= riskFactorsFound) {
    kind = 'discharge';
  } else if (riskFactorsFound > dischargeSections) {
    kind = 'history';
  } else {
    kind = 'unknown';
  }

  return { kind, dischargeSections, riskFactorsFound, narrativeMarkers, discharge, risk };
}
