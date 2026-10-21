// Prewritten local guides, used when no AI endpoint is configured.
// Honest by design: this text is curated guidance, not a generated answer.
// Every guide is educational and neutral, and none of them makes a
// diagnostic claim about the person using the tool.

import { OFFLINE_TOPICS } from '../safety';

const GUIDES: Record<string, string> = {
  'face-analyzer':
    'This tool measures facial geometry: distances and angles between facial landmarks in a photo or synthetic sample. A measurement describes the image, not a medical condition, and ordinary faces are naturally asymmetric. If the photo is blurry, turned, or unevenly lit, the tool reports that it cannot analyze the image instead of guessing.',
  'scan-explainer':
    'This explainer works only with curated teaching scans from its library. Annotations written by the curators are the source of truth, and the AI may only explain what those annotations describe. A teaching example shows what a structure can look like; it is not a reading of any person\'s scan and cannot be generalized to other patients.',
  'comprehension-check':
    'This exercise practices following spoken instructions: listen to a command, then respond by touch. Scores are simple counts of correct targets, step order, and response time, calculated on your device. Difficulty here can come from the synthetic voice, the volume, or the English wording, so treat the result as practice feedback only.',
  'arm-drift':
    'This tool tracks arm position over a short hold and reports angles, drift in degrees, and how the two sides compare. A short recording describes movement during those seconds; it cannot measure strength and it cannot detect or rule out stroke. Landmarks that disappear are shown as gaps in the graph, never filled in with invented values.',
  'mimic-detective':
    'Stroke mimics are conditions that can look like a stroke at first, such as low blood sugar, weakness after a seizure, migraine aura, and functional weakness. In these fictional cases you gather clues step by step, and the scoring rewards safe habits, like checking blood sugar before concluding. In real life, a suspected stroke is always an emergency first and a mimic is considered only after urgent assessment.',
  'localization-challenge':
    'Localization means reasoning from a pattern of deficits to the brain territory that could explain them. A face-and-arm pattern suggests a different territory than a pure vision loss, and crossed signs point toward the brainstem. Treat every answer here as a hypothesis for learning: in real care, clinical localization is always confirmed with imaging.',
  'discharge-lens':
    'This tool extracts structured facts from a discharge document and ties every fact to the exact source line it came from. A fact that cannot be verified against its cited line is marked unverified, and relative dates such as "next week" are shown as written, never converted into calendar dates. Extraction can be wrong, so always check the result against the original paper.',
  'plain-translator':
    'This tool rewrites medical wording in plain language while keeping every number, dose, date, and medicine name exactly as written. After rewriting, the numbers and names are checked against the original; if anything changed, the result is withheld and the difference is highlighted instead. The simpler text is a rewording of the same information, not new medical advice.',
  'stroke-code-simulator':
    'This simulator practices the order of decisions in the first minutes of a fictional stroke case: recognize the signs, record the last known well time, activate the emergency pathway, and prioritize imaging. Timing and decision scores come from a fixed rubric in code; the AI examiner only explains your reasoning. Real decisions follow your local stroke team and protocol.',
};

const FALLBACK_GUIDE =
  'This tool runs in offline guide mode, so no AI request is sent and this text is prewritten. Explore the synthetic samples and controls to see what the tool measures and what it deliberately does not claim. If you are experiencing sudden new symptoms, call 119 in Indonesia now instead of using any tool on this site.';

/** Return the prewritten guide for a feature id, or a generic guide. */
export function offlineGuideFor(featureId: string): string {
  return GUIDES[featureId] ?? FALLBACK_GUIDE;
}

// ---------------------------------------------------------------------------
// Offline question matching
// ---------------------------------------------------------------------------

const TOPIC_STOPWORDS = new Set([
  'what',
  'does',
  'is',
  'a',
  'an',
  'the',
  'can',
  'how',
  'do',
  'i',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
]);

// Words too generic to identify a topic on their own: they only count
// toward a match together with a second shared word.
const GENERIC_WORDS = new Set(['stroke', 'happen', 'happens']);

function topicWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !TOPIC_STOPWORDS.has(word));
}

export interface OfflineTopicMatch {
  question: string;
  reply: string;
}

/**
 * Match a free-form question against the prewritten OFFLINE_TOPICS by
 * simple keyword overlap, so an offline question is answered with the
 * matching topic whenever one exists instead of being ignored. A topic
 * matches when the question shares one distinctive keyword with the
 * topic's question, or at least two keywords in total. Returns null when
 * nothing fits, and the caller says so honestly.
 */
export function matchOfflineTopic(question: string): OfflineTopicMatch | null {
  const asked = new Set(topicWords(question));
  if (asked.size === 0) return null;
  let best: { topic: OfflineTopicMatch; distinctive: number; total: number } | null = null;
  for (const topic of OFFLINE_TOPICS) {
    const keywords = topicWords(topic.question);
    const shared = keywords.filter((word) => asked.has(word));
    const distinctive = shared.filter((word) => !GENERIC_WORDS.has(word)).length;
    if (distinctive < 1 && shared.length < 2) continue;
    if (
      !best ||
      distinctive > best.distinctive ||
      (distinctive === best.distinctive && shared.length > best.total)
    ) {
      best = { topic, distinctive, total: shared.length };
    }
  }
  return best ? { question: best.topic.question, reply: best.topic.reply } : null;
}
