// Clinical case labs: self-contained interactive workspaces for three
// Clinical Reasoning AI features. Each component takes no props and manages
// its own state, so a host page only has to mount it.
//
// Wiring notes for the app shell (LabPage or App):
//   route '#lab/mimic-detective'       -> <MimicDetective />
//   route '#lab/localization-challenge' -> <LocalizationChallenge />
//   route '#lab/virtual-patient-osce'   -> <VirtualPatientOsce />
// CLINICAL_CASE_COMPONENTS maps registry feature ids to components for a
// generic mount point.

import type { ComponentType } from 'react';
import MimicDetective from './MimicDetective';
import LocalizationChallenge from './LocalizationChallenge';
import VirtualPatientOsce from './VirtualPatientOsce';

export { default as MimicDetective } from './MimicDetective';
export { default as LocalizationChallenge } from './LocalizationChallenge';
export { default as VirtualPatientOsce } from './VirtualPatientOsce';
export { default as TerritoryMap } from './TerritoryMap';
export { default as ScoreReport } from './ScoreReport';

export const CLINICAL_CASE_COMPONENTS: Record<string, ComponentType> = {
  'mimic-detective': MimicDetective,
  'localization-challenge': LocalizationChallenge,
  'virtual-patient-osce': VirtualPatientOsce,
};

export * from './engine';
export * from './mimicCases';
export * from './localizationCases';
export * from './osceStations';
