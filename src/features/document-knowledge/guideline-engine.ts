// Retrieval and guided-question logic for the Guideline Navigator.
// Pure and deterministic: the same question always returns the same cards,
// and a question outside the card library returns a refusal instead of an
// invented answer. No network, no model, no storage.

import { EVIDENCE_CARDS, getCard } from './guideline-cards';
import type { EvidenceCard } from './guideline-cards';

const STOPWORDS = new Set([
  'what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'to', 'after', 'before',
  'when', 'how', 'long', 'should', 'does', 'do', 'can', 'with', 'and', 'or', 'in',
  'patient', 'patients', 'stroke', 'given', 'used', 'use', 'about', 'are', 'be',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

/** Expand a query token to the keyword forms it should also match. */
function variants(token: string): string[] {
  const forms = [token];
  if (token.endsWith('s')) forms.push(token.slice(0, -1));
  if (token.endsWith('ing')) forms.push(token.slice(0, -3));
  return forms;
}

export interface ScoredCard {
  card: EvidenceCard;
  score: number;
}

/**
 * Score every card against a free-text question. Keyword hits in the card
 * keyword list weigh most, title hits next, claim hits least. Numbers in
 * the question (for example "185") match card keywords exactly.
 */
export function scoreCards(question: string): ScoredCard[] {
  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return [];
  const wanted = new Set<string>();
  for (const token of queryTokens) {
    for (const form of variants(token)) wanted.add(form);
  }
  const scored: ScoredCard[] = [];
  for (const card of EVIDENCE_CARDS) {
    let score = 0;
    for (const keyword of card.keywords) {
      const keyTokens = tokenize(keyword);
      if (keyTokens.some((kt) => wanted.has(kt))) score += 3;
    }
    for (const token of tokenize(card.title)) {
      if (wanted.has(token)) score += 2;
    }
    for (const token of new Set(tokenize(card.claim))) {
      if (wanted.has(token)) score += 1;
    }
    if (score > 0) scored.push({ card, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id));
}

export const REFUSAL_TEXT =
  'The local card library does not cover that question, so this tool will not guess. Try one of the listed topics, or consult the official guideline documents and your local stroke protocol. Answers here are general education, never a recommendation for an individual case.';

/**
 * One-click example questions shown as chips in the Ask mode. Every entry
 * is covered by the card library above; a unit test pins that none of them
 * is ever refused, so a chip can never lead to a dead end.
 */
export const EXAMPLE_QUESTIONS: string[] = [
  'What is the time window for thrombolysis?',
  'When is aspirin started after stroke?',
  'What blood pressure is allowed before thrombolysis?',
  'When should anticoagulation be started after stroke with atrial fibrillation?',
];

export interface GuidelineAnswer {
  /** Top matching cards, best first. Empty when refused. */
  cards: EvidenceCard[];
  refused: boolean;
  refusalText: string;
}

/** Answer a question from the local library only. */
export function answerFromCards(question: string, limit = 3): GuidelineAnswer {
  const scored = scoreCards(question);
  const top = scored.filter((entry) => entry.score >= 4).slice(0, limit);
  if (top.length === 0) {
    return { cards: [], refused: true, refusalText: REFUSAL_TEXT };
  }
  return { cards: top.map((entry) => entry.card), refused: false, refusalText: '' };
}

// ---------------------------------------------------------------------------
// Guided question tree
// ---------------------------------------------------------------------------

export interface TreeOption {
  label: string;
  next: string;
}

export interface TreeNode {
  id: string;
  prompt: string;
  /** Present on branch nodes. */
  options?: TreeOption[];
  /** Present on leaf nodes: the cards this path leads to. */
  cardIds?: string[];
}

export const TREE_ROOT_ID = 'root';

export const DECISION_TREE: Record<string, TreeNode> = {
  root: {
    id: 'root',
    prompt: 'What do you want to look up?',
    options: [
      { label: 'Emergency treatment in the first hours', next: 'acute' },
      { label: 'Blood pressure targets', next: 'bp-context' },
      { label: 'Medicines after stroke', next: 'medicines' },
      { label: 'Hospital care basics and TIA', next: 'basics' },
    ],
  },
  acute: {
    id: 'acute',
    prompt: 'Which emergency treatment?',
    options: [
      { label: 'Clot-busting medicine through a vein', next: 'leaf-thrombolysis' },
      { label: 'Clot retrieval with a catheter', next: 'leaf-thrombectomy' },
      { label: 'Bleeding in the brain', next: 'leaf-hemorrhage' },
    ],
  },
  'bp-context': {
    id: 'bp-context',
    prompt: 'In which situation?',
    options: [
      { label: 'Around clot-busting treatment', next: 'leaf-bp-lytic' },
      { label: 'Ischemic stroke without clot-busting treatment', next: 'leaf-bp-permissive' },
      { label: 'Bleeding in the brain', next: 'leaf-bp-ich' },
    ],
  },
  medicines: {
    id: 'medicines',
    prompt: 'Which medicine question?',
    options: [
      { label: 'Aspirin and antiplatelets', next: 'leaf-antiplatelet' },
      { label: 'Blood thinners for atrial fibrillation', next: 'leaf-anticoagulation' },
      { label: 'Statins and cholesterol', next: 'leaf-lipids' },
      { label: 'Blood sugar control', next: 'leaf-glucose' },
    ],
  },
  basics: {
    id: 'basics',
    prompt: 'Which care topic?',
    options: [
      { label: 'Swallowing checks and leg clot prevention', next: 'leaf-supportive' },
      { label: 'A TIA that already recovered', next: 'leaf-tia' },
    ],
  },
  'leaf-thrombolysis': {
    id: 'leaf-thrombolysis',
    prompt: 'Cards for intravenous thrombolysis:',
    cardIds: ['gn-iv-window', 'gn-iv-imaging'],
  },
  'leaf-thrombectomy': {
    id: 'leaf-thrombectomy',
    prompt: 'Cards for thrombectomy:',
    cardIds: ['gn-evt-window', 'gn-evt-transfer'],
  },
  'leaf-hemorrhage': {
    id: 'leaf-hemorrhage',
    prompt: 'Cards for brain hemorrhage:',
    cardIds: ['gn-bp-ich', 'gn-ich-reversal'],
  },
  'leaf-bp-lytic': {
    id: 'leaf-bp-lytic',
    prompt: 'Cards for blood pressure around thrombolysis:',
    cardIds: ['gn-iv-bp'],
  },
  'leaf-bp-permissive': {
    id: 'leaf-bp-permissive',
    prompt: 'Cards for blood pressure without thrombolysis:',
    cardIds: ['gn-bp-permissive'],
  },
  'leaf-bp-ich': {
    id: 'leaf-bp-ich',
    prompt: 'Cards for blood pressure in hemorrhage:',
    cardIds: ['gn-bp-ich'],
  },
  'leaf-antiplatelet': {
    id: 'leaf-antiplatelet',
    prompt: 'Cards for antiplatelet therapy:',
    cardIds: ['gn-asa-early', 'gn-dapt-minor'],
  },
  'leaf-anticoagulation': {
    id: 'leaf-anticoagulation',
    prompt: 'Cards for anticoagulation in atrial fibrillation:',
    cardIds: ['gn-af-timing', 'gn-af-choice'],
  },
  'leaf-lipids': {
    id: 'leaf-lipids',
    prompt: 'Cards for statins and cholesterol:',
    cardIds: ['gn-statin'],
  },
  'leaf-glucose': {
    id: 'leaf-glucose',
    prompt: 'Cards for blood sugar:',
    cardIds: ['gn-glucose'],
  },
  'leaf-supportive': {
    id: 'leaf-supportive',
    prompt: 'Cards for supportive hospital care:',
    cardIds: ['gn-swallow', 'gn-vte'],
  },
  'leaf-tia': {
    id: 'leaf-tia',
    prompt: 'Cards for TIA workup:',
    cardIds: ['gn-tia-urgent'],
  },
};

export function getTreeNode(nodeId: string): TreeNode | undefined {
  return DECISION_TREE[nodeId];
}

/** Resolve a leaf node to its evidence cards, dropping unknown ids. */
export function cardsForNode(node: TreeNode): EvidenceCard[] {
  if (!node.cardIds) return [];
  return node.cardIds
    .map((id) => getCard(id))
    .filter((card): card is EvidenceCard => Boolean(card));
}
