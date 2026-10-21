// Case bank and deterministic scoring for Stroke Mimic Detective.
// All cases are original, synthetic teaching cases. The key diagnosis, the
// decisive clues, and the safety checks are fixed data written for this lab;
// scoring never asks a model to judge an answer.

import { proportionalPoints, summarizeScore } from './engine';
import type { ScorePart, ScoreSummary } from './engine';

export type ClassificationId =
  | 'ischemic-stroke'
  | 'hemorrhage'
  | 'mimic-hypoglycemia'
  | 'mimic-todd'
  | 'mimic-migraine-aura'
  | 'mimic-bell-palsy'
  | 'mimic-functional'
  | 'uncertain-needs-imaging';

export const CLASSIFICATION_LABELS: Record<ClassificationId, string> = {
  'ischemic-stroke': 'Ischemic stroke',
  hemorrhage: 'Intracerebral hemorrhage',
  'mimic-hypoglycemia': 'Mimic: hypoglycemia',
  'mimic-todd': 'Mimic: Todd paresis after a seizure',
  'mimic-migraine-aura': 'Mimic: migraine with aura',
  'mimic-bell-palsy': "Mimic: Bell palsy",
  'mimic-functional': 'Mimic: functional neurological disorder',
  'uncertain-needs-imaging': 'Not yet certain: needs imaging before any label',
};

export type ClueWeight = 'decisive' | 'supportive' | 'neutral';

export interface MimicClue {
  id: string;
  label: string;
  kind: 'bedside check' | 'history' | 'examination' | 'test';
  result: string;
  weight: ClueWeight;
  /** True for basic safety checks that should never be skipped, such as glucose. */
  safety?: boolean;
  feedback: string;
}

export interface MimicCase {
  id: string;
  title: string;
  /** Stage 1 vignette: what is known on arrival. */
  presentation: string;
  /** Stage 2 reveal: new information after the differential is committed. */
  reveal: string;
  /** How many clues the learner may open in stage 2. */
  clueBudget: number;
  clues: MimicClue[];
  keyClassification: ClassificationId;
  keyLabel: string;
  /** Ids of clues that, once seen, can settle the case. */
  decisiveClueIds: string[];
  explanation: string;
  /** The cognitive trap this case is designed to expose. */
  trap: string;
}

export interface MimicAttempt {
  differential: ClassificationId[];
  chosenClueIds: string[];
  classification: ClassificationId | null;
  decisivePick: string | null;
}

export const MIMIC_CASES: MimicCase[] = [
  {
    id: 'sweaty-before-breakfast',
    title: 'Sweaty before breakfast',
    presentation:
      'A 68 year old man with type 2 diabetes is brought in at 07:10. His wife found him mumbling and unable to move his right arm and leg. Symptoms were first noticed about 40 minutes ago. He takes insulin and two oral diabetes medicines. He looks pale and sweaty.',
    reveal:
      'On examination: right face, arm, and leg weakness with slurred speech. Blood pressure 168/92. He is drowsy but rousable, and his skin is clammy.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Capillary glucose reads 41 mg/dL (2.3 mmol/L).',
        weight: 'decisive',
        safety: true,
        feedback:
          'This is the single most important first check in any acute focal deficit. A glucose this low can produce a full stroke-like picture on its own.',
      },
      {
        id: 'repeat-after-dextrose',
        label: 'Give IV dextrose per protocol and re-examine',
        kind: 'bedside check',
        result: 'Twenty minutes after glucose correction, the right sided weakness and slurred speech have completely resolved.',
        weight: 'decisive',
        feedback:
          'Deficits that fully reverse when glucose normalises confirm the mimic. The timeline of recovery is itself diagnostic information.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'No hemorrhage. No early ischemic change visible.',
        weight: 'neutral',
        feedback:
          'A normal early CT does not separate stroke from mimic. It mainly excludes bleeding; it cannot confirm either diagnosis here.',
      },
      {
        id: 'med-history',
        label: 'Ask about recent medicine changes and meals',
        kind: 'history',
        result: 'His insulin dose was increased three days ago, and he skipped dinner last night.',
        weight: 'supportive',
        feedback:
          'A recent insulin increase plus a missed meal makes hypoglycemia much more likely. Supportive, but the glucose value is what decides.',
      },
      {
        id: 'ecg',
        label: 'ECG',
        kind: 'test',
        result: 'Sinus rhythm, rate 88. No acute changes.',
        weight: 'neutral',
        feedback: 'Useful for the wider workup, but it does not discriminate in this case.',
      },
      {
        id: 'witness-timeline',
        label: 'Ask the wife about the exact onset',
        kind: 'history',
        result: 'He was last seen normal at 06:20 when he got up. She found him at 06:45 already weak and sweaty.',
        weight: 'supportive',
        feedback:
          'A clear last known well matters for real stroke decisions, but it does not tell you the cause of this deficit.',
      },
    ],
    keyClassification: 'mimic-hypoglycemia',
    keyLabel: 'Hypoglycemia mimicking an acute stroke',
    decisiveClueIds: ['glucose', 'repeat-after-dextrose'],
    explanation:
      'The glucose of 41 mg/dL with complete resolution of the deficit after correction settles this case. Low glucose starves neurons and can imitate almost any focal pattern, including a full hemiparesis with dysarthria. The lesson is procedural: glucose is checked before conclusions, every time, because it is fast, cheap, and changes management immediately.',
    trap: 'Anchoring on the stroke pathway. A hemiparesis in an older adult feels like a stroke until proven otherwise, and the mimic hides behind that first impression.',
  },
  {
    id: 'the-quiet-hour-after',
    title: 'The quiet hour after',
    presentation:
      'A 34 year old woman is brought in by her partner. She is confused and her left arm and leg are weak. Her partner says she "fell and shook" at home about an hour ago, then seemed to sleep. She has a bitten tongue edge and wet clothing from lost bladder control.',
    reveal:
      'On examination: left sided weakness, sluggish responses, and she keeps drifting toward sleep. Blood pressure 132/78, glucose 104 mg/dL. There is dried blood at the corner of her mouth.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Glucose 104 mg/dL (5.8 mmol/L), normal.',
        weight: 'supportive',
        safety: true,
        feedback:
          'Normal glucose removes the most dangerous reversible mimic from the table. Doing this check is scored as a safety habit, not a discriminator.',
      },
      {
        id: 'seizure-history',
        label: 'Take a detailed witness account of the shaking episode',
        kind: 'history',
        result:
          'Her partner describes two minutes of rhythmic whole body shaking, then unresponsiveness, then slow confusion. She has epilepsy and missed her medicines twice this week.',
        weight: 'decisive',
        feedback:
          'A witnessed generalised convulsion immediately before the weakness, in a person with epilepsy who missed doses, is the decisive pattern for postictal weakness.',
      },
      {
        id: 'serial-exam',
        label: 'Repeat the neurological examination after 45 minutes',
        kind: 'examination',
        result: 'The left sided weakness is steadily melting away and she is now fully alert and asking for water.',
        weight: 'decisive',
        feedback:
          'Postictal (Todd) paresis characteristically improves over minutes to hours. A deficit that fades on serial examination argues strongly against an established infarct.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'No hemorrhage, no mass, no early ischemic change.',
        weight: 'neutral',
        feedback: 'Reassuring but not discriminating. Both Todd paresis and early ischemia can sit behind a normal CT.',
      },
      {
        id: 'lactate',
        label: 'Blood lactate',
        kind: 'test',
        result: 'Lactate 3.1 mmol/L, mildly raised, falling on the repeat sample.',
        weight: 'supportive',
        feedback: 'A transient lactate rise fits recent convulsive muscle activity. Supportive only; it is not specific.',
      },
      {
        id: 'med-list',
        label: 'Review her regular medicines',
        kind: 'history',
        result: 'Levetiracetam 500 mg twice daily. The pill box shows two untouched doses.',
        weight: 'supportive',
        feedback: 'Missed antiepileptic doses raise the pretest chance of a seizure. The witness account still carries the decision.',
      },
    ],
    keyClassification: 'mimic-todd',
    keyLabel: 'Todd paresis following a generalised seizure',
    decisiveClueIds: ['seizure-history', 'serial-exam'],
    explanation:
      'Weakness after a seizure (Todd paresis) follows the convulsed territory and resolves over minutes to hours. The bitten tongue, incontinence, witnessed convulsion, missed antiepileptic doses, and steady improvement on serial examination all point the same way. The skill is asking the witness exactly what the shaking looked like, because the patient cannot tell you herself.',
    trap: 'Premature closure on the weakness itself. If you examine the deficit but never reconstruct the hour before it, the cause stays invisible.',
  },
  {
    id: 'marching-lights',
    title: 'Marching lights',
    presentation:
      'A 27 year old woman arrives worried. Over the last 25 minutes she saw shimmering zigzag lights that slowly spread across the left side of her vision, then her left hand tingled, and now her speech feels "thick" and word finding is hard. A throbbing headache is building behind her right eye. She has had two similar episodes in the past year that settled fully.',
    reveal:
      'On examination: mild word finding difficulty, otherwise normal power and sensation. Glucose 96 mg/dL. Blood pressure 118/74. The visual shimmering has already faded.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Glucose 96 mg/dL (5.3 mmol/L), normal.',
        weight: 'supportive',
        safety: true,
        feedback: 'Glucose excluded, as it always must be. It does not separate migraine aura from stroke.',
      },
      {
        id: 'symptom-march',
        label: 'Ask her to describe the exact order and speed of symptoms',
        kind: 'history',
        result:
          'Each symptom built up gradually over several minutes, one after another: vision first, then tingling, then speech. Nothing was maximal at the very start.',
        weight: 'decisive',
        feedback:
          'A gradual march of positive symptoms over minutes is the signature of cortical spreading depression in migraine aura. Stroke deficits are usually sudden and maximal at onset.',
      },
      {
        id: 'prior-episodes',
        label: 'Ask about previous similar episodes',
        kind: 'history',
        result: 'Two identical episodes last year, each followed by headache, each fully resolved within an hour.',
        weight: 'decisive',
        feedback:
          'Stereotyped, fully reversible prior episodes with headache strongly support migraine with aura rather than recurrent stroke at 27.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'Normal.',
        weight: 'neutral',
        feedback: 'Expected in aura, and also common in early ischemia. It cannot make this decision for you.',
      },
      {
        id: 'visual-exam',
        label: 'Test the visual fields carefully',
        kind: 'examination',
        result: 'Full visual fields now. She describes the earlier zigzags as bright and shimmering, not as a missing piece of vision.',
        weight: 'supportive',
        feedback:
          'Positive visual phenomena (lights, zigzags) point toward aura; stroke more often causes negative phenomena, meaning lost vision.',
      },
      {
        id: 'family-history',
        label: 'Ask about family history',
        kind: 'history',
        result: 'Her mother has migraine with aura.',
        weight: 'neutral',
        feedback: 'Fits the picture, but family history alone never settles an acute presentation.',
      },
    ],
    keyClassification: 'mimic-migraine-aura',
    keyLabel: 'Migraine with aura mimicking stroke',
    decisiveClueIds: ['symptom-march', 'prior-episodes'],
    explanation:
      'Migraine aura produces positive, gradually marching symptoms that cross modalities in sequence, then resolve, often followed by headache. Two features did the heavy lifting here: the slow march (minutes, not seconds) and identical fully reversed episodes in the past. In a first ever episode, or at older ages, imaging still comes first; this case is solvable because the history is so characteristic.',
    trap: 'Treating every acute speech disturbance as aphasia from stroke. Tempo is a finding: ask how the symptom behaved minute by minute.',
  },
  {
    id: 'the-uneven-smile',
    title: 'The uneven smile',
    presentation:
      'A 45 year old man notices at breakfast that the right side of his face "will not move". He cannot whistle, his right eye will not fully close, and food collects in his right cheek. He is frightened it is a stroke. Arms and legs feel completely normal, speech is normal, and taste on the front of the tongue seems dulled.',
    reveal:
      'On examination: the whole right side of the face is weak, forehead included. He cannot raise the right eyebrow or scrunch the right eye shut. Limb power, reflexes, and speech are entirely normal. Glucose 101 mg/dL.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Glucose 101 mg/dL (5.6 mmol/L), normal.',
        weight: 'supportive',
        safety: true,
        feedback: 'Normal, as required. The discrimination in this case comes from the face examination itself.',
      },
      {
        id: 'forehead-test',
        label: 'Test the forehead: eyebrow raise and forced eye closure',
        kind: 'examination',
        result:
          'The right forehead is smooth and weak. He cannot raise the right eyebrow, and you can open his right eye easily against his effort.',
        weight: 'decisive',
        feedback:
          'Forehead involvement localises the lesion to the facial nerve itself (a lower motor neuron pattern). A central stroke spares the forehead because the forehead receives input from both hemispheres.',
      },
      {
        id: 'full-neuro-screen',
        label: 'Screen the rest of the neurological examination',
        kind: 'examination',
        result: 'No limb weakness, no drift, normal speech, normal gait, no other cranial nerve findings.',
        weight: 'supportive',
        feedback:
          'A truly isolated facial weakness with a completely normal screen fits a peripheral nerve problem rather than a hemispheric event.',
      },
      {
        id: 'ear-exam',
        label: 'Examine the ear and ask about ear pain or rash',
        kind: 'examination',
        result: 'No vesicles. Mild ache behind the right ear since yesterday.',
        weight: 'supportive',
        feedback:
          'Retroauricular ache is common in Bell palsy. Vesicles would have suggested Ramsay Hunt syndrome instead; their absence still leaves Bell palsy as the pattern.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'Normal.',
        weight: 'neutral',
        feedback: 'Not the deciding tool here. The forehead examination already localised the lesion outside the brain.',
      },
      {
        id: 'lyme-travel',
        label: 'Ask about tick exposure and recent travel',
        kind: 'history',
        result: 'No ticks, no recent travel, no rash.',
        weight: 'neutral',
        feedback: 'Worth a thought in bilateral or recurrent cases. It does not change the localisation in this one.',
      },
    ],
    keyClassification: 'mimic-bell-palsy',
    keyLabel: "Bell palsy (peripheral facial nerve palsy)",
    decisiveClueIds: ['forehead-test'],
    explanation:
      'The forehead is the whole case. Because the upper face receives bilateral cortical input, a stroke weakens only the lower face, while a facial nerve lesion weakens the entire half of the face, forehead and eye closure included. One careful manoeuvre (raise the eyebrows, screw the eyes shut against resistance) separates a peripheral palsy from a central one at the bedside.',
    trap: 'Equating any facial droop with stroke. The pattern of the droop, not its presence, carries the localisation.',
  },
  {
    id: 'silent-room-4',
    title: 'Silent room 4',
    presentation:
      'A 72 year old woman is brought in 50 minutes after her husband noticed she suddenly stopped making sense. She produces fluent but meaningless speech and does not follow commands. Her right face and arm are weak, and her eyes are deviated to the left. She has atrial fibrillation and stopped her anticoagulant last month before dental surgery.',
    reveal:
      'On examination: global aphasia, right lower facial weakness, right arm plegia with moderate leg weakness, left gaze preference. Glucose 118 mg/dL. Blood pressure 178/96.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Glucose 118 mg/dL (6.6 mmol/L), normal for her.',
        weight: 'supportive',
        safety: true,
        feedback:
          'Glucose is normal, so the commonest reversible mimic is out. Notice the habit: the check happens even when the case looks like a textbook stroke.',
      },
      {
        id: 'cortical-signs',
        label: 'Look specifically for cortical signs',
        kind: 'examination',
        result:
          'Global aphasia plus gaze deviation toward the lesion side plus face and arm dominant weakness: a cortical pattern, not a subcortical one.',
        weight: 'decisive',
        feedback:
          'Aphasia and gaze preference are cortical signs. No mimic on the standard list produces this combination, and they point to a large vessel cortical territory.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'No hemorrhage. A dense left middle cerebral artery sign is present.',
        weight: 'decisive',
        feedback:
          'The scan excludes bleeding and the hyperdense artery supports a large vessel occlusion. Imaging here confirms and directs reperfusion decisions.',
      },
      {
        id: 'med-history',
        label: 'Ask about anticoagulant use',
        kind: 'history',
        result: 'Apixaban stopped four weeks ago and never restarted after the dental procedure.',
        weight: 'supportive',
        feedback:
          'Untreated atrial fibrillation supplies the embolic mechanism. It raises the stakes; it does not make the diagnosis alone.',
      },
      {
        id: 'onset-history',
        label: 'Confirm the onset with the husband',
        kind: 'history',
        result: 'She was mid sentence at 14:05 when speech collapsed. Onset was sudden and maximal at the start.',
        weight: 'supportive',
        feedback:
          'Sudden, maximal at onset deficits are the tempo of vascular occlusion, the opposite of the migraine march.',
      },
      {
        id: 'ecg',
        label: 'ECG',
        kind: 'test',
        result: 'Atrial fibrillation, rate 104.',
        weight: 'neutral',
        feedback: 'Consistent with the history. The cortical examination and the scan carry the diagnosis.',
      },
    ],
    keyClassification: 'ischemic-stroke',
    keyLabel: 'Acute ischemic stroke, left MCA territory',
    decisiveClueIds: ['cortical-signs', 'ct-head'],
    explanation:
      'This is the real thing, and the case is in the bank on purpose: a mimic trainer that never contains real strokes would teach the wrong reflex. Sudden maximal onset, a cortical sign cluster (aphasia, gaze deviation, face and arm dominance), an embolic source, normal glucose, and a hyperdense artery converge. The correct behaviour is classification as stroke and immediate escalation along the stroke pathway.',
    trap: 'Overcorrection. After several mimics, the temptation is to hunt for a mimic everywhere. Base rates and cortical signs must be allowed to say "this one is real".',
  },
  {
    id: 'the-moving-target',
    title: 'The moving target',
    presentation:
      'A 58 year old man is referred with suspected stroke: his left arm weakness has come and gone three times today, lasting 20 to 40 minutes each time. Between episodes he seems almost normal. He is anxious and tearful. His wife adds that the weakness "looks different every time" and that he has been under severe strain since losing his job.',
    reveal:
      'On examination during an episode: left arm gives way in a collapsing pattern, but tone is normal and he can briefly hold the arm up when distracted by conversation. Reflexes are normal and symmetrical. Glucose 108 mg/dL. Two earlier episodes today reportedly involved the leg instead, then the face.',
    clueBudget: 4,
    clues: [
      {
        id: 'glucose',
        label: 'Check capillary blood glucose',
        kind: 'bedside check',
        result: 'Glucose 108 mg/dL (6.0 mmol/L), normal.',
        weight: 'supportive',
        safety: true,
        feedback: 'Glucose excluded. The pattern of the episodes and the examination style must do the rest.',
      },
      {
        id: 'pattern-history',
        label: 'Map the anatomy of each episode in detail',
        kind: 'history',
        result:
          'Episode one: left arm. Episode two: left leg. Episode three: left face and arm together. No single vascular territory explains all three.',
        weight: 'decisive',
        feedback:
          'Symptoms that migrate between incompatible territories within hours argue against a single structural lesion. But note the limit: this raises a possibility, it does not prove one.',
      },
      {
        id: 'consistency-exam',
        label: 'Test consistency: Hoover sign and distractibility',
        kind: 'examination',
        result:
          'Hoover sign is positive: involuntary extension of the "weak" leg appears when he flexes the other hip against resistance. The arm holds better when his attention is drawn elsewhere.',
        weight: 'decisive',
        feedback:
          'Positive inconsistency signs are real clinical findings that support a functional pattern. They are rule-in signs, not accusations, and they still do not exclude a coexisting lesion.',
      },
      {
        id: 'ct-head',
        label: 'Non-contrast CT head',
        kind: 'test',
        result: 'Normal.',
        weight: 'neutral',
        feedback:
          'A normal CT is shared by functional presentations, transient ischemia, migraine, and early stroke alike. It discriminates nothing here.',
      },
      {
        id: 'risk-profile',
        label: 'Review vascular risk factors',
        kind: 'history',
        result: 'Non-smoker, normal lipids last year, no diabetes, no atrial fibrillation, blood pressure today 126/78.',
        weight: 'supportive',
        feedback: 'A low vascular risk profile lowers the prior probability of stroke. Supportive context only.',
      },
      {
        id: 'collateral',
        label: 'Ask about the weeks before today',
        kind: 'history',
        result: 'Major psychosocial stress, poor sleep for a month, and a panic episode last week with similar tingling that resolved.',
        weight: 'supportive',
        feedback: 'Context that fits a functional disorder, and a reminder that distress is part of the case, not a distraction from it.',
      },
    ],
    keyClassification: 'uncertain-needs-imaging',
    keyLabel: 'Functional pattern suspected, but imaging is still required',
    decisiveClueIds: ['pattern-history', 'consistency-exam'],
    explanation:
      'The honest key for this case is the uncertain option. The migrating anatomy and positive inconsistency signs make a functional disorder plausible, but recurrent transient deficits can also be transient ischemic attacks, and no bedside pattern licenses skipping imaging in a first presentation. The rubric rewards naming the suspicion and escalating safely, rather than stamping a label that could close the case too early.',
    trap: 'Premature closure in the opposite direction. "Inconsistent" findings can seduce you into skipping the scan; functional and structural disease can also coexist.',
  },
];

export function getMimicCase(id: string): MimicCase | undefined {
  return MIMIC_CASES.find((c) => c.id === id);
}

/** Feedback shown right after the differential is committed. */
export function differentialFeedback(c: MimicCase, picked: ClassificationId[]): string {
  if (picked.length === 0) return 'No differential was committed, so this step scores zero.';
  if (picked.includes(c.keyClassification)) {
    return 'Your differential includes the diagnosis this case turns out to have. Keeping it on the list early is what good calibration looks like.';
  }
  return 'Your differential does not include the diagnosis this case turns out to have. Notice which first impression pushed it off your list.';
}

/**
 * Deterministic score for one Mimic Detective attempt.
 * Parts: final classification 40, decisive evidence named 10, decisive clue
 * found during gathering 20, glucose safety check 15, differential 15.
 */
export function scoreMimicAttempt(c: MimicCase, attempt: MimicAttempt): ScoreSummary {
  const parts: ScorePart[] = [];

  const classificationOk =
    attempt.classification !== null && attempt.classification === c.keyClassification;
  parts.push({
    id: 'classification',
    label: 'Final classification',
    earned: classificationOk ? 40 : 0,
    max: 40,
    note: classificationOk
      ? `Correct: ${c.keyLabel}.`
      : `The key classification was: ${c.keyLabel}.`,
  });

  const decisiveFound = c.decisiveClueIds.filter((id) => attempt.chosenClueIds.includes(id));
  parts.push({
    id: 'decisive-found',
    label: 'Decisive clue uncovered',
    earned: proportionalPoints(decisiveFound.length, c.decisiveClueIds.length, 20),
    max: 20,
    note:
      decisiveFound.length > 0
        ? `You uncovered ${decisiveFound.length} of ${c.decisiveClueIds.length} decisive clues.`
        : 'None of the decisive clues were opened. On the results screen they are marked.',
  });

  const decisiveNamed =
    attempt.decisivePick !== null && c.decisiveClueIds.includes(attempt.decisivePick);
  parts.push({
    id: 'decisive-named',
    label: 'Named the determining evidence',
    earned: decisiveNamed ? 10 : 0,
    max: 10,
    note: decisiveNamed
      ? 'You identified the evidence that settles the case.'
      : 'At the end, you did not name one of the decisive clues as the determining evidence.',
  });

  const glucoseChecked = c.clues.some(
    (clue) => clue.safety && attempt.chosenClueIds.includes(clue.id),
  );
  parts.push({
    id: 'safety-glucose',
    label: 'Safety check: glucose before concluding',
    earned: glucoseChecked ? 15 : 0,
    max: 15,
    note: glucoseChecked
      ? 'Glucose was checked. This habit is scored in every case, whatever the diagnosis.'
      : 'Glucose was never checked. In a real case this is the one omission that can cause direct harm.',
  });

  const diffOk = attempt.differential.includes(c.keyClassification);
  parts.push({
    id: 'differential',
    label: 'Differential included the key diagnosis',
    earned: diffOk ? 15 : 0,
    max: 15,
    note: diffOk
      ? 'The key diagnosis was on your early list.'
      : 'The key diagnosis was missing from your early list.',
  });

  return summarizeScore(parts);
}
