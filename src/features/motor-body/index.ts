// Motor body labs: Sit-to-Stand and Balance Lab plus FAST Vision Check.
//
// Wiring notes for integration:
// - BalanceLab is the default-free named export for feature id
//   "balance-lab" (registry route "#lab/balance-lab").
// - FastVisionCheck is the named export for feature id "fast-vision-check"
//   (registry route "#lab/fast-vision-check").
// - Both components take no props and manage their own session state in
//   memory only; nothing is persisted and nothing leaves the device.
export { default as BalanceLab } from './BalanceLab';
export { default as FastVisionCheck } from './FastVisionCheck';
export {
  formatDurationMs,
  summarizeObserverEvents,
  summarizeSitToStand,
  summarizeSway,
} from './balance-logic';
export type { SitToStandSummary, SwaySample, SwaySummary } from './balance-logic';
export {
  buildTrialPlan,
  eyeTotals,
  quadrantForPoint,
  quadrantLabel,
  stimulusPointFor,
  summarizeVisionTrials,
} from './vision-logic';
export type { EyeSide, Quadrant, VisionSummary, VisionTrial } from './vision-logic';
