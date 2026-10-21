// Case bank, territory table, and deterministic scoring for the
// Localization Challenge. Findings are structured, the answer is two layers
// (side and level, then arterial territory), and partial credit comes from
// this fixed table only. Cases are original teaching cases.

import { summarizeScore } from './engine';
import type { ScorePart, ScoreSummary } from './engine';

export type SideId = 'left' | 'right';
export type LevelId = 'cortical' | 'subcortical' | 'brainstem' | 'cerebellum';

export const SIDE_LABELS: Record<SideId, string> = {
  left: 'Left side lesion',
  right: 'Right side lesion',
};

export const LEVEL_LABELS: Record<LevelId, string> = {
  cortical: 'Cortical',
  subcortical: 'Subcortical (deep white matter and capsule)',
  brainstem: 'Brainstem',
  cerebellum: 'Cerebellum',
};

export interface Territory {
  id: string;
  label: string;
  /** Artery family used for near-miss partial credit. */
  family: string;
  /** One line describing the classic deficit pattern of this territory. */
  pattern: string;
}

export const TERRITORIES: Territory[] = [
  {
    id: 'mca-superior',
    label: 'MCA, superior division',
    family: 'MCA',
    pattern: 'Face and arm dominant weakness with expressive (Broca) aphasia when dominant.',
  },
  {
    id: 'mca-inferior',
    label: 'MCA, inferior division',
    family: 'MCA',
    pattern: 'Fluent (Wernicke) aphasia or neglect, visual field cut, little or no weakness.',
  },
  {
    id: 'mca-deep',
    label: 'MCA deep branches (lenticulostriate)',
    family: 'MCA',
    pattern: 'Pure motor or sensorimotor patterns from capsule and basal ganglia, no cortical signs.',
  },
  {
    id: 'aca',
    label: 'ACA (anterior cerebral artery)',
    family: 'ACA',
    pattern: 'Leg dominant weakness and sensory loss, sometimes abulia or grasp reflex.',
  },
  {
    id: 'pca',
    label: 'PCA (posterior cerebral artery)',
    family: 'PCA',
    pattern: 'Homonymous visual field loss, alexia, memory or thalamic sensory patterns.',
  },
  {
    id: 'brainstem-perforators',
    label: 'Brainstem perforators (basilar and vertebral branches)',
    family: 'posterior',
    pattern: 'Crossed signs: cranial nerve findings on one side, body findings on the other.',
  },
  {
    id: 'cerebellar-arteries',
    label: 'Cerebellar arteries (PICA, AICA, SCA)',
    family: 'posterior',
    pattern: 'Ipsilateral limb ataxia, vertigo, nystagmus, and gait instability without weakness.',
  },
];

export function getTerritory(id: string): Territory | undefined {
  return TERRITORIES.find((t) => t.id === id);
}

export interface LocalizationFinding {
  text: string;
  /** Why this finding fits the key territory, shown after answering. */
  pointsTo: string;
}

export interface LocalizationCase {
  id: string;
  title: string;
  intro: string;
  findings: LocalizationFinding[];
  keySide: SideId;
  keyLevel: LevelId;
  keyTerritory: string;
  /** Labelled honestly when the case is designed to mislead pattern matching. */
  trap?: string;
  explanation: string;
}

export interface LocalizationAnswer {
  side: SideId | null;
  level: LevelId | null;
  territory: string | null;
}

export const LOCALIZATION_CASES: LocalizationCase[] = [
  {
    id: 'the-quiet-lecturer',
    title: 'The quiet lecturer',
    intro: 'A 66 year old retired teacher, brought in two hours after symptoms began at breakfast.',
    findings: [
      {
        text: 'Right face and arm weakness, arm much weaker than leg',
        pointsTo: 'Face and arm dominance maps to the lateral frontal cortex served by the superior MCA division.',
      },
      {
        text: 'Expressive aphasia: effortful, telegraphic speech with preserved understanding',
        pointsTo: 'Broca area sits in the inferior frontal gyrus, superior division territory, in the dominant (left) hemisphere.',
      },
      {
        text: 'Eyes deviated to the left, toward the side of the lesion',
        pointsTo: 'Frontal eye field involvement drives gaze toward the lesion in a cortical stroke.',
      },
      {
        text: 'Right leg power nearly normal',
        pointsTo: 'Leg cortex lies medially in ACA territory, so leg sparing argues against ACA and for MCA.',
      },
    ],
    keySide: 'left',
    keyLevel: 'cortical',
    keyTerritory: 'mca-superior',
    explanation:
      'Face and arm dominant weakness plus expressive aphasia plus gaze deviation is the classic superior division MCA syndrome of the dominant hemisphere. Every finding is cortical, and the leg sparing keeps ACA out of the lead.',
  },
  {
    id: 'fluent-nonsense',
    title: 'Fluent nonsense',
    intro: 'A 71 year old man whose family says he "talks and talks but none of it makes sense".',
    findings: [
      {
        text: 'Fluent speech full of wrong and invented words; he does not understand questions',
        pointsTo: 'Wernicke aphasia localises to the posterior superior temporal cortex, inferior MCA division.',
      },
      {
        text: 'Right superior quadrantanopia',
        pointsTo: 'Temporal (Meyer) loop fibres carrying the superior visual field run through inferior division territory.',
      },
      {
        text: 'No limb weakness; mild right arm drift only',
        pointsTo: 'Motor cortex is supplied by the superior division, so major weakness would point away from this answer.',
      },
      {
        text: 'He is unaware that his speech is abnormal',
        pointsTo: 'Poor insight into a language deficit fits a receptive aphasia of cortical origin.',
      },
    ],
    keySide: 'left',
    keyLevel: 'cortical',
    keyTerritory: 'mca-inferior',
    explanation:
      'Receptive aphasia with a superior quadrantanopia and almost no weakness is the inferior division MCA pattern of the dominant hemisphere. The findings are temporal lobe, which is why the motor strip is spared.',
  },
  {
    id: 'the-heavy-leg',
    title: 'The heavy leg',
    intro: 'A 59 year old woman who could not get out of bed because her left leg would not obey her.',
    findings: [
      {
        text: 'Left leg weakness, severe, with left foot sensory loss',
        pointsTo: 'The leg homunculus sits on the medial hemispheric surface, supplied by the ACA.',
      },
      {
        text: 'Left arm shows only a trace of weakness at the shoulder',
        pointsTo: 'Arm cortex is lateral (MCA); near sparing of the arm argues for a medial lesion.',
      },
      {
        text: 'Grasp reflex present in the left hand',
        pointsTo: 'Frontal release signs fit medial frontal involvement in ACA territory.',
      },
      {
        text: 'She is apathetic and answers questions after long delays',
        pointsTo: 'Abulia is a recognised medial frontal (ACA) feature from cingulate involvement.',
      },
    ],
    keySide: 'right',
    keyLevel: 'cortical',
    keyTerritory: 'aca',
    explanation:
      'Leg dominant weakness with arm sparing is the homunculus speaking: the lesion is medial frontal, ACA territory, on the right. The grasp reflex and abulia are supporting medial frontal signs.',
  },
  {
    id: 'words-without-pictures',
    title: 'Words without pictures',
    intro: 'A 63 year old librarian who suddenly cannot read the newspaper, though she can still write her name.',
    findings: [
      {
        text: 'Right homonymous hemianopia with macular sparing',
        pointsTo: 'A retrochiasmal visual pathway lesion; macular sparing is typical of occipital (PCA) infarction.',
      },
      {
        text: 'Alexia without agraphia: cannot read, can write',
        pointsTo: 'Occipital damage plus splenial involvement disconnects visual input from language areas, a PCA pattern.',
      },
      {
        text: 'Normal limb power, normal sensation, normal speech content',
        pointsTo: 'No motor or MCA signs; the deficit cluster is visual and occipital.',
      },
      {
        text: 'Colours look washed out on the right side of vision',
        pointsTo: 'Occipital cortical involvement explains central colour desaturation in the affected field.',
      },
    ],
    keySide: 'left',
    keyLevel: 'cortical',
    keyTerritory: 'pca',
    explanation:
      'Homonymous hemianopia with macular sparing plus alexia without agraphia is a textbook dominant PCA syndrome. Nothing in the case needs MCA or ACA at all.',
  },
  {
    id: 'equal-everywhere',
    title: 'Equal everywhere',
    intro: 'A 70 year old man with long standing hypertension, weak on the right since waking.',
    findings: [
      {
        text: 'Right face, arm, and leg weakness, all equally severe',
        pointsTo: 'Equal face, arm, and leg involvement suggests a small deep lesion where all fibres run tightly together, such as the internal capsule.',
      },
      {
        text: 'Speech is slurred but language content is fully normal',
        pointsTo: 'Dysarthria without aphasia is a subcortical pattern; aphasia would demand cortex.',
      },
      {
        text: 'No visual field defect, no neglect, no gaze deviation',
        pointsTo: 'The absence of every cortical sign is itself the strongest localising evidence here.',
      },
      {
        text: 'Sensation is mildly reduced on the same side, in the same distribution',
        pointsTo: 'A combined motor and sensory pattern fits capsule and thalamic region involvement from deep branches.',
      },
    ],
    keySide: 'left',
    keyLevel: 'subcortical',
    keyTerritory: 'mca-deep',
    trap: 'Trap case: the dense hemiparesis feels like a big cortical stroke, but there is not one cortical sign. Density of weakness is about fibre packing, not lesion size.',
    explanation:
      'This is the classic pure motor lacunar pattern from a lenticulostriate perforator into the posterior internal capsule. The trap is equating severe weakness with cortex; here every cortical sign is absent and the equality across face, arm, and leg gives the capsule away.',
  },
  {
    id: 'crossed-signals',
    title: 'Crossed signals',
    intro: 'A 75 year old woman with sudden double vision and weakness that her family describes as "mixed up".',
    findings: [
      {
        text: 'Right facial weakness involving the whole face, forehead included',
        pointsTo: 'A whole face weakness at this level means the facial nucleus or fascicle itself, inside the pons.',
      },
      {
        text: 'Left arm and leg weakness',
        pointsTo: 'Body weakness on the opposite side of the face sign is the definition of a crossed brainstem pattern.',
      },
      {
        text: 'Cannot abduct the right eye; horizontal diplopia',
        pointsTo: 'Abducens involvement sits in the pons, close to the facial fibres that loop around its nucleus.',
      },
      {
        text: 'Speech and language normal; no cortical signs',
        pointsTo: 'Nothing points above the tentorium; the crossed pattern keeps the lesion in the brainstem.',
      },
    ],
    keySide: 'right',
    keyLevel: 'brainstem',
    keyTerritory: 'brainstem-perforators',
    explanation:
      'Crossed signs are the brainstem signature: ipsilateral cranial nerve findings (sixth and seventh on the right) with contralateral body weakness. The level is the pons and the vessels are basilar perforators.',
  },
  {
    id: 'the-spinning-room',
    title: 'The spinning room',
    intro: 'A 68 year old man who woke with violent spinning vertigo and keeps falling to his left.',
    findings: [
      {
        text: 'Severe vertigo with horizontal nystagmus',
        pointsTo: 'Vestibular connections run through the lateral medulla and cerebellum, posterior circulation territory.',
      },
      {
        text: 'Left arm and leg ataxia: clumsy, overshooting movements',
        pointsTo: 'Ipsilateral limb ataxia is a cerebellar hemisphere sign, on the same side as the lesion.',
      },
      {
        text: 'Power is completely normal in all four limbs',
        pointsTo: 'Ataxia without weakness separates cerebellar disease from motor pathway lesions.',
      },
      {
        text: 'Gait is wide based and he veers to the left',
        pointsTo: 'Lateropulsion toward the lesion side fits a left cerebellar process.',
      },
    ],
    keySide: 'left',
    keyLevel: 'cerebellum',
    keyTerritory: 'cerebellar-arteries',
    explanation:
      'Vertigo plus ipsilateral ataxia plus preserved power is a cerebellar syndrome, here the left cerebellar hemisphere in PICA range. The side rule flips compared with the cerebrum: cerebellar signs appear on the same side as the lesion.',
  },
  {
    id: 'the-neglected-plate',
    title: 'The neglected plate',
    intro: 'A 74 year old woman who eats only the right half of her plate and bumps into door frames on her left.',
    findings: [
      {
        text: 'Left sided hemispatial neglect: ignores food and people on her left',
        pointsTo: 'Neglect is a parietal cortical sign, classically of the non-dominant (right) inferior MCA territory.',
      },
      {
        text: 'Left inferior quadrantanopia',
        pointsTo: 'Parietal (Baumgarten) radiations carry the inferior visual field, opposite loop to the temporal one.',
      },
      {
        text: 'Mild left arm drift; face and leg normal',
        pointsTo: 'Only minor motor involvement fits inferior division, away from the main motor strip supply.',
      },
      {
        text: 'She denies anything is wrong with her',
        pointsTo: 'Anosognosia commonly accompanies right parietal neglect syndromes.',
      },
    ],
    keySide: 'right',
    keyLevel: 'cortical',
    keyTerritory: 'mca-inferior',
    explanation:
      'Neglect, anosognosia, and an inferior quadrantanopia with minimal weakness form the non-dominant inferior MCA division pattern. Comparing this with the fluent nonsense case shows how one division serves language on the left and attention on the right.',
  },
];

export function getLocalizationCase(id: string): LocalizationCase | undefined {
  return LOCALIZATION_CASES.find((c) => c.id === id);
}

/**
 * Deterministic two layer scoring.
 * Side 20 points, level 30 points, territory 50 points with half credit when
 * the chosen territory is a near miss in the same artery family.
 */
export function scoreLocalizationAnswer(
  c: LocalizationCase,
  answer: LocalizationAnswer,
): ScoreSummary {
  const parts: ScorePart[] = [];
  const keyTerritory = getTerritory(c.keyTerritory);
  const chosenTerritory = answer.territory ? getTerritory(answer.territory) : undefined;

  parts.push({
    id: 'side',
    label: 'Lesion side',
    earned: answer.side === c.keySide ? 20 : 0,
    max: 20,
    note:
      answer.side === c.keySide
        ? `Correct: ${SIDE_LABELS[c.keySide].toLowerCase()}.`
        : `The lesion is on the ${c.keySide}. Remember that cerebellar signs are ipsilateral while cerebral signs are contralateral.`,
  });

  parts.push({
    id: 'level',
    label: 'Level',
    earned: answer.level === c.keyLevel ? 30 : 0,
    max: 30,
    note:
      answer.level === c.keyLevel
        ? `Correct: ${LEVEL_LABELS[c.keyLevel]}.`
        : `The correct level is ${LEVEL_LABELS[c.keyLevel]}. The presence or absence of cortical signs is the main fork.`,
  });

  let territoryEarned = 0;
  let territoryNote = `The key territory is ${keyTerritory?.label ?? c.keyTerritory}.`;
  if (answer.territory === c.keyTerritory) {
    territoryEarned = 50;
    territoryNote = `Exact territory: ${keyTerritory?.label}. ${keyTerritory?.pattern ?? ''}`;
  } else if (
    chosenTerritory &&
    keyTerritory &&
    chosenTerritory.family === keyTerritory.family
  ) {
    territoryEarned = 25;
    territoryNote = `Near miss: same artery family. The key territory is ${keyTerritory.label}. ${keyTerritory.pattern}`;
  }
  parts.push({
    id: 'territory',
    label: 'Arterial territory',
    earned: territoryEarned,
    max: 50,
    note: territoryNote,
  });

  return summarizeScore(parts);
}
