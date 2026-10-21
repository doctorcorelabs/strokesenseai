import { describe, expect, it } from 'vitest';
import {
  CLASSIFICATION_LABELS,
  MIMIC_CASES,
  differentialFeedback,
  getMimicCase,
  scoreMimicAttempt,
} from './mimicCases';
import type { ClassificationId } from './mimicCases';
import {
  LOCALIZATION_CASES,
  TERRITORIES,
  getTerritory,
  scoreLocalizationAnswer,
} from './localizationCases';
import { OSCE_STATIONS, scoreOsceStation } from './osceStations';

const ALL_CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as ClassificationId[];

describe('mimic case bank integrity', () => {
  it('has unique ids and at least five cases', () => {
    expect(MIMIC_CASES.length).toBeGreaterThanOrEqual(5);
    expect(new Set(MIMIC_CASES.map((c) => c.id)).size).toBe(MIMIC_CASES.length);
  });

  it('covers the four core mimics named in the planning document', () => {
    const keys = new Set(MIMIC_CASES.map((c) => c.keyClassification));
    expect(keys.has('mimic-hypoglycemia')).toBe(true);
    expect(keys.has('mimic-todd')).toBe(true);
    expect(keys.has('mimic-migraine-aura')).toBe(true);
    expect(keys.has('mimic-functional')).toBe(false); // functional case keys to uncertain by design
    expect(keys.has('uncertain-needs-imaging')).toBe(true);
    expect(keys.has('ischemic-stroke')).toBe(true);
    expect(keys.has('mimic-bell-palsy')).toBe(true);
  });

  it.each(MIMIC_CASES.map((c) => [c.id, c] as const))(
    'case %s has valid keys, decisive clues, and a glucose safety clue',
    (_id, c) => {
      expect(ALL_CLASSIFICATIONS).toContain(c.keyClassification);
      expect(c.decisiveClueIds.length).toBeGreaterThan(0);
      const clueIds = new Set(c.clues.map((clue) => clue.id));
      expect(clueIds.size).toBe(c.clues.length);
      for (const decisiveId of c.decisiveClueIds) {
        expect(clueIds.has(decisiveId)).toBe(true);
        const clue = c.clues.find((x) => x.id === decisiveId);
        expect(clue?.weight).toBe('decisive');
      }
      const safetyClues = c.clues.filter((clue) => clue.safety);
      expect(safetyClues.length).toBeGreaterThan(0);
      expect(safetyClues.every((clue) => clue.id === 'glucose')).toBe(true);
      expect(c.clueBudget).toBeGreaterThan(0);
      expect(c.clueBudget).toBeLessThanOrEqual(c.clues.length);
      expect(c.explanation.length).toBeGreaterThan(40);
      expect(c.trap.length).toBeGreaterThan(10);
    },
  );
});

describe('mimic scoring', () => {
  const c = MIMIC_CASES[0]!; // hypoglycemia case

  it('awards full marks to a perfect attempt', () => {
    const summary = scoreMimicAttempt(c, {
      differential: [c.keyClassification, 'ischemic-stroke'],
      chosenClueIds: ['glucose', 'repeat-after-dextrose', 'med-history'],
      classification: c.keyClassification,
      decisivePick: 'glucose',
    });
    expect(summary.max).toBe(100);
    expect(summary.earned).toBe(100);
    expect(summary.band).toBe('Strong');
  });

  it('scores zero classification points for a wrong final answer', () => {
    const summary = scoreMimicAttempt(c, {
      differential: ['ischemic-stroke'],
      chosenClueIds: ['ct-head'],
      classification: 'ischemic-stroke',
      decisivePick: 'ct-head',
    });
    const classification = summary.parts.find((p) => p.id === 'classification');
    expect(classification?.earned).toBe(0);
    expect(summary.earned).toBe(0);
  });

  it('penalises skipping the glucose safety check even when right', () => {
    const summary = scoreMimicAttempt(c, {
      differential: [c.keyClassification],
      chosenClueIds: ['repeat-after-dextrose'],
      classification: c.keyClassification,
      decisivePick: 'repeat-after-dextrose',
    });
    const safety = summary.parts.find((p) => p.id === 'safety-glucose');
    expect(safety?.earned).toBe(0);
    expect(summary.earned).toBe(75);
  });

  it('differential feedback reflects whether the key was listed', () => {
    expect(differentialFeedback(c, [c.keyClassification])).toContain('includes');
    expect(differentialFeedback(c, ['ischemic-stroke'])).toContain('does not include');
    expect(differentialFeedback(c, [])).toContain('zero');
  });

  it('getMimicCase finds cases by id', () => {
    expect(getMimicCase(MIMIC_CASES[1]!.id)?.id).toBe(MIMIC_CASES[1]!.id);
    expect(getMimicCase('nope')).toBeUndefined();
  });
});

describe('localization bank integrity', () => {
  it('has unique cases whose keys reference real territories', () => {
    expect(LOCALIZATION_CASES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(LOCALIZATION_CASES.map((c) => c.id)).size).toBe(LOCALIZATION_CASES.length);
    for (const c of LOCALIZATION_CASES) {
      expect(getTerritory(c.keyTerritory)).toBeDefined();
      expect(c.findings.length).toBeGreaterThanOrEqual(3);
      for (const finding of c.findings) {
        expect(finding.pointsTo.length).toBeGreaterThan(10);
      }
    }
    expect(new Set(TERRITORIES.map((t) => t.id)).size).toBe(TERRITORIES.length);
  });
});

describe('localization scoring', () => {
  const c = LOCALIZATION_CASES[0]!;

  it('awards 100 for the exact two layer answer', () => {
    const summary = scoreLocalizationAnswer(c, {
      side: c.keySide,
      level: c.keyLevel,
      territory: c.keyTerritory,
    });
    expect(summary.earned).toBe(100);
  });

  it('awards half territory credit for a same family near miss', () => {
    const familyMate = TERRITORIES.find(
      (t) => t.family === getTerritory(c.keyTerritory)?.family && t.id !== c.keyTerritory,
    );
    expect(familyMate).toBeDefined();
    const summary = scoreLocalizationAnswer(c, {
      side: c.keySide,
      level: c.keyLevel,
      territory: familyMate!.id,
    });
    const territory = summary.parts.find((p) => p.id === 'territory');
    expect(territory?.earned).toBe(25);
    expect(summary.earned).toBe(75);
  });

  it('scores blank answers as zero', () => {
    const summary = scoreLocalizationAnswer(c, { side: null, level: null, territory: null });
    expect(summary.earned).toBe(0);
  });

  it('scores side and level independently', () => {
    const summary = scoreLocalizationAnswer(c, {
      side: c.keySide,
      level: c.keyLevel === 'cortical' ? 'brainstem' : 'cortical',
      territory: null,
    });
    expect(summary.earned).toBe(20);
  });
});

describe('osce bank integrity', () => {
  it('has three stations with complete sections', () => {
    expect(OSCE_STATIONS).toHaveLength(3);
    for (const station of OSCE_STATIONS) {
      expect(station.timeLimitSeconds).toBeGreaterThan(0);
      expect(station.historyOptions.some((o) => o.key)).toBe(true);
      expect(station.examOptions.some((o) => o.key)).toBe(true);
      expect(station.commPrompts.length).toBeGreaterThanOrEqual(2);
      for (const prompt of station.commPrompts) {
        expect(prompt.options.some((o) => o.score === 2)).toBe(true);
        expect(prompt.options.some((o) => o.score === 0)).toBe(true);
      }
      expect(station.diagnosisOptions.some((o) => o.id === station.keyDiagnosisId)).toBe(true);
      for (const stepId of station.keyNextStepIds) {
        expect(station.nextStepOptions.some((o) => o.id === stepId)).toBe(true);
      }
    }
  });
});

describe('osce scoring', () => {
  const station = OSCE_STATIONS[0]!;

  it('awards full marks for a complete station performance', () => {
    const commChoices: Record<string, string> = {};
    for (const prompt of station.commPrompts) {
      commChoices[prompt.id] = prompt.options.find((o) => o.score === 2)!.id;
    }
    const summary = scoreOsceStation(station, {
      askedIds: station.historyOptions.filter((o) => o.key).map((o) => o.id),
      examIds: station.examOptions.filter((o) => o.key).map((o) => o.id),
      commChoices,
      diagnosisId: station.keyDiagnosisId,
      nextStepIds: [...station.keyNextStepIds],
    });
    expect(summary.max).toBe(100);
    expect(summary.earned).toBe(100);
  });

  it('scores an empty attempt as zero and names missed domains', () => {
    const summary = scoreOsceStation(station, {
      askedIds: [],
      examIds: [],
      commChoices: {},
      diagnosisId: null,
      nextStepIds: [],
    });
    expect(summary.earned).toBe(0);
    const history = summary.parts.find((p) => p.id === 'history');
    expect(history?.note).toContain('Missed:');
  });

  it('gives partial credit for partial checklists', () => {
    const keyHistory = station.historyOptions.filter((o) => o.key);
    const half = keyHistory.slice(0, Math.ceil(keyHistory.length / 2)).map((o) => o.id);
    const summary = scoreOsceStation(station, {
      askedIds: half,
      examIds: [],
      commChoices: {},
      diagnosisId: null,
      nextStepIds: [],
    });
    const history = summary.parts.find((p) => p.id === 'history');
    expect(history?.earned).toBeGreaterThan(0);
    expect(history?.earned).toBeLessThan(40);
  });
});
