// Motor upper limb labs: Arm Drift Quantifier and Finger Tapping.
//
// Wiring notes for integration:
// - ArmDriftLab serves registry feature id 'arm-drift', route '#lab/arm-drift'.
// - FingerTappingLab serves registry feature id 'finger-tapping', route
//   '#lab/finger-tapping'.
// - Both components are self-contained workspaces designed to render inside
//   the lab page for their feature, replacing the guided walkthrough
//   placeholder. They read their own registry entry for limitation text and
//   need no props.
// - MOTOR_UPPER_LABS lists the id, route, and component triples so a router
//   or page can wire them without hardcoding imports elsewhere.

import type { ComponentType } from 'react';
import ArmDriftLab from './ArmDriftLab';
import FingerTappingLab from './FingerTappingLab';

export { default as ArmDriftLab } from './ArmDriftLab';
export { default as FingerTappingLab } from './FingerTappingLab';
export * from './driftMetrics';
export * from './tappingMetrics';

export interface MotorUpperLabWiring {
  id: string;
  route: string;
  component: ComponentType;
}

export const MOTOR_UPPER_LABS: MotorUpperLabWiring[] = [
  { id: 'arm-drift', route: '#lab/arm-drift', component: ArmDriftLab },
  { id: 'finger-tapping', route: '#lab/finger-tapping', component: FingerTappingLab },
];
