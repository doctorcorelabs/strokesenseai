import { describe, expect, it } from 'vitest';
import {
  NIHSS_CASES,
  NIHSS_ITEMS,
  drillsForItem,
  getNihssCase,
  nihssBand,
  nihssCaseKeyTotal,
  nihssTotal,
  scoreNihssCase,
  type NihssScore,
} from './nihss';

describe('NIHSS item definitions', () => {
  it('has the 15 scored entries in official order', () => {
    expect(NIHSS_ITEMS.map((item) => item.id)).toEqual([
      '1a',
      '1b',
      '1c',
      '2',
      '3',
      '4',
      '5a',
      '5b',
      '6a',
      '6b',
      '7',
      '8',
      '9',
      '10',
      '11',
    ]);
  });

  it('gives every item contiguous numeric anchors starting at 0', () => {
    for (const item of NIHSS_ITEMS) {
      const numeric = item.options
        .map((option) => option.value)
        .filter((value): value is number => typeof value === 'number');
      expect(numeric[0]).toBe(0);
      for (let i = 1; i < numeric.length; i += 1) {
        expect(numeric[i]).toBe((numeric[i - 1] as number) + 1);
      }
    }
  });

  it('allows UN only on the motor, ataxia, and dysarthria items', () => {
    const withUn = NIHSS_ITEMS.filter((item) =>
      item.options.some((option) => option.value === 'UN'),
    ).map((item) => item.id);
    expect(withUn).toEqual(['5a', '5b', '6a', '6b', '7', '10']);
  });
});

describe('NIHSS case bank integrity', () => {
  it('covers every item exactly once per case with a valid key', () => {
    for (const kasus of NIHSS_CASES) {
      expect(kasus.findings).toHaveLength(15);
      for (const item of NIHSS_ITEMS) {
        const caseFinding = kasus.findings.find((entry) => entry.itemId === item.id);
        expect(caseFinding, `${kasus.id} is missing item ${item.id}`).toBeDefined();
        expect(item.options.map((option) => option.value)).toContain(caseFinding?.key);
        expect(caseFinding?.finding.length).toBeGreaterThan(10);
        expect(caseFinding?.explanation.length).toBeGreaterThan(3);
      }
    }
  });

  it('has the hand-computed key totals', () => {
    expect(nihssCaseKeyTotal(getNihssCase('case-a'))).toBe(14);
    expect(nihssCaseKeyTotal(getNihssCase('case-b'))).toBe(5);
    expect(nihssCaseKeyTotal(getNihssCase('case-c'))).toBe(4);
    expect(nihssCaseKeyTotal(getNihssCase('case-d'))).toBe(29);
  });
});

describe('nihssTotal and nihssBand', () => {
  it('sums numbers and treats UN and null as zero contribution', () => {
    const scores: (NihssScore | null)[] = [2, 'UN', 3, null, 0];
    expect(nihssTotal(scores)).toBe(5);
  });

  it('maps band edges', () => {
    expect(nihssBand(0)).toContain('No stroke symptoms');
    expect(nihssBand(4)).toBe('Minor');
    expect(nihssBand(5)).toBe('Moderate');
    expect(nihssBand(15)).toBe('Moderate');
    expect(nihssBand(16)).toBe('Moderate to severe');
    expect(nihssBand(20)).toBe('Moderate to severe');
    expect(nihssBand(21)).toBe('Severe');
    expect(nihssBand(42)).toBe('Severe');
  });
});

describe('scoreNihssCase', () => {
  const perfectAnswers = (caseId: string): Record<string, NihssScore> => {
    const answers: Record<string, NihssScore> = {};
    for (const caseFinding of getNihssCase(caseId).findings) {
      answers[caseFinding.itemId] = caseFinding.key;
    }
    return answers;
  };

  it('scores a perfect run as all exact with matching totals', () => {
    const result = scoreNihssCase(getNihssCase('case-a'), perfectAnswers('case-a'));
    expect(result.exactCount).toBe(15);
    expect(result.answeredCount).toBe(15);
    expect(result.userTotal).toBe(14);
    expect(result.keyTotal).toBe(14);
    expect(result.recommended).toEqual([]);
    expect(result.userBand).toBe(result.keyBand);
  });

  it('marks an off-by-one answer as close and a bigger error as a miss', () => {
    const answers = perfectAnswers('case-a');
    answers['4'] = 1; // key 2: off by one
    answers['5b'] = 4; // key 2: off by two
    const result = scoreNihssCase(getNihssCase('case-a'), answers);
    const face = result.items.find((entry) => entry.itemId === '4');
    const arm = result.items.find((entry) => entry.itemId === '5b');
    expect(face?.status).toBe('close');
    expect(face?.gap).toBe(1);
    expect(arm?.status).toBe('miss');
    expect(arm?.gap).toBe(2);
    expect(result.exactCount).toBe(13);
    // Biggest gap first in the review list.
    expect(result.recommended[0]).toBe('5b');
    expect(result.recommended).toContain('4');
  });

  it('marks a UN answer against a numeric key as a miss', () => {
    const answers = perfectAnswers('case-b');
    answers['5a'] = 'UN'; // key 1
    const result = scoreNihssCase(getNihssCase('case-b'), answers);
    const arm = result.items.find((entry) => entry.itemId === '5a');
    expect(arm?.status).toBe('miss');
  });

  it('marks missing answers as unanswered and excludes them from exact counts', () => {
    const answers = perfectAnswers('case-c');
    delete answers['7'];
    const result = scoreNihssCase(getNihssCase('case-c'), answers);
    const ataxia = result.items.find((entry) => entry.itemId === '7');
    expect(ataxia?.status).toBe('unanswered');
    expect(result.answeredCount).toBe(14);
    expect(result.recommended).toContain('7');
  });
});

describe('drillsForItem', () => {
  it('returns one drill per case, all for the requested item', () => {
    const drills = drillsForItem('5b');
    expect(drills).toHaveLength(NIHSS_CASES.length);
    for (const drill of drills) {
      const kasus = getNihssCase(drill.caseId);
      const caseFinding = kasus.findings.find((entry) => entry.itemId === '5b');
      expect(drill.finding).toBe(caseFinding?.finding);
      expect(drill.key).toBe(caseFinding?.key);
    }
  });

  it('includes the classic drift-versus-bed contrast for motor arm', () => {
    const leftKeys = drillsForItem('5a').map((drill) => drill.key);
    expect(leftKeys).toContain(1); // drift that never lands (case B)
    expect(leftKeys).toContain(4); // no movement at all (case D)
    const rightKeys = drillsForItem('5b').map((drill) => drill.key);
    expect(rightKeys).toContain(2); // effort present but falls to the bed (case A)
  });
});
