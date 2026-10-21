// Speech core feature module: the two speech tools that share the local
// recording, transcription, and deterministic analysis pipeline.
//
// Wiring (done by the integrator, not here):
// - Route ids come from shared/registry.ts: '#lab/speech-analyzer' and
//   '#lab/nihss-language-assistant'.
// - Render SPEECH_CORE_COMPONENTS[featureId] inside the lab page for those
//   two ids, the same place LabPage currently renders its guided
//   walkthrough panel.

import type { ComponentType } from 'react';
import NihssLanguageAssistant from './NihssLanguageAssistant';
import SpeechAnalyzer from './SpeechAnalyzer';

export { default as SpeechAnalyzer } from './SpeechAnalyzer';
export { default as NihssLanguageAssistant } from './NihssLanguageAssistant';

export const SPEECH_CORE_COMPONENTS: Record<string, ComponentType> = {
  'speech-analyzer': SpeechAnalyzer,
  'nihss-language-assistant': NihssLanguageAssistant,
};

export * from './analysis';
export * from './nihss';
export * from './phrases';
