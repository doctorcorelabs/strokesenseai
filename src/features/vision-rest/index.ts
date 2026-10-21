// Vision AI group, second half: gaze, neglect, and scan features.
//
// Wiring notes for the integration step:
// - Import { GazeTracker, NeglectExplorer, ScanExplainer } from
//   './features/vision-rest' (or the FEATURE_COMPONENTS map below).
// - Feature ids and hash routes already exist in shared/registry.ts:
//   gaze-tracker -> #lab/gaze-tracker
//   neglect-explorer -> #lab/neglect-explorer
//   scan-explainer -> #lab/scan-explainer
// - In App.tsx, render the mapped component for these three ids instead of
//   the generic LabPage; all other lab ids keep the generic page.
// - No registry, contract, App, or Worker changes are needed: the AI coach
//   modules already exist in shared/lab.ts (tool 'gaze' for gaze-tracker
//   and neglect-explorer, tool 'scan' for scan-explainer).
// - Registry maturity for these ids can be raised from 'concept' to 'lab'
//   once the pages are wired, since each lab is fully interactive.

import type { ComponentType } from 'react';
import GazeTracker from './GazeTracker';
import NeglectExplorer from './NeglectExplorer';
import ScanExplainer from './ScanExplainer';

export { GazeTracker, NeglectExplorer, ScanExplainer };

export const VISION_REST_ROUTES: Record<string, string> = {
  'gaze-tracker': '#lab/gaze-tracker',
  'neglect-explorer': '#lab/neglect-explorer',
  'scan-explainer': '#lab/scan-explainer',
};

export const FEATURE_COMPONENTS: Record<string, ComponentType> = {
  'gaze-tracker': GazeTracker,
  'neglect-explorer': NeglectExplorer,
  'scan-explainer': ScanExplainer,
};
