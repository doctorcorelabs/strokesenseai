/**
 * Shared UI kit for Phase 1 feature pages.
 *
 * Import from this barrel so feature builders depend on one stable
 * surface: import { FeatureShell, CameraPanel } from '../shared';
 */
export { default as FeatureShell, SAFETY_DISCLAIMER } from './FeatureShell';
export type { FeatureShellProps, FeatureShellStatus } from './FeatureShell';

export { default as CameraPanel, stopStream } from './CameraPanel';
export type { CameraPanelProps, CameraStatus } from './CameraPanel';

export { default as AudioPanel, formatDuration } from './AudioPanel';
export type { AudioPanelProps, AudioStatus } from './AudioPanel';

export { default as MeasureReadout } from './MeasureReadout';
export type { Measure, MeasureQuality, MeasureReadoutProps } from './MeasureReadout';

export { default as ResultPanel } from './ResultPanel';
export type { ResultPanelProps, ResultStatus } from './ResultPanel';

export { useSessionState } from './useSessionState';
export type { SessionControls, SessionState } from './useSessionState';

export { TOKENS } from './theme';
