// Extraction entry points for the document labs.
// Pattern (mirroring src/ai/client.ts): a live AI path exists only when a
// structured endpoint is configured and the person has consented through
// the client consent flow. The shared contracts currently define no
// structured extraction endpoint, so the deterministic local rule engine
// is the active path and the UI labels it honestly as a local analysis.
// The personal-data guard runs first in every case: while likely personal
// data is present, nothing is analyzed and nothing leaves the device.

import { parseDischargeText } from './discharge-parser';
import { PiiBlockedError, scanForPii } from './pii';
import { extractRiskProfile } from './risk-parser';
import type { DischargeExtraction, RiskExtraction } from './types';

export type ExtractionEngine = 'local-rules';

export interface ExtractionOutcome<T> {
  data: T;
  engine: ExtractionEngine;
}

function guardAgainstPii(text: string): void {
  const findings = scanForPii(text);
  if (findings.length > 0) {
    throw new PiiBlockedError(findings);
  }
}

/**
 * Analyze discharge summary text. Throws PiiBlockedError when the local
 * guard finds likely personal data; the caller shows the findings and the
 * redaction action instead of a result.
 */
export async function analyzeDischargeText(
  text: string,
): Promise<ExtractionOutcome<DischargeExtraction>> {
  guardAgainstPii(text);
  // Live AI seam: when a structured extraction endpoint is added to the
  // shared contracts, it is called here first (after consent, through the
  // Worker) and this local parser becomes the fallback, exactly like the
  // offline guides back up the AI coach elsewhere in this product.
  return { data: parseDischargeText(text), engine: 'local-rules' };
}

/**
 * Analyze a free-text history into the fixed 10 factor profile.
 * Throws PiiBlockedError under the same rule as the discharge analysis.
 */
export async function analyzeRiskText(
  text: string,
): Promise<ExtractionOutcome<RiskExtraction>> {
  guardAgainstPii(text);
  return { data: extractRiskProfile(text), engine: 'local-rules' };
}
