// Local question bank for the Adaptive AI Tutor.
//
// Every question is original educational content written for this lab.
// Answers follow widely taught stroke teaching points (FAST and BE-FAST
// recognition, NIHSS item definitions, classic vascular territories, and
// standard risk factor teaching). Nothing here assesses a real patient;
// the bank trains recognition and reasoning on written prompts only.

export type TutorTopic = 'fast' | 'nihss' | 'vascular' | 'risk';

export type Difficulty = 1 | 2 | 3;

export interface TutorQuestion {
  id: string;
  topic: TutorTopic;
  difficulty: Difficulty;
  /** Short tag grouping questions that train the same habit. */
  tag: string;
  prompt: string;
  options: string[];
  /** Index into options. */
  answerIndex: number;
  explanation: string;
}

export const TOPIC_LABELS: Record<TutorTopic, string> = {
  fast: 'FAST recognition',
  nihss: 'NIHSS items',
  vascular: 'Vascular anatomy',
  risk: 'Risk factors',
};

export const TOPICS: TutorTopic[] = ['fast', 'nihss', 'vascular', 'risk'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: 'Level 1, Foundations',
  2: 'Level 2, Application',
  3: 'Level 3, Reasoning',
};

export const QUESTION_BANK: TutorQuestion[] = [
  // --- FAST recognition ---------------------------------------------------
  {
    id: 'fast-1-1',
    topic: 'fast',
    difficulty: 1,
    tag: 'fast-letters',
    prompt: 'In the FAST check, what does the letter A stand for?',
    options: ['Arm weakness', 'Airway blockage', 'Alertness level', 'Aphasia'],
    answerIndex: 0,
    explanation:
      'FAST stands for Face drooping, Arm weakness, Speech difficulty, and Time to call emergency services. Each letter is one quick observation anyone can make.',
  },
  {
    id: 'fast-1-2',
    topic: 'fast',
    difficulty: 1,
    tag: 'emergency-action',
    prompt:
      'A neighbour suddenly has an uneven smile and one arm drifts downward. What is the safest action?',
    options: [
      'Wait an hour to see if it passes',
      'Give aspirin and let them rest',
      'Call emergency services now (119 in Indonesia) and note the time symptoms were last absent',
      'Ask them to sleep and recheck in the morning',
    ],
    answerIndex: 2,
    explanation:
      'Sudden face and arm signs are treated as an emergency first. Calling immediately and recording the last known well time protects the treatment options that depend on minutes.',
  },
  {
    id: 'fast-2-1',
    topic: 'fast',
    difficulty: 2,
    tag: 'last-known-well',
    prompt: 'Why is the last known well time recorded so carefully in acute stroke care?',
    options: [
      'It is needed for insurance forms',
      'Eligibility windows for clot-busting and clot-removal treatment are measured from it',
      'It decides which ward the patient sleeps in',
      'It is only used to inform the family',
    ],
    answerIndex: 1,
    explanation:
      'Thrombolysis and thrombectomy are offered inside time windows counted from when the person was last known to be well, not from when symptoms were found. An unclear time can close those options.',
  },
  {
    id: 'fast-2-2',
    topic: 'fast',
    difficulty: 2,
    tag: 'be-fast',
    prompt: 'The BE-FAST check adds which two observations to the original FAST letters?',
    options: [
      'Balance and Eyes (vision)',
      'Blood pressure and ECG',
      'Breathing and Eating',
      'Balance and Eating',
    ],
    answerIndex: 0,
    explanation:
      'BE-FAST adds Balance (sudden loss of balance or coordination) and Eyes (sudden vision change). Both help catch strokes that the original face, arm, and speech checks can miss.',
  },
  {
    id: 'fast-3-1',
    topic: 'fast',
    difficulty: 3,
    tag: 'posterior-miss',
    prompt:
      'A patient has sudden severe dizziness, double vision, and a very unsteady gait, but the FAST check looks normal. What is the best interpretation?',
    options: [
      'Stroke is ruled out',
      'A posterior circulation stroke is possible; FAST can miss it, so escalate as an emergency',
      'It is certainly an inner ear infection',
      'The symptoms are most likely anxiety and can wait',
    ],
    answerIndex: 1,
    explanation:
      'FAST is insensitive to posterior circulation signs such as vertigo, diplopia, and gait ataxia. A normal FAST never rules out stroke, and sudden posterior signs are escalated the same way.',
  },
  {
    id: 'fast-3-2',
    topic: 'fast',
    difficulty: 3,
    tag: 'lvo-signs',
    prompt:
      'Which bedside finding most strongly suggests a large vessel occlusion rather than a small deep infarct?',
    options: [
      'Mild clumsiness of one hand only',
      'Isolated slurred speech',
      'Forced gaze deviation with a dense hemiparesis and cortical signs such as aphasia',
      'A single weak foot',
    ],
    answerIndex: 2,
    explanation:
      'Cortical signs (gaze deviation, aphasia, neglect) combined with a dense deficit point to a large cortical territory and raise suspicion of a large vessel occlusion that may need thrombectomy triage.',
  },

  // --- NIHSS items --------------------------------------------------------
  {
    id: 'nihss-1-1',
    topic: 'nihss',
    difficulty: 1,
    tag: 'nihss-range',
    prompt: 'What is the full range of the total NIH Stroke Scale score?',
    options: ['0 to 15', '0 to 42', '1 to 20', '0 to 100'],
    answerIndex: 1,
    explanation:
      'The NIHSS sums 15 items to a total between 0 (no measured deficit) and 42. Higher totals describe more severe measured deficits on the items tested.',
  },
  {
    id: 'nihss-1-2',
    topic: 'nihss',
    difficulty: 1,
    tag: 'nihss-loc',
    prompt: 'Which NIHSS item is assessed first?',
    options: [
      'Item 1a, level of consciousness',
      'Item 4, facial palsy',
      'Item 9, language',
      'Item 11, extinction and inattention',
    ],
    answerIndex: 0,
    explanation:
      'The scale starts with item 1a, level of consciousness, because arousal shapes how every later item can be tested and interpreted.',
  },
  {
    id: 'nihss-2-1',
    topic: 'nihss',
    difficulty: 2,
    tag: 'nihss-loc',
    prompt:
      'A patient is not alert and only opens the eyes in response to painful stimulation. What is the item 1a score?',
    options: ['0', '1', '2', '3'],
    answerIndex: 2,
    explanation:
      'Item 1a scores 2 when the patient is not alert and requires repeated or painful stimulation to respond. A score of 3 is reserved for reflex responses only or complete unresponsiveness.',
  },
  {
    id: 'nihss-2-2',
    topic: 'nihss',
    difficulty: 2,
    tag: 'nihss-gaze',
    prompt:
      'On item 2 (best gaze), a forced gaze deviation that cannot be overcome by reflex maneuvers scores:',
    options: ['0', '1', '2', 'It is not scored'],
    answerIndex: 2,
    explanation:
      'Item 2 scores 1 for a partial gaze palsy that can be partly overcome, and 2 for a forced deviation or total gaze paresis that cannot be overcome.',
  },
  {
    id: 'nihss-3-1',
    topic: 'nihss',
    difficulty: 3,
    tag: 'nihss-language',
    prompt:
      'A patient is mute with global aphasia: no usable speech and no one-step commands followed. The item 9 (best language) score is:',
    options: ['1', '2', '3', '0, because the patient cannot be tested'],
    answerIndex: 2,
    explanation:
      'Item 9 scores 3 for mute, global aphasia. Untestable is reserved for specific situations such as intubation, which is recorded rather than silently scored as normal.',
  },
  {
    id: 'nihss-3-2',
    topic: 'nihss',
    difficulty: 3,
    tag: 'nihss-motor',
    prompt:
      'During the motor arm item, the arm drifts down and lands on the bed before 10 seconds, despite visible effort against gravity. The score is:',
    options: ['1, drift', '2, some effort against gravity', '3, no effort against gravity', '4, no movement'],
    answerIndex: 1,
    explanation:
      'Score 1 is drift that does not reach the bed, 2 is some effort against gravity but the arm falls to the bed, 3 is no effort against gravity, and 4 is no movement at all.',
  },

  // --- Vascular anatomy ---------------------------------------------------
  {
    id: 'vascular-1-1',
    topic: 'vascular',
    difficulty: 1,
    tag: 'mca-territory',
    prompt: 'The middle cerebral artery classically supplies:',
    options: [
      'The medial frontal lobe and the leg area of the motor strip',
      'The lateral frontal and parietal lobes, including face and arm areas of the motor strip',
      'The occipital lobe and visual cortex',
      'The pons and cerebellum',
    ],
    answerIndex: 1,
    explanation:
      'The MCA covers the lateral convexity, where the face and arm are represented in the motor and sensory strips, which is why MCA strokes so often show face and arm signs.',
  },
  {
    id: 'vascular-1-2',
    topic: 'vascular',
    difficulty: 1,
    tag: 'mca-territory',
    prompt:
      'Sudden weakness of the right face and arm with the leg clearly spared most suggests a lesion in which territory?',
    options: ['Anterior cerebral artery', 'Middle cerebral artery', 'Posterior cerebral artery', 'Basilar artery'],
    answerIndex: 1,
    explanation:
      'Face and arm predominance with leg sparing is the classic MCA pattern, because the leg area sits medially in ACA territory.',
  },
  {
    id: 'vascular-2-1',
    topic: 'vascular',
    difficulty: 2,
    tag: 'aca-territory',
    prompt:
      'A stroke causing mainly leg weakness on one side, with reduced initiative and personality change, points to which artery?',
    options: ['Middle cerebral artery', 'Anterior cerebral artery', 'Posterior cerebral artery', 'Superior cerebellar artery'],
    answerIndex: 1,
    explanation:
      'The ACA supplies the medial frontal lobe, including the leg area of the motor strip and frontal behaviour circuits, so leg-predominant weakness with abulia suggests ACA territory.',
  },
  {
    id: 'vascular-2-2',
    topic: 'vascular',
    difficulty: 2,
    tag: 'brainstem-signs',
    prompt:
      'Ipsilateral facial weakness combined with contralateral body weakness (crossed signs) localizes the lesion to the:',
    options: ['Internal capsule', 'Brainstem', 'Frontal cortex', 'Cerebellum'],
    answerIndex: 1,
    explanation:
      'Crossed signs arise where cranial nerve nuclei and the still-uncrossed motor tract sit together, which is the brainstem. Cortical lesions weaken the face and body on the same side.',
  },
  {
    id: 'vascular-3-1',
    topic: 'vascular',
    difficulty: 3,
    tag: 'wernicke',
    prompt:
      'Fluent but meaningless speech with poor comprehension (Wernicke aphasia) localizes to the posterior superior temporal lobe, supplied mainly by the:',
    options: [
      'Superior division of the MCA',
      'Inferior division of the MCA',
      'Anterior cerebral artery',
      'Lenticulostriate arteries',
    ],
    answerIndex: 1,
    explanation:
      'Wernicke area sits in the posterior superior temporal gyrus, in inferior (temporal) division MCA territory, while Broca area is supplied by the superior division.',
  },
  {
    id: 'vascular-3-2',
    topic: 'vascular',
    difficulty: 3,
    tag: 'pca-vision',
    prompt:
      'An isolated contralateral homonymous hemianopia, sometimes with macular sparing, most often reflects an infarct in which territory?',
    options: ['Posterior cerebral artery (occipital lobe)', 'Middle cerebral artery stem', 'Anterior choroidal artery', 'Vertebral artery only'],
    answerIndex: 0,
    explanation:
      'The occipital visual cortex is PCA territory. Macular sparing is a classic clue to an occipital lesion, helped by collateral flow at the occipital pole.',
  },

  // --- Risk factors -------------------------------------------------------
  {
    id: 'risk-1-1',
    topic: 'risk',
    difficulty: 1,
    tag: 'hypertension',
    prompt: 'Which single modifiable factor contributes most to stroke risk worldwide?',
    options: ['High blood pressure', 'High cholesterol alone', 'Occasional alcohol use', 'Short sleep'],
    answerIndex: 0,
    explanation:
      'Hypertension is the largest single modifiable contributor to stroke risk, for both ischemic and hemorrhagic stroke, and controlling it is the highest-yield prevention step.',
  },
  {
    id: 'risk-1-2',
    topic: 'risk',
    difficulty: 1,
    tag: 'af-embolism',
    prompt: 'Which heart rhythm problem is most strongly linked to cardioembolic stroke?',
    options: ['Sinus bradycardia', 'Atrial fibrillation', 'Occasional palpitations without a diagnosis', 'A harmless murmur'],
    answerIndex: 1,
    explanation:
      'Atrial fibrillation lets clots form in the left atrium and travel to the brain. Finding it after a stroke changes prevention, because anticoagulation is then usually considered.',
  },
  {
    id: 'risk-2-1',
    topic: 'risk',
    difficulty: 2,
    tag: 'tia-urgency',
    prompt: 'Why does a transient ischemic attack (TIA) need same-day evaluation even after symptoms resolve?',
    options: [
      'Because the early risk of a completed stroke after TIA is high, especially in the first days',
      'Because TIA always causes permanent damage',
      'Only because patients feel anxious',
      'Because imaging is cheaper on the same day',
    ],
    answerIndex: 0,
    explanation:
      'A TIA is a warning event: a meaningful share of patients have a stroke within days. Same-day assessment looks for causes that can be treated immediately, such as atrial fibrillation or tight carotid stenosis.',
  },
  {
    id: 'risk-2-2',
    topic: 'risk',
    difficulty: 2,
    tag: 'non-modifiable',
    prompt: 'Which of the following is a non-modifiable stroke risk factor?',
    options: ['Age', 'Smoking', 'Diabetes control', 'Blood pressure'],
    answerIndex: 0,
    explanation:
      'Age cannot be changed, and neither can sex or family history. Smoking, blood pressure, and diabetes are modifiable, which is exactly why they dominate prevention plans.',
  },
  {
    id: 'risk-3-1',
    topic: 'risk',
    difficulty: 3,
    tag: 'pfo',
    prompt: 'A patent foramen ovale (PFO) is most relevant when evaluating stroke in which patient?',
    options: [
      'An 84 year old with long-standing hypertension',
      'A young adult with a cryptogenic stroke and no other clear cause',
      'A patient with a clear lacunar syndrome and severe small vessel disease',
      'Every patient, equally',
    ],
    answerIndex: 1,
    explanation:
      'A PFO is common in the general population, so it only becomes a plausible mechanism in selected patients, typically younger people with cryptogenic stroke after other causes are excluded.',
  },
  {
    id: 'risk-3-2',
    topic: 'risk',
    difficulty: 3,
    tag: 'risk-combination',
    prompt:
      'Two patients have the same blood pressure. Patient A also smokes and has diabetes; patient B has neither. The best statement is:',
    options: [
      'Their stroke risks are equal because blood pressure is identical',
      'Risk factors combine, so patient A carries clearly higher overall risk',
      'Diabetes only matters for eye disease',
      'Smoking stops mattering once blood pressure is known',
    ],
    answerIndex: 1,
    explanation:
      'Stroke risk factors do not act in isolation; they add to and amplify each other. Prevention addresses the whole profile, not a single number.',
  },
];
