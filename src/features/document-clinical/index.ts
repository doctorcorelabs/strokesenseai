// Barrel for the Document and Data AI labs built in this folder.
// Wiring: render <DischargeLens /> for route '#lab/discharge-lens' and
// <RiskExtractor /> for route '#lab/risk-extractor' (registry ids
// 'discharge-lens' and 'risk-extractor'). Both components import
// document-clinical.css themselves.

export { default as DischargeLens } from './DischargeLens';
export { default as RiskExtractor } from './RiskExtractor';
export { analyzeDischargeText, analyzeRiskText } from './extract';
export type { ExtractionEngine, ExtractionOutcome } from './extract';
export { parseDischargeText, validateDischargeFact, dischargeCategoryLabel, CARE_TEAM_QUESTIONS } from './discharge-parser';
export { extractRiskProfile, riskFactorLabel, riskFactorEducation, RISK_FACTORS } from './risk-parser';
export { scanForPii, redactPii, PiiBlockedError } from './pii';
export { DISCHARGE_SAMPLES, RISK_SAMPLES } from './samples';
export type { DocumentSample } from './samples';
export type {
  DischargeCategory,
  DischargeExtraction,
  DischargeFact,
  PiiFinding,
  PiiKind,
  RiskExtraction,
  RiskFactorId,
  RiskFactorResult,
  RiskFactorStatus,
  SourceLine,
  SourceSentence,
} from './types';
