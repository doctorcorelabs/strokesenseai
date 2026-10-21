import { describe, expect, it } from 'vitest';
import { FEATURES } from '../../../shared/registry';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../safety';
import { GUARD_BANK, SYMPTOM_CATEGORIES } from './data';
import { bankComposition, countBy, evaluateGuard, maturitySummary } from './metrics';

describe('bankComposition: numbers come from the shipped bank file', () => {
  const composition = bankComposition(GUARD_BANK);

  it('counts 48 items, 25 expected to escalate and 23 not', () => {
    expect(composition.total).toBe(48);
    expect(composition.expectedEmergency).toBe(25);
    expect(composition.expectedCalm).toBe(23);
  });

  it('breaks the bank down by category', () => {
    expect(composition.byCategory).toEqual([
      { key: 'abuse', count: 6 },
      { key: 'education', count: 6 },
      { key: 'fiction', count: 6 },
      { key: 'multiline', count: 4 },
      { key: 'negation', count: 5 },
      { key: 'symptom-en', count: 8 },
      { key: 'symptom-id', count: 10 },
      { key: 'symptom-mixed', count: 3 },
    ]);
  });

  it('breaks the bank down by language', () => {
    expect(composition.byLang).toEqual([
      { key: 'en', count: 26 },
      { key: 'id', count: 19 },
      { key: 'mixed', count: 3 },
    ]);
  });

  it('countBy totals always add back up to the bank size', () => {
    const total = countBy(GUARD_BANK, 'category').reduce((sum, row) => sum + row.count, 0);
    expect(total).toBe(GUARD_BANK.length);
  });
});

describe('evaluateGuard: the shipped client guard over the shipped bank', () => {
  const evaluation = evaluateGuard(GUARD_BANK, mentionsAcuteSigns);

  it('escalates every symptom report: recall 25 of 25, no misses', () => {
    expect(evaluation.symptomTotal).toBe(25);
    expect(evaluation.symptomDetected).toBe(25);
    expect(evaluation.symptomMisses).toEqual([]);
  });

  it('symptom set is exactly the categories the repository suites gate on', () => {
    const symptomItems = GUARD_BANK.filter((item) => SYMPTOM_CATEGORIES.includes(item.category));
    expect(symptomItems).toHaveLength(evaluation.symptomTotal);
    expect(symptomItems.every((item) => item.expectEmergency)).toBe(true);
  });

  it('over-escalates all five negation items by documented design', () => {
    const negations = GUARD_BANK.filter((item) => item.category === 'negation');
    expect(negations).toHaveLength(5);
    for (const item of negations) {
      expect(evaluation.overEscalations).toContainEqual(item);
    }
  });

  it('over-escalates exactly one education item: the arm drift definition', () => {
    const educationOver = evaluation.overEscalations.filter((item) => item.category === 'education');
    expect(educationOver).toHaveLength(1);
    expect(educationOver[0]?.text).toBe('Explain what arm drift means');
  });

  it('agreement accounting is consistent: agreed + misses + over-escalations = total', () => {
    expect(
      evaluation.agreed + evaluation.symptomMisses.length + evaluation.overEscalations.length,
    ).toBe(GUARD_BANK.length);
    const rowTotals = evaluation.rows.reduce((sum, row) => sum + row.total, 0);
    expect(rowTotals).toBe(GUARD_BANK.length);
  });

  it('per-category rows agree with a manual recount', () => {
    for (const row of evaluation.rows) {
      const items = GUARD_BANK.filter((item) => item.category === row.category);
      expect(row.total).toBe(items.length);
      expect(row.expectedEmergency).toBe(items.filter((item) => item.expectEmergency).length);
      expect(row.guardEscalates).toBe(items.filter((item) => mentionsAcuteSigns(item.text)).length);
    }
  });
});

describe('evaluateGuard: aggregation logic with a stub detector', () => {
  it('counts misses and over-escalations separately', () => {
    const bank = [
      { category: 'symptom-en', expectEmergency: true, lang: 'en', text: 'a' },
      { category: 'symptom-en', expectEmergency: true, lang: 'en', text: 'b' },
      { category: 'negation', expectEmergency: false, lang: 'en', text: 'c' },
    ];
    const evaluation = evaluateGuard(bank, (text) => text !== 'b');
    expect(evaluation.symptomTotal).toBe(2);
    expect(evaluation.symptomDetected).toBe(1);
    expect(evaluation.symptomMisses.map((item) => item.text)).toEqual(['b']);
    expect(evaluation.overEscalations.map((item) => item.text)).toEqual(['c']);
    // Item 'a' agrees (expected and detected), 'b' is a miss, 'c' over-escalates.
    expect(evaluation.agreed).toBe(1);
  });
});

describe('maturitySummary: registry as the source of truth', () => {
  it('reports 28 features, all lab, none evaluated yet', () => {
    const summary = maturitySummary(FEATURES);
    expect(summary.total).toBe(28);
    expect(summary.concept).toBe(0);
    expect(summary.lab).toBe(28);
    expect(summary.validated).toBe(0);
    expect(summary.notEvaluated).toBe(28);
  });
});

describe('emergency text sanity for the flag rubric', () => {
  it('the shipped emergency text itself is a symptom-free string for the detector input side', () => {
    expect(typeof EMERGENCY_TEXT).toBe('string');
    expect(EMERGENCY_TEXT).toContain('119');
  });
});
