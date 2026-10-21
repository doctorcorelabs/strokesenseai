// Clinical trainer module: NIHSS Co-Pilot Trainer + Stroke Code Simulator.
//
// Wiring notes for the integration step:
// - NihssTrainer serves registry route '#lab/nihss-trainer'.
// - StrokeCodeSimulator serves registry route '#lab/stroke-code-simulator'.
// Both components are self-contained (no props, no context) and bring their
// own headers, emergency banner, and training disclaimers, so they can be
// rendered directly by the router or embedded inside a lab page shell.

export { NihssTrainer } from './NihssTrainer';
export { StrokeCodeSimulator } from './StrokeCodeSimulator';
export {
  NIHSS_ITEMS,
  NIHSS_CASES,
  scoreNihssCase,
  nihssTotal,
  nihssBand,
  drillsForItem,
} from './nihss';
export type { NihssScore, NihssItem, NihssCase, CaseScoreResult } from './nihss';
export {
  STROKE_CODE_SCENARIOS,
  createRun,
  applyChoice,
  computeResults,
  replayChoices,
  addMinutesToClock,
} from './strokeCode';
export type { SimScenario, SimStep, SimOption, RunState, SimResults } from './strokeCode';
