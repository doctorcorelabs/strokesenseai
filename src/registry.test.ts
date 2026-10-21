import { describe, expect, it } from 'vitest';
import { FEATURES, FEATURE_GROUPS, getFeature } from '../shared/registry';

describe('feature registry', () => {
  it('contains exactly 28 features', () => {
    expect(FEATURES).toHaveLength(28);
  });

  it('has unique ids', () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only valid groups', () => {
    for (const feature of FEATURES) {
      expect(FEATURE_GROUPS).toContain(feature.group);
    }
  });

  it('covers every group at least once', () => {
    for (const group of FEATURE_GROUPS) {
      expect(FEATURES.some((feature) => feature.group === group)).toBe(true);
    }
  });

  it('gives every entry a non-empty limitation, summary, and tagline', () => {
    for (const feature of FEATURES) {
      expect(feature.limitations.trim().length).toBeGreaterThan(0);
      expect(feature.summary.trim().length).toBeGreaterThan(0);
      expect(feature.tagline.trim().length).toBeGreaterThan(0);
      expect(feature.inputKinds.length).toBeGreaterThan(0);
    }
  });

  it('keeps every implemented feature at lab maturity in phase 1', () => {
    for (const feature of FEATURES) {
      expect(feature.maturity).toBe('lab');
      expect(feature.maturity).not.toBe('concept');
    }
  });

  it('gives every entry the PLANNING 9.3 registry fields', () => {
    for (const feature of FEATURES) {
      expect(feature.route).toBe(`#lab/${feature.id}`);
      expect(feature.models.trim().length).toBeGreaterThan(0);
      expect(feature.retention.trim().length).toBeGreaterThan(0);
      expect(feature.evalReport.trim().length).toBeGreaterThan(0);
    }
  });

  it('records no model and no evaluation for concept features', () => {
    for (const feature of FEATURES) {
      if (feature.maturity === 'concept') {
        expect(feature.models).toBe('None yet (concept)');
        expect(feature.evalReport).toBe('Not evaluated yet');
      }
    }
  });

  it('getFeature returns entries and undefined for unknown ids', () => {
    expect(getFeature('face-analyzer')?.name).toBe('Face Symmetry Analyzer v2');
    expect(getFeature('digital-fast-multimodal')?.group).toBe('Flagship');
    expect(getFeature('privacy-shield')?.phase).toBe(0);
    expect(getFeature('does-not-exist')).toBeUndefined();
  });
});
