// Vision face labs: Face Symmetry Analyzer v2 and Face Dynamics Lab.
//
// Wiring for the integrator:
// - Route '#lab/face-analyzer' should render <FaceAnalyzerLab /> as the
//   interactive workspace of the face-analyzer LabPage.
// - Route '#lab/face-dynamics' should render <FaceDynamicsLab /> as the
//   interactive workspace of the face-dynamics LabPage.
// Both components are self-contained: they import their own stylesheet
// (vision-face.css, vf- namespaced classes) and only share the global UI
// primitives in src/components/ui.tsx plus the registry and contracts in
// shared/. They hold all state in memory; nothing is stored or uploaded.

export { default as FaceAnalyzerLab } from './FaceAnalyzerLab';
export { default as FaceDynamicsLab } from './FaceDynamicsLab';
export * from './geometry';
export * from './imageStats';
export * from './dynamics';
