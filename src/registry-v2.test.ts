import { describe, expect, it } from 'vitest';
import {
  FEATURES,
  LEGACY_ALIASES,
  PLANNED_FEATURE_IDS,
  R1_CATALOG,
  R1_FEATURES,
  R1_RETAINED_IDS,
  getFeature,
} from '../shared/registry';
import type { FeatureEntry, FeatureInput, FeatureZone } from '../shared/registry';
import { featureModeKind } from './ai/featureMode';
import type { FeatureModeKind } from './ai/featureMode';

// Registry v2 (rebuild R1) contract: the new features are registered with
// complete v2 fields and honest models copy, the retained legacy features
// carry v2 fields too, and the legacy alias map only points at features
// that exist now or are declared R2 targets.

const R1_IDS = [
  'fast-live-check',
  'face-lab',
  'movement-lab',
  'speech-lab',
  'document-studio',
  'ask-the-lab',
];

const VALID_INPUTS: FeatureInput[] = ['camera', 'microphone', 'text', 'touch', 'none'];
const VALID_ZONES: FeatureZone[] = ['check', 'play', 'think', 'review'];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function expectCompleteV2Fields(feature: FeatureEntry) {
  expect(feature.displayName, feature.id).toBeDefined();
  expect(feature.displayName!.trim().length, feature.id).toBeGreaterThan(0);
  expect(feature.benefit, feature.id).toBeDefined();
  expect(feature.benefit!.trim().length, feature.id).toBeGreaterThan(0);
  expect(wordCount(feature.benefit!), feature.id).toBeLessThanOrEqual(12);
  expect(feature.inputs, feature.id).toBeDefined();
  expect(feature.inputs!.length, feature.id).toBeGreaterThan(0);
  for (const input of feature.inputs!) {
    expect(VALID_INPUTS, feature.id).toContain(input);
  }
  expect(feature.minutes, feature.id).toBeDefined();
  expect(feature.minutes!, feature.id).toBeGreaterThan(0);
  expect(feature.zone, feature.id).toBeDefined();
  expect(VALID_ZONES, feature.id).toContain(feature.zone);
}

describe('registry v2: R1 features', () => {
  it('registers exactly the six R1 features, with ids unique across the catalog', () => {
    expect(R1_FEATURES.map((feature) => feature.id).sort()).toEqual([...R1_IDS].sort());
    const legacyIds = new Set(FEATURES.map((feature) => feature.id));
    for (const feature of R1_FEATURES) {
      expect(legacyIds.has(feature.id), feature.id).toBe(false);
    }
  });

  it('gives every R1 feature complete v2 fields and the standard registry fields', () => {
    for (const feature of R1_FEATURES) {
      expectCompleteV2Fields(feature);
      expect(feature.maturity, feature.id).toBe('lab');
      expect(feature.route, feature.id).toBe(`#lab/${feature.id}`);
      expect(feature.name.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.tagline.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.summary.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.limitations.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.models.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.retention.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.evalReport.trim().length, feature.id).toBeGreaterThan(0);
      expect(feature.inputKinds.length, feature.id).toBeGreaterThan(0);
    }
  });

  it('resolves R1 features through getFeature', () => {
    expect(getFeature('fast-live-check')?.displayName).toBe('FAST Live Check');
    expect(getFeature('ask-the-lab')?.zone).toBe('think');
    expect(getFeature('face-lab')?.group).toBe('Vision AI');
  });

  it('names the real measurement technology in the models fields', () => {
    expect(getFeature('fast-live-check')!.models).toMatch(/Face Landmarker/);
    expect(getFeature('fast-live-check')!.models).toMatch(/Pose Landmarker/);
    expect(getFeature('face-lab')!.models).toMatch(/Face Landmarker/);
    expect(getFeature('movement-lab')!.models).toMatch(/Pose Landmarker/);
    expect(getFeature('movement-lab')!.models).toMatch(/Hand Landmarker/);
  });

  it('states plainly that Speech Lab audio is transcribed by the browser provider', () => {
    const models = getFeature('speech-lab')!.models;
    expect(models).toMatch(/browser provider/);
    expect(models).toMatch(/Google/);
    expect(models).toMatch(/Apple/);
    expect(models).toMatch(/not transcribed purely on this device/);
  });

  it('states plainly how Document Studio splits local parsers and the AI photo path', () => {
    // Since the AI upload wave (2026-10-22) the studio has two paths:
    // pasted text is parsed locally, and a photo is read by the Worker
    // AI endpoint. The models copy must name both, and must not claim
    // the whole feature is AI-free the way the pre-upload copy did.
    const models = getFeature('document-studio')!.models;
    expect(models).toMatch(/local deterministic parsers/i);
    expect(models).toMatch(/photo/i);
    expect(models).toMatch(/worker ai endpoint/i);
    expect(models).toMatch(/runs no ocr/i);
  });
});

describe('registry v2: retained legacy features', () => {
  it('fills the v2 fields of the three retained features', () => {
    for (const id of R1_RETAINED_IDS) {
      const feature = getFeature(id);
      expect(feature, id).toBeDefined();
      expectCompleteV2Fields(feature!);
    }
  });

  it('renames the guideline navigator by display name and zones the retained set', () => {
    expect(getFeature('guideline-navigator')?.displayName).toBe('Ask the Guidelines');
    expect(getFeature('guideline-navigator')?.zone).toBe('think');
    expect(getFeature('privacy-shield')?.zone).toBe('think');
    expect(getFeature('model-bench')?.zone).toBe('review');
  });

  it('builds the R1 catalog from the new features plus the retained ones', () => {
    expect(R1_CATALOG.map((feature) => feature.id).sort()).toEqual(
      [...R1_IDS, ...R1_RETAINED_IDS].sort(),
    );
    for (const feature of R1_CATALOG) {
      expectCompleteV2Fields(feature);
    }
  });
});

describe('registry v2: legacy aliases', () => {
  it('maps the merged, rebuilt, and retired legacy features', () => {
    expect(LEGACY_ALIASES['arm-drift']).toBe('movement-lab');
    expect(LEGACY_ALIASES['finger-tapping']).toBe('movement-lab');
    expect(LEGACY_ALIASES['balance-lab']).toBe('movement-lab');
    expect(LEGACY_ALIASES['face-analyzer']).toBe('face-lab');
    expect(LEGACY_ALIASES['face-dynamics']).toBe('face-lab');
    expect(LEGACY_ALIASES['speech-analyzer']).toBe('speech-lab');
    expect(LEGACY_ALIASES['discharge-lens']).toBe('document-studio');
    expect(LEGACY_ALIASES['risk-extractor']).toBe('document-studio');
    expect(LEGACY_ALIASES['plain-translator']).toBe('document-studio');
    expect(LEGACY_ALIASES['digital-fast-multimodal']).toBe('fast-live-check');
    expect(LEGACY_ALIASES['aphasia-expression']).toBe('language-practice');
    expect(LEGACY_ALIASES['aphasia-communication']).toBe('language-practice');
    expect(LEGACY_ALIASES['comprehension-check']).toBe('language-practice');
    expect(LEGACY_ALIASES['stroke-code-simulator']).toBe('case-room');
    expect(LEGACY_ALIASES['mimic-detective']).toBe('case-room');
    expect(LEGACY_ALIASES['localization-challenge']).toBe('case-room');
    expect(LEGACY_ALIASES['virtual-patient-osce']).toBe('case-room');
    expect(LEGACY_ALIASES['nihss-language-assistant']).toBe('nihss-trainer');
    expect(LEGACY_ALIASES['transparency-dashboard']).toBe('scope-reviewers');
    expect(LEGACY_ALIASES['neglect-explorer']).toBe('vision-tests');
    expect(LEGACY_ALIASES['fast-vision-check']).toBe('vision-tests');
    expect(LEGACY_ALIASES['gaze-tracker']).toBeNull();
    // 23 since the R1 integration pass added the missing adaptive-tutor
    // entry (it merges into case-room like the other case shells).
    expect(LEGACY_ALIASES['adaptive-tutor']).toBe('case-room');
    expect(Object.keys(LEGACY_ALIASES)).toHaveLength(23);
  });

  it('uses only real legacy ids as keys and existing or planned ids as targets', () => {
    const legacyIds = new Set(FEATURES.map((feature) => feature.id));
    const knownTargets = new Set([
      ...FEATURES.map((feature) => feature.id),
      ...R1_FEATURES.map((feature) => feature.id),
      ...PLANNED_FEATURE_IDS,
    ]);
    for (const [legacyId, target] of Object.entries(LEGACY_ALIASES)) {
      expect(legacyIds.has(legacyId), legacyId).toBe(true);
      if (target !== null) {
        expect(knownTargets.has(target), `${legacyId} -> ${target}`).toBe(true);
      }
    }
  });
});

describe('registry v2: honest mode kinds for R1 features', () => {
  // Since the AI upload wave (2026-10-22), four R1 features are
  // dual-path (local core plus an optional AI upload analysis), so
  // their honest catalog kind is 'mixed', not 'on-device'.
  const EXPECTED_R1_KINDS: Record<string, FeatureModeKind> = {
    'fast-live-check': 'mixed',
    'face-lab': 'mixed',
    'movement-lab': 'mixed',
    'speech-lab': 'on-device',
    'document-studio': 'mixed',
    'ask-the-lab': 'ai',
  };

  it('derives the expected kind for every R1 feature', () => {
    for (const feature of R1_FEATURES) {
      expect(featureModeKind(feature), feature.id).toBe(EXPECTED_R1_KINDS[feature.id]);
    }
  });
});
