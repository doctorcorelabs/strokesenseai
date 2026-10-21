import { describe, expect, it } from 'vitest';
import { FEATURES, getFeature } from '../../shared/registry';
import type { FeatureModeKind } from './featureMode';
import { featureModeKind, featureModeLabel } from './featureMode';

// Expected kind for every registry feature, derived by hand from each
// entry's models text and inputKinds. If the registry copy changes, this
// table forces a deliberate re-check of the badge the hub will show.
const EXPECTED_KINDS: Record<string, FeatureModeKind> = {
  'digital-fast-multimodal': 'mixed',
  'face-analyzer': 'simulation',
  'face-dynamics': 'simulation',
  'gaze-tracker': 'mixed',
  'neglect-explorer': 'mixed',
  'scan-explainer': 'mixed',
  'speech-analyzer': 'on-device',
  'aphasia-expression': 'on-device',
  'aphasia-communication': 'on-device',
  'comprehension-check': 'on-device',
  'nihss-language-assistant': 'on-device',
  'arm-drift': 'simulation',
  'finger-tapping': 'simulation',
  'balance-lab': 'simulation',
  'fast-vision-check': 'simulation',
  'nihss-trainer': 'on-device',
  'stroke-code-simulator': 'on-device',
  'mimic-detective': 'on-device',
  'localization-challenge': 'on-device',
  'virtual-patient-osce': 'on-device',
  'discharge-lens': 'on-device',
  'risk-extractor': 'on-device',
  'guideline-navigator': 'mixed',
  'plain-translator': 'ai',
  'model-bench': 'ai',
  'privacy-shield': 'on-device',
  'adaptive-tutor': 'mixed',
  'transparency-dashboard': 'on-device',
};

describe('featureModeKind', () => {
  it('covers every registry feature exactly once', () => {
    expect(FEATURES).toHaveLength(28);
    expect(Object.keys(EXPECTED_KINDS).sort()).toEqual(
      FEATURES.map((feature) => feature.id).sort(),
    );
  });

  it('derives the expected kind for all 28 features', () => {
    for (const feature of FEATURES) {
      expect(featureModeKind(feature), feature.id).toBe(EXPECTED_KINDS[feature.id]);
    }
  });

  it('never labels a no-AI feature as AI-driven', () => {
    for (const feature of FEATURES) {
      if (/no ai model|fully local/i.test(feature.models)) {
        expect(featureModeKind(feature), feature.id).not.toBe('ai');
      }
    }
  });
});

describe('featureModeLabel', () => {
  it('labels AI-driven features by configuration', () => {
    const translator = getFeature('plain-translator');
    const bench = getFeature('model-bench');
    expect(translator).toBeDefined();
    expect(bench).toBeDefined();
    expect(featureModeLabel(translator!, true)).toBe('Live AI');
    expect(featureModeLabel(translator!, false)).toBe('Offline guide');
    expect(featureModeLabel(bench!, true)).toBe('Live AI');
    expect(featureModeLabel(bench!, false)).toBe('Offline guide');
  });

  it('labels simulation, on-device, and mixed features stably', () => {
    expect(featureModeLabel(getFeature('face-analyzer')!, true)).toBe('Simulation');
    expect(featureModeLabel(getFeature('face-analyzer')!, false)).toBe('Simulation');
    expect(featureModeLabel(getFeature('discharge-lens')!, true)).toBe('On this device');
    expect(featureModeLabel(getFeature('privacy-shield')!, false)).toBe('On this device');
    expect(featureModeLabel(getFeature('guideline-navigator')!, true)).toBe(
      'Mixed: on-device + optional AI',
    );
    expect(featureModeLabel(getFeature('guideline-navigator')!, false)).toBe(
      'Mixed: on-device + optional AI',
    );
  });
});
