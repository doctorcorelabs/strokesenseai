import { describe, expect, it } from 'vitest';
import { EVIDENCE_CARDS, GUIDELINE_TOPICS, cardsForTopic, getCard } from './guideline-cards';
import {
  DECISION_TREE,
  TREE_ROOT_ID,
  answerFromCards,
  cardsForNode,
  getTreeNode,
  scoreCards,
} from './guideline-engine';
import { GLOSSARY, lookupTerm } from './glossary';
import {
  countSyllables,
  extractLockedElements,
  plainRewriteLocal,
  readabilityStats,
  verifyPreserved,
} from './plain-text';

describe('guideline card library integrity', () => {
  it('every card belongs to a declared topic', () => {
    const topicIds = new Set(GUIDELINE_TOPICS.map((topic) => topic.id));
    for (const card of EVIDENCE_CARDS) {
      expect(topicIds.has(card.topicId)).toBe(true);
    }
  });

  it('every card carries full citation metadata', () => {
    for (const card of EVIDENCE_CARDS) {
      expect(card.citation.publisher.length).toBeGreaterThan(0);
      expect(card.citation.document.length).toBeGreaterThan(0);
      expect(card.citation.section.length).toBeGreaterThan(0);
      expect(card.citation.year).toBeGreaterThan(1990);
    }
  });

  it('every topic has at least one card', () => {
    for (const topic of GUIDELINE_TOPICS) {
      expect(cardsForTopic(topic.id).length).toBeGreaterThan(0);
    }
  });
});

describe('guideline retrieval', () => {
  it('ranks the thrombolysis window card first for a window question', () => {
    const scored = scoreCards('What is the time window for intravenous thrombolysis?');
    expect(scored.length).toBeGreaterThan(0);
    expect(scored[0]?.card.id).toBe('gn-iv-window');
  });

  it('finds the blood pressure limit before thrombolysis', () => {
    const answer = answerFromCards('What blood pressure is allowed before thrombolysis, 185/110?');
    expect(answer.refused).toBe(false);
    expect(answer.cards.map((card) => card.id)).toContain('gn-iv-bp');
  });

  it('finds dual antiplatelet duration after minor stroke', () => {
    const answer = answerFromCards('How long is dual antiplatelet therapy with clopidogrel after minor stroke?');
    expect(answer.refused).toBe(false);
    expect(answer.cards[0]?.id).toBe('gn-dapt-minor');
  });

  it('refuses questions outside the library instead of guessing', () => {
    const answer = answerFromCards('What is the best pizza topping for a celebration dinner?');
    expect(answer.refused).toBe(true);
    expect(answer.cards).toHaveLength(0);
    expect(answer.refusalText).toContain('does not cover');
  });

  it('is deterministic: the same question returns the same cards', () => {
    const first = answerFromCards('When is aspirin started after stroke?');
    const second = answerFromCards('When is aspirin started after stroke?');
    expect(first.cards.map((c) => c.id)).toEqual(second.cards.map((c) => c.id));
  });
});

describe('guided decision tree', () => {
  it('root node exists and every option target resolves', () => {
    expect(getTreeNode(TREE_ROOT_ID)).toBeDefined();
    for (const node of Object.values(DECISION_TREE)) {
      for (const option of node.options ?? []) {
        expect(DECISION_TREE[option.next], `target ${option.next}`).toBeDefined();
      }
    }
  });

  it('every leaf references real cards only', () => {
    for (const node of Object.values(DECISION_TREE)) {
      for (const cardId of node.cardIds ?? []) {
        expect(getCard(cardId), `card ${cardId}`).toBeDefined();
      }
      if (node.cardIds) {
        expect(cardsForNode(node).length).toBe(node.cardIds.length);
      }
    }
  });

  it('every node is reachable from the root', () => {
    const seen = new Set<string>([TREE_ROOT_ID]);
    const queue = [TREE_ROOT_ID];
    while (queue.length > 0) {
      const node = DECISION_TREE[queue.shift() ?? ''];
      for (const option of node?.options ?? []) {
        if (!seen.has(option.next)) {
          seen.add(option.next);
          queue.push(option.next);
        }
      }
    }
    expect(seen.size).toBe(Object.keys(DECISION_TREE).length);
  });
});

describe('glossary', () => {
  it('looks up terms case-insensitively', () => {
    expect(lookupTerm('Thrombolysis')?.plainEn).toContain('clot-busting');
    expect(lookupTerm('unknown-term')).toBeUndefined();
  });

  it('every entry has both plain wordings', () => {
    for (const entry of GLOSSARY) {
      expect(entry.plainEn.length).toBeGreaterThan(0);
      expect(entry.plainId.length).toBeGreaterThan(0);
    }
  });
});

describe('readability metrics', () => {
  it('counts syllables for simple words', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('banana')).toBe(3);
    expect(countSyllables('')).toBe(0);
  });

  it('rates plain text as a lower grade than dense medical text', () => {
    const plain = readabilityStats('The cat sat on the mat. The dog ran to the park.');
    const dense = readabilityStats(
      'Intravenous thrombolysis administration necessitates comprehensive neuroimaging evaluation prior to anticoagulation commencement.',
    );
    expect(plain.gradeLevel).toBeLessThan(dense.gradeLevel);
    expect(plain.readingEase).toBeGreaterThan(dense.readingEase);
  });

  it('handles empty text without NaN', () => {
    const stats = readabilityStats('');
    expect(stats.words).toBe(0);
    expect(Number.isNaN(stats.gradeLevel)).toBe(false);
  });
});

describe('locked elements and verification', () => {
  it('extracts numbers with units and medicine names', () => {
    const locked = extractLockedElements('Aspirin 300 mg daily, blood pressure 168/94 mmHg.');
    expect(locked.numbers).toContain('300 mg');
    expect(locked.numbers).toContain('94 mmHg');
    expect(locked.medicines).toContain('aspirin');
  });

  it('passes when a rewrite preserves every number and medicine', () => {
    const original = 'Take aspirin 81 mg once daily for 21 days.';
    const rewritten = 'Take aspirin 81 mg once each day for 21 days.';
    expect(verifyPreserved(original, rewritten).ok).toBe(true);
  });

  it('fails when a dose changes, and names the difference', () => {
    const original = 'Take aspirin 81 mg once daily.';
    const rewritten = 'Take aspirin 80 mg once daily.';
    const result = verifyPreserved(original, rewritten);
    expect(result.ok).toBe(false);
    expect(result.missingNumbers).toContain('81 mg');
    expect(result.addedNumbers).toContain('80 mg');
  });

  it('fails when a medicine name disappears', () => {
    const original = 'Continue clopidogrel 75 mg daily.';
    const rewritten = 'Continue the tablet 75 mg daily.';
    const result = verifyPreserved(original, rewritten);
    expect(result.ok).toBe(false);
    expect(result.missingMedicines).toContain('clopidogrel');
  });
});

describe('local glossary rewrite', () => {
  it('simplifies known terms in English and keeps numbers intact', () => {
    const original = 'The patient had an ischemic stroke and received thrombolysis within 3 hours.';
    const result = plainRewriteLocal(original, 'en');
    expect(result.text).toContain('blocked blood vessel');
    expect(result.text).toContain('clot-busting');
    expect(result.replacedTerms).toContain('ischemic stroke');
    expect(result.replacedTerms).toContain('thrombolysis');
    expect(verifyPreserved(original, result.text).ok).toBe(true);
  });

  it('simplifies into everyday Indonesian when asked', () => {
    const result = plainRewriteLocal('He has hypertension and diabetes.', 'id');
    expect(result.text).toContain('tekanan darah tinggi');
    expect(result.text).toContain('penyakit gula');
  });

  it('never changes doses or medicine names, so verification always passes', () => {
    const original =
      'Start atorvastatin 80 mg and aspirin 300 mg. Blood glucose was 190 mg/dL with hypertension and dysphagia.';
    const result = plainRewriteLocal(original, 'en');
    expect(result.text).toContain('atorvastatin 80 mg');
    expect(result.text).toContain('aspirin 300 mg');
    expect(verifyPreserved(original, result.text).ok).toBe(true);
  });

  it('leaves text without glossary terms unchanged', () => {
    const original = 'The ward round starts at nine in the morning.';
    const result = plainRewriteLocal(original, 'en');
    expect(result.text).toBe(original);
    expect(result.replacedTerms).toHaveLength(0);
  });
});
