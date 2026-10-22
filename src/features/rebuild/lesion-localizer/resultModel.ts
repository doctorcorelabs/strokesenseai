// Pure mapping from a localizer analysis to what the result sheet
// shows. Everything clinical arrives in the analysis itself; this
// module only decides presentation: which diagram level a free-text
// site lights up, what the pattern code is called in plain words, and
// which confidence label a candidate carries. Keeping the mapping
// pure makes it testable without rendering.

import type {
  LocalizerAnalysis,
  LocalizerCandidate,
  LocalizerConfidence,
} from '../../../ai/visionClient';
import type { PathwayLevel } from './PathwayDiagram';

export type { PathwayLevel };

export interface CandidateView extends LocalizerCandidate {
  /** Diagram level this candidate lights up, or null when unmapped. */
  level: PathwayLevel | null;
}

export interface LocalizerView {
  patternTitle: string;
  patternNote: string;
  observations: string[];
  candidates: CandidateView[];
  possibilities: { name: string; note: string }[];
  /** Level lit on the pathway diagram: the top candidate that maps. */
  activeLevel: PathwayLevel | null;
}

// Keyword groups are checked in order. The capsule group runs first
// because "subcortical" contains the word "cortical" but belongs to
// the deep pathway, and the pons group runs before the peripheral
// group because "facial nucleus" is a pontine structure while
// "facial nerve" is the peripheral one.
const LEVEL_KEYWORDS: { level: PathwayLevel; keywords: string[] }[] = [
  {
    level: 'internal-capsule',
    keywords: ['internal capsule', 'capsule', 'capsular', 'genu', 'corona radiata', 'subcortical'],
  },
  {
    level: 'cortex',
    keywords: ['cortex', 'cortical', 'precentral', 'gyrus', 'rolandic', 'motor strip'],
  },
  {
    level: 'pons',
    keywords: ['pons', 'pontine', 'brainstem', 'brain stem', 'nucleus', 'fascicle', 'peduncle', 'colliculus'],
  },
  {
    level: 'peripheral',
    keywords: ['peripheral', 'facial nerve', 'nerve', 'canal', 'extracranial', 'parotid'],
  },
];

/**
 * Map a free-text candidate site from the Worker to one of the four
 * diagram levels. Returns null when nothing recognizable is named, so
 * the diagram simply shows no highlight rather than a wrong one.
 */
export function siteToLevel(site: string): PathwayLevel | null {
  const text = site.toLowerCase();
  for (const group of LEVEL_KEYWORDS) {
    if (group.keywords.some((keyword) => text.includes(keyword))) {
      return group.level;
    }
  }
  return null;
}

const PATTERN_COPY: Record<string, { title: string; note: string }> = {
  'central-umn': {
    title: 'Central pattern (upper motor neuron)',
    note: 'The lower face looks weaker on one side while the forehead still works. That combination points inside the brain, to the command pathway above the face-control centre in the brainstem (the pons).',
  },
  'peripheral-lmn': {
    title: 'Peripheral pattern (lower motor neuron)',
    note: 'The whole half of the face looks weaker, forehead included. That combination points to the face-control centre itself, or to the facial nerve (the cable carrying the signal to the face muscles) after it leaves the brainstem.',
  },
  unclear: {
    title: 'Atypical pattern',
    note: 'The signs in this photo do not fit either textbook pattern cleanly, so no single level is favoured. Real faces often break the textbook rules.',
  },
  'none-visible': {
    title: 'No clear one-sided pattern',
    note: 'The AI could not see a clear one-sided droop in this photo, so there is no pattern to localize.',
  },
};

export const CONFIDENCE_LABELS: Record<LocalizerConfidence, string> = {
  high: 'High confidence',
  moderate: 'Moderate confidence',
  low: 'Low confidence',
};

/** Build the render-ready view of one analysis. */
export function toResultView(analysis: LocalizerAnalysis): LocalizerView {
  const pattern = analysis.pattern ? PATTERN_COPY[analysis.pattern] : undefined;
  const candidates: CandidateView[] = analysis.lesionCandidates.map((candidate) => ({
    ...candidate,
    level: siteToLevel(candidate.site),
  }));
  const topMapped = candidates.find((candidate) => candidate.level !== null);
  return {
    patternTitle: pattern?.title ?? 'Pattern from this photo',
    patternNote: pattern?.note ?? '',
    observations: analysis.observations,
    candidates,
    possibilities: analysis.possibilities,
    activeLevel: topMapped?.level ?? null,
  };
}

/**
 * Static teaching example for step 1, in the exact shape a real
 * result takes, so the example renders through the same components.
 * Labelled as an example everywhere it appears; it is not a patient.
 */
export const EXAMPLE_ANALYSIS: LocalizerAnalysis = {
  headline: 'The right lower face looks weaker, and the forehead still wrinkles on both sides.',
  observations: [
    'The right mouth corner sits lower and lifts less in the smile.',
    'The fold beside the nose (the nasolabial fold) looks shallower on the right.',
    'Forehead wrinkles still form on the right, and both eyes appear to close fully.',
  ],
  cannotAnalyze: false,
  reason: null,
  pattern: 'central-umn',
  lesionCandidates: [
    {
      site: 'Genu of the internal capsule, left side',
      tract: 'Corticobulbar tract (the command pathway from the brain to the face muscles)',
      vessel: 'Lateral lenticulostriate arteries; capsular branches of the anterior choroidal artery',
      confidence: 'moderate',
      rationale:
        'A spared forehead with a weak lower face on the opposite side is the classic deep pathway pattern, and the face fibres pass through the genu.',
    },
    {
      site: 'Face motor cortex (lower precentral gyrus), left side',
      tract: 'Corticobulbar tract, where the pathway begins',
      vessel: 'Precentral (rolandic) branch of the middle cerebral artery (MCA)',
      confidence: 'moderate',
      rationale:
        'A cortical lesion gives the same forehead-sparing pattern. A photo alone cannot separate cortex from capsule, so both stay on the list.',
    },
    {
      site: 'Pons, left side (basis pontis)',
      tract: 'Corticobulbar fibres passing through the pons',
      vessel: 'Paramedian perforators of the basilar artery',
      confidence: 'low',
      rationale:
        'Fibres on their way down can be hit in the pons and still spare the forehead, but this is a less common reading of this picture.',
    },
  ],
  possibilities: [
    {
      name: 'Ischemic stroke in MCA territory',
      note: 'A sudden forehead-sparing droop fits a blocked branch of the middle cerebral artery on the opposite side.',
    },
    {
      name: 'Small subcortical infarct (lacunar stroke)',
      note: 'A tiny deep infarct in the capsule can produce exactly this face picture, often with long-standing high blood pressure or diabetes.',
    },
    {
      name: 'Bell palsy',
      note: 'Less consistent here: in Bell palsy the forehead is weak too, and in this example it still wrinkles.',
    },
  ],
  emergency: false,
};
