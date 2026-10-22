import { describe, expect, it } from 'vitest';
import type { LocalizerAnalysis } from '../../../ai/visionClient';
import {
  CONFIDENCE_LABELS,
  EXAMPLE_ANALYSIS,
  siteToLevel,
  toResultView,
} from './resultModel';

describe('siteToLevel', () => {
  it('maps cortical sites to the cortex level', () => {
    expect(siteToLevel('Face motor cortex (lower precentral gyrus), left side')).toBe('cortex');
    expect(siteToLevel('Cortical lesion, right hemisphere')).toBe('cortex');
  });

  it('maps capsular and deep sites to the internal capsule level', () => {
    expect(siteToLevel('Genu of the internal capsule, left side')).toBe('internal-capsule');
    expect(siteToLevel('Corona radiata, right side')).toBe('internal-capsule');
    expect(siteToLevel('Small subcortical infarct')).toBe('internal-capsule');
  });

  it('does not let the word cortical inside subcortical win over the capsule', () => {
    expect(siteToLevel('Subcortical white matter, left')).toBe('internal-capsule');
  });

  it('maps pontine and nuclear sites to the pons level', () => {
    expect(siteToLevel('Pons, left side (basis pontis)')).toBe('pons');
    expect(siteToLevel('Facial nucleus, right side')).toBe('pons');
    expect(siteToLevel('Facial fascicle in the brainstem')).toBe('pons');
  });

  it('maps nerve sites to the peripheral level, not the pons', () => {
    expect(siteToLevel('Peripheral facial nerve, right side')).toBe('peripheral');
    expect(siteToLevel('Facial nerve (CN VII) inside the facial canal')).toBe('peripheral');
    expect(siteToLevel('Parotid segment of the nerve')).toBe('peripheral');
  });

  it('returns null when no known level is named', () => {
    expect(siteToLevel('Somewhere in the head')).toBeNull();
    expect(siteToLevel('')).toBeNull();
  });
});

function analysisWith(partial: Partial<LocalizerAnalysis>): LocalizerAnalysis {
  return {
    headline: 'A headline.',
    observations: ['One observation.'],
    cannotAnalyze: false,
    reason: null,
    pattern: 'central-umn',
    lesionCandidates: [],
    possibilities: [],
    emergency: false,
    ...partial,
  };
}

describe('toResultView', () => {
  it('names the central pattern and explains it in plain words', () => {
    const view = toResultView(analysisWith({}));
    expect(view.patternTitle).toBe('Central pattern (upper motor neuron)');
    expect(view.patternNote).toMatch(/forehead still works/i);
  });

  it('names the peripheral pattern and falls back gracefully for unknown codes', () => {
    expect(toResultView(analysisWith({ pattern: 'peripheral-lmn' })).patternTitle).toBe(
      'Peripheral pattern (lower motor neuron)',
    );
    expect(toResultView(analysisWith({ pattern: 'something-new' })).patternTitle).toBe(
      'Pattern from this photo',
    );
    expect(toResultView(analysisWith({ pattern: null })).patternNote).toBe('');
  });

  it('lights the diagram with the top candidate that maps to a level', () => {
    const view = toResultView(
      analysisWith({
        lesionCandidates: [
          {
            site: 'An unnamed place',
            tract: 'Corticobulbar tract',
            vessel: 'Unknown',
            confidence: 'low',
            rationale: 'Unclear.',
          },
          {
            site: 'Genu of the internal capsule, left side',
            tract: 'Corticobulbar tract',
            vessel: 'Lateral lenticulostriate arteries',
            confidence: 'moderate',
            rationale: 'Fits the pattern.',
          },
        ],
      }),
    );
    expect(view.candidates[0].level).toBeNull();
    expect(view.candidates[1].level).toBe('internal-capsule');
    expect(view.activeLevel).toBe('internal-capsule');
  });

  it('leaves the diagram unlit when no candidate maps', () => {
    const view = toResultView(analysisWith({ lesionCandidates: [] }));
    expect(view.activeLevel).toBeNull();
    expect(view.candidates).toEqual([]);
  });

  it('passes observations and possibilities through unchanged', () => {
    const view = toResultView(
      analysisWith({
        observations: ['A', 'B'],
        possibilities: [{ name: 'Bell palsy', note: 'Forehead involved.' }],
      }),
    );
    expect(view.observations).toEqual(['A', 'B']);
    expect(view.possibilities).toEqual([{ name: 'Bell palsy', note: 'Forehead involved.' }]);
  });
});

describe('example analysis', () => {
  it('is a central pattern whose top candidate lights the internal capsule', () => {
    const view = toResultView(EXAMPLE_ANALYSIS);
    expect(EXAMPLE_ANALYSIS.pattern).toBe('central-umn');
    expect(view.activeLevel).toBe('internal-capsule');
    expect(view.candidates.length).toBeGreaterThanOrEqual(2);
    expect(view.possibilities.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every example confidence at or below the single-photo ceiling', () => {
    for (const candidate of EXAMPLE_ANALYSIS.lesionCandidates) {
      expect(candidate.confidence).not.toBe('high');
    }
  });
});

describe('CONFIDENCE_LABELS', () => {
  it('labels all three qualitative levels', () => {
    expect(CONFIDENCE_LABELS.high).toBe('High confidence');
    expect(CONFIDENCE_LABELS.moderate).toBe('Moderate confidence');
    expect(CONFIDENCE_LABELS.low).toBe('Low confidence');
  });
});
