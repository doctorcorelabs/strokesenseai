// Entry point for the speech and aphasia labs (Speech and Language AI).
//
// Wiring notes for the integration step:
// - Registry routes already exist: '#lab/aphasia-expression',
//   '#lab/aphasia-communication', and '#lab/comprehension-check'.
// - Render SpeechAphasiaFeature with the registry id, or import the three
//   components individually. All state is local to each component and all
//   processing (scoring, text to speech) happens on the device, so no
//   Worker endpoint, consent flow, or route table entry is needed.

import type { ComponentType } from 'react';
import AphasiaExpressionLab from './AphasiaExpressionLab';
import AphasiaCommunicationMode from './AphasiaCommunicationMode';
import ComprehensionCheck from './ComprehensionCheck';

export { default as AphasiaExpressionLab } from './AphasiaExpressionLab';
export { default as AphasiaCommunicationMode } from './AphasiaCommunicationMode';
export { default as ComprehensionCheck } from './ComprehensionCheck';

export const SPEECH_APHASIA_FEATURE_IDS = [
  'aphasia-expression',
  'aphasia-communication',
  'comprehension-check',
] as const;

export type SpeechAphasiaFeatureId = (typeof SPEECH_APHASIA_FEATURE_IDS)[number];

export const SPEECH_APHASIA_COMPONENTS: Record<SpeechAphasiaFeatureId, ComponentType> = {
  'aphasia-expression': AphasiaExpressionLab,
  'aphasia-communication': AphasiaCommunicationMode,
  'comprehension-check': ComprehensionCheck,
};

/** Render the interactive module for one of this folder's registry ids. */
export default function SpeechAphasiaFeature({ id }: { id: string }) {
  const Component =
    SPEECH_APHASIA_COMPONENTS[id as SpeechAphasiaFeatureId] ?? AphasiaExpressionLab;
  return <Component />;
}
