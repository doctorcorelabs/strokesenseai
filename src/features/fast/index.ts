// Digital FAST Multimodal Lab: public surface for integration.
//
// Route id (from shared/registry.ts): digital-fast-multimodal,
// hash route #lab/digital-fast-multimodal. Render the default export (or
// the named DigitalFastMultimodalLab) for that route. The component is
// self-contained: page header, maturity and mode badges, emergency
// banner, symptom gate, the three stages, the summary, and the AI coach
// (tool "fast", module "digital-fast-multimodal") are all included.
export { default } from './DigitalFastSession';
export { default as DigitalFastMultimodalLab } from './DigitalFastSession';
export {
  CLOSING_LINE,
  STANDARD_SENTENCE,
  STAGES,
  buildSummary,
  createSession,
  stageDef,
  wordOverlap,
} from './session';
export type {
  CheckStatus,
  DataQuality,
  SessionPhase,
  SessionState,
  SessionSummary,
  StageDef,
  StageId,
  StageSummary,
} from './session';
export { buildInterpretationContext, localInterpretation } from './interpret';
