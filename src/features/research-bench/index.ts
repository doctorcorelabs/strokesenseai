// Research Platform feature module: Model Experiment Bench and the
// Evaluation and Transparency Dashboard.
//
// Wiring note for the app router (src/App.tsx): both pages are self
// contained components with no required props. In the lab route branch,
// special-case the two registry ids below before the generic LabPage
// fallback:
//
//   import { ModelBenchPage, TransparencyDashboardPage } from './features/research-bench';
//   ...
//   {route.id === 'model-bench' ? (
//     <ModelBenchPage key={route.id} />
//   ) : route.id === 'transparency-dashboard' ? (
//     <TransparencyDashboardPage key={route.id} />
//   ) : (
//     <LabPage key={route.id} id={route.id} />
//   )}
//
// Their registry routes already exist and stay unchanged:
//   model-bench            -> #lab/model-bench
//   transparency-dashboard -> #lab/transparency-dashboard

import ModelBench from './ModelBench';
import TransparencyDashboard from './TransparencyDashboard';

export const MODEL_BENCH_ROUTE_ID = 'model-bench';
export const TRANSPARENCY_DASHBOARD_ROUTE_ID = 'transparency-dashboard';

export { ModelBench as ModelBenchPage, TransparencyDashboard as TransparencyDashboardPage };
export { default as ModelBench } from './ModelBench';
export { default as TransparencyDashboard } from './TransparencyDashboard';
