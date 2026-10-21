// Document and Knowledge feature workspaces: Guideline Navigator and
// Plain-Language Translator. Self-contained modules; see the wiring notes
// returned with this feature build for route integration.

export { default as GuidelineNavigator } from './GuidelineNavigator';
export { default as PlainTranslator } from './PlainTranslator';
export { EvidenceCardView } from './GuidelineNavigator';
export {
  CARD_LABEL,
  CORPUS_REVIEW_DATE,
  EVIDENCE_CARDS,
  GUIDELINE_TOPICS,
} from './guideline-cards';
export type { EvidenceCard, GuidelineTopic } from './guideline-cards';
export { answerFromCards, scoreCards, DECISION_TREE, EXAMPLE_QUESTIONS } from './guideline-engine';
export { GLOSSARY, lookupTerm } from './glossary';
export {
  extractLockedElements,
  plainRewriteLocal,
  readabilityStats,
  verifyPreserved,
} from './plain-text';
