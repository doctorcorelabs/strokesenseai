// Public educational concepts only. Never put secrets, patient data, or frontend sample records here.
// Server-owned concepts for the /api/tools explainer: the client sends only a
// tool and id pair from this allowlist, and the Worker injects these facts.
export const LAB_RESOURCES = {
  symptoms: {
    title: 'American Stroke Association (AHA): Stroke symptoms',
    url: 'https://www.stroke.org/en/about-stroke/stroke-symptoms',
  },
  stroke: {
    title: 'NINDS: Stroke',
    url: 'https://www.ninds.nih.gov/health-information/disorders/stroke',
  },
  emergency: {
    title: 'Kemenkes: How to call emergency service 119',
    url: 'https://psc.kemkes.go.id/web/cara-melakukan-panggilan-emergency-call-119',
  },
} as const;

export type LabResourceId = keyof typeof LAB_RESOURCES;
export type LabSource = { title: string; url: string };
type LabModule = { title: string; facts: readonly string[]; resources: readonly LabResourceId[] };

function module(
  title: string,
  facts: string[],
  resources: LabResourceId[] = ['stroke'],
): LabModule {
  return { title, facts, resources };
}

const documentFacts = [
  'Organizing a document means separating headings, medicines as written, follow-up items, and points that need clarification from the care team.',
  'The server has no sample record contents. A document ID does not establish any medicines, doses, dates, diagnoses, appointments, or patient details.',
  'Display context may be quoted only as an untrusted excerpt, never as verified facts or advice. Do not infer missing details or reconcile medicines.',
];

export const LAB_MODULES = {
  fast: {
    'digital-fast-multimodal': module(
      'Multimodal FAST session',
      [
        'FAST stands for Face, Arm, Speech, and Time to call emergency services, and this lab combines short face, arm, and speech tasks in one guided session.',
        'Each modality is measured and reported separately, with its own data quality. There is no combined score, and one modality never fills in for another that failed.',
        'Face and arm signals are measured locally in the browser. Speech is only sent for transcription after explicit consent.',
        'A task that fails its quality gate reports cannot analyze. If stroke signs are happening now, skip the session and call 119 in Indonesia.',
      ],
      ['symptoms', 'stroke', 'emergency'],
    ),
  },
  face: {
    'face-analyzer': module(
      'Face geometry measurement',
      [
        'Facial landmarks let software describe geometry, such as the relative height of the two mouth corners normalized to the distance between the pupils.',
        'Head pose, lighting differences between the sides, and photo blur can all change a geometric measurement without any change in the person.',
        'A geometric measurement is not a medical finding. This module makes no classification of any pattern and locates no lesion.',
        'Sudden facial drooping is a medical emergency. Call 119 in Indonesia immediately rather than measuring or photographing it.',
      ],
      ['symptoms', 'stroke', 'emergency'],
    ),
    'face-dynamics': module(
      'Facial movement over time',
      [
        'Clinicians assess facial weakness through movement, such as smiling and raising the eyebrows, not from a single still position.',
        'Blendshape coefficients describe how strongly facial regions move over time and can be plotted as curves.',
        'Curves from a consumer webcam are noisy practice data. This module never labels a pattern in user data.',
      ],
      ['symptoms', 'stroke'],
    ),
  },
  gaze: {
    'gaze-tracker': module(
      'Eye movement exercises',
      [
        'Eye examination in neurology includes following a moving target, looking quickly between targets, and holding gaze to the side.',
        'Calibration quality decides whether a webcam session can measure anything at all, and a failed calibration is reported instead of estimated.',
        'A consumer webcam records at about 30 frames per second, which is too coarse to characterize clinical eye movement findings.',
      ],
      ['stroke'],
    ),
    'neglect-explorer': module(
      'Cancellation and visual awareness practice',
      [
        'Cancellation tasks ask a person to mark every target on a page, and missed targets on one side can be part of a clinical examination.',
        'A phone or computer screen is much smaller than a real visual field, so screen results are practice observations only.',
        'Attention, fatigue, screen size, and viewing distance all affect performance on these tasks.',
      ],
      ['stroke'],
    ),
  },
  scan: {
    'scan-explainer': module(
      'Reading a teaching scan',
      [
        'Brain imaging helps clinicians tell stroke types apart, because symptoms alone cannot reliably do so.',
        'Annotations on teaching scans are written by curators and are the source of truth for explanations in this module.',
        'This module discusses only curated teaching examples. It cannot interpret any scan outside its library.',
      ],
      ['stroke'],
    ),
  },
  speech: {
    'speech-analyzer': module(
      'Speech clarity practice',
      [
        'Speech clarity can be described with acoustic measures such as speaking rate, pauses, and pitch variation.',
        'Automatic transcription is known to make more errors on post-stroke speech, and accents also change error rates.',
        'Comparing a recording with your own earlier baseline avoids treating a different accent as an error.',
      ],
      ['stroke'],
    ),
    'comprehension-check': module(
      'Following spoken commands',
      [
        'Following one-step and two-step spoken commands is a classic language exercise format.',
        'A volume check and a familiarization task run first, so a technical problem is not read as a comprehension problem.',
        'Nothing in this practice is recorded or uploaded; the audio prompts are generated on the device.',
      ],
      ['stroke'],
    ),
    'aphasia-expression': module(
      'Picture naming practice',
      [
        'Picture naming is a classic language practice task: see a picture, then say or type its name.',
        'Answers can miss in different ways, for example a related word, a similar-sounding word, or a description instead of the name. These error types are educational labels in this lab, not validated findings.',
        'A cue ladder offers help in steps: a meaning hint, the first sound, then a small set of choices.',
        'Speech recognition can mishear post-stroke speech, so the transcript can always be corrected before any feedback is given.',
      ],
      ['stroke'],
    ),
    'aphasia-communication': module(
      'Sentence reconstruction with confirmation',
      [
        'This practice starts from a typed or spoken fragment and offers two or three candidate sentences that might express the intended meaning.',
        'A candidate sentence is never treated as the words of the user until the user selects or edits it and confirms it.',
        'Confirmation matters because a reconstruction can sound fluent and still be wrong in meaning.',
        'Text to speech can read the confirmed sentence aloud. That is a playback feature, not an assessment.',
      ],
      ['stroke'],
    ),
    'nihss-language-assistant': module(
      'Language item training on simulated cases',
      [
        'The NIHSS language item is scored from how a person names objects, reads sentences, and takes part in conversation during the examination.',
        'In this trainer, every case has a severity profile and a reference score written by its authors in advance. The model never sets the key.',
        'Trainees record their own score and justification first, and feedback follows the rubric before the reference score is revealed.',
        'Sentence cards here are paraphrased practice material, and this trainer never scores a real patient.',
      ],
      ['stroke'],
    ),
  },
  motor: {
    'arm-drift': module(
      'Arm drift measurement',
      [
        'In a drift check, both arms are held raised for about 10 seconds while an examiner watches for one side sinking.',
        'Pose tracking can measure an arm angle over time and plot it, including gaps where landmarks were not visible.',
        'Pose tracking cannot reliably measure forearm rotation, and a measured curve is not a clinical score.',
        'New arm weakness is a medical emergency. Call 119 in Indonesia immediately instead of recording it.',
      ],
      ['symptoms', 'stroke', 'emergency'],
    ),
    'finger-tapping': module(
      'Finger tapping practice',
      [
        'Finger tapping tasks look at speed, rhythm, and how consistent repeated movements are.',
        'Slowness in tapping has many possible causes, including joint pain, fatigue, and camera frame rate.',
        'This module deliberately shows no population norm table, because its numbers describe one recording session only.',
      ],
      ['stroke'],
    ),
    'balance-lab': module(
      'Chair stand and sway practice',
      [
        'Repeated chair stands are used in education to discuss leg strength and function over a fixed time window.',
        'A 2D camera can only approximate body sway from a hip midpoint; it cannot measure pressure under the feet.',
        'Standing tasks carry a real fall risk, so support within reach and a companion are part of the protocol.',
      ],
      ['stroke'],
    ),
    'fast-vision-check': module(
      'Guided FAST camera flow',
      [
        'FAST stands for Face, Arm, Speech, and Time to call emergency services.',
        'This guided flow reports each step separately and produces no combined score.',
        'If symptoms are happening now, stop the flow and call 119 in Indonesia. A camera check can never rule out stroke.',
      ],
      ['symptoms', 'stroke', 'emergency'],
    ),
  },
  reasoning: {
    'mimic-detective': module(
      'Stroke mimics in training cases',
      [
        'Some conditions can look like stroke at first, including low blood sugar, the period after a seizure, and migraine with aura.',
        'Checking blood sugar is a basic safety step in acute focal deficit scenarios.',
        'In the training cases, some presentations are deliberately uncertain and the scoring rewards safe escalation to imaging and emergency care.',
        'In real life, a mimic is a conclusion reached after evaluation, never a reason to delay calling emergency services.',
      ],
      ['symptoms', 'stroke'],
    ),
    'localization-challenge': module(
      'Lesion localization practice',
      [
        'Different arteries supply different brain regions, and patterns of deficits can suggest a territory.',
        'Face and arm deficits stronger than leg deficits are a classic teaching pointer toward middle cerebral artery territory.',
        'Clinical localization is a hypothesis. Imaging is what confirms where a lesion is.',
      ],
      ['stroke'],
    ),
    'stroke-code-simulator': module(
      'Stroke code decision practice',
      [
        'Last known well means the last time a person was known to be at their usual baseline, and time calculations in acute scenarios start from it.',
        'In these fictional scenarios, decision keys and time intervals are fixed by the case and computed by code, not by the model.',
        'The model may narrate only the facts in the case template and may not add new clinical facts.',
      ],
      ['symptoms', 'stroke'],
    ),
    'nihss-trainer': module(
      'NIHSS item training',
      [
        'The NIHSS is a structured neurological examination scale with 15 items, each with defined score anchors.',
        'In this trainer, reference scores are fixed by the case authors and item definitions are supplied by the server.',
        'This is a simulation trainer. It is not certification and it never scores a real patient.',
      ],
      ['stroke'],
    ),
    'virtual-patient-osce': module(
      'Virtual patient interview practice',
      [
        'OSCE stands for Objective Structured Clinical Examination, a format where learners interview a patient actor and are scored against a checklist.',
        'The virtual patient in this lab can only use the facts of its assigned fictional case, and questions outside that case get a fixed unavailable reply.',
        'A deterministic checklist records whether key history points were asked, such as onset, last known well, and blood thinning medication.',
        'This practice supplements standardized patient sessions. It does not replace them.',
      ],
      ['stroke'],
    ),
  },
  document: {
    'discharge-lens': module('Discharge document organization', documentFacts, ['stroke']),
    'plain-translator': module(
      'Plain language rewriting',
      [
        'Plain language uses short sentences and everyday words while keeping the meaning of the original text.',
        'Numbers, doses, dates, and medicine names must stay identical when a text is simplified, and this is checked by code.',
        'A simpler wording of the same text is not new medical advice, and the original text is always shown beside it.',
      ],
      ['stroke'],
    ),
    'risk-extractor': module(
      'Structured risk factor profiles',
      [
        'A structured profile records whether each factor was stated present, stated absent, or not mentioned at all.',
        'Not mentioned never means absent, and a family history belongs to the family factor, not to the patient.',
        'This module produces no risk score, percentage, or prediction.',
      ],
      ['stroke'],
    ),
    'guideline-navigator': module(
      'Guideline questions with citations',
      [
        'Answers in this module may only use the curated evidence cards retrieved for the question.',
        'Every factual sentence must cite its card, and questions the library does not cover get a fixed refusal instead of an improvised answer.',
        'Source cards are paraphrased claims with full citation metadata, including the guideline version and review date.',
      ],
      ['stroke'],
    ),
  },
  research: {
    'model-bench': module(
      'Comparing models on fixed cases',
      [
        'This bench runs the same fixed set of synthetic cases through several models or prompts, so the answers can be compared side by side.',
        'A shared rubric flags unsupported claims, invented facts, and guardrail violations in each answer.',
        'Results describe behaviour on synthetic cases only. They are not evidence of clinical performance.',
        'Evaluation logs contain no user data and are published as research artifacts.',
      ],
      ['stroke'],
    ),
    'privacy-shield': module(
      'Planned privacy demonstration',
      [
        'The planned demonstration shows, per feature and per processing mode, exactly which data would leave the device and which would stay local.',
        'In the finished design, shared views would replace a face with a landmark mesh or a blur instead of the raw image.',
        'No working demonstration ships yet, and no camera input is processed for this feature.',
        'A data flow panel can only describe this application. The policies of hosts, model providers, and networks are separate and are named on the Scope page.',
      ],
      ['stroke'],
    ),
    'adaptive-tutor': module(
      'Session-based practice recommendations',
      [
        'This tutor looks at error patterns from the current session of simulator, quiz, and challenge practice.',
        'Remedial cases are selected from the case bank by error tag, for example missed safety checks or repeated scoring differences on one item.',
        'Practice history lives only in session memory and is not stored on a server.',
        'Recommendations describe one session of practice behaviour, not clinical competence.',
      ],
      ['stroke'],
    ),
    'transparency-dashboard': module(
      'Published internal benchmarks',
      [
        'This dashboard publishes internal benchmark results, such as emergency guard recall, refusal rates for unsafe questions, and cannot-analyze rates per feature.',
        'Every number is generated from evaluation artifacts stored in this repository, so it can be reproduced from the repo itself.',
        'All datasets behind these numbers are synthetic, and the numbers measure guard and explanation quality, not clinical accuracy.',
      ],
      ['stroke'],
    ),
  },
} as const;

export type LabTool = keyof typeof LAB_MODULES;
export type LabRequest = {
  [T in LabTool]: {
    tool: T;
    id: keyof (typeof LAB_MODULES)[T];
    context?: string;
    question?: string;
  };
}[LabTool];
export type LabResponse = { reply: string; sources: LabSource[]; mode: 'live' | 'emergency' };
export const LAB_TEXT_LIMIT = 1_000;

export function getLabModule(tool: string, id: string): LabModule | undefined {
  if (!Object.hasOwn(LAB_MODULES, tool)) return undefined;
  const modules = LAB_MODULES[tool as LabTool];
  if (!Object.hasOwn(modules, id)) return undefined;
  return (modules as Record<string, LabModule>)[id];
}

export function labSources(module: LabModule): LabSource[] {
  return module.resources.map((id) => ({ ...LAB_RESOURCES[id] }));
}
