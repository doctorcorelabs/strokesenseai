// Feature registry: the single source of truth for what exists in this lab.
// README, the Scope page, and the UI are verified against this file in CI.
// A live route without an entry here, or an entry without a route, fails CI.
// See PLANNING.md sections 6 and 9.3.
export type FeatureMaturity = 'concept' | 'lab' | 'validated';

export type FeatureGroup =
  | 'Flagship'
  | 'Vision AI'
  | 'Speech and Language AI'
  | 'Motor AI'
  | 'Clinical Reasoning AI'
  | 'Document and Data AI'
  | 'Research Platform';

export interface FeatureEntry {
  id: string;
  name: string;
  tagline: string;
  group: FeatureGroup;
  maturity: FeatureMaturity;
  phase: 0 | 1 | 2 | 3;
  summary: string;
  limitations: string;
  inputKinds: string[];
  route: string;
  models: string;
  retention: string;
  evalReport: string;
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  'Flagship',
  'Vision AI',
  'Speech and Language AI',
  'Motor AI',
  'Clinical Reasoning AI',
  'Document and Data AI',
  'Research Platform',
];

export const FEATURES: FeatureEntry[] = [
  {
    id: 'digital-fast-multimodal',
    name: 'Digital FAST Multimodal Lab',
    tagline: 'Face, speech, and arm signals in one guided session',
    group: 'Flagship',
    maturity: 'concept',
    phase: 2,
    summary:
      'One guided 15 to 20 second session that combines a smile task, a two-arm raise, and a repeated standard sentence. Face and pose features are measured locally in the browser, speech is transcribed through the Worker after consent, and each modality is reported separately with its own data quality.',
    limitations:
      'No combined score is produced and no modality can fill in for a failed one. A modality that fails its quality gate reports cannot analyze. This session cannot rule out stroke.',
    inputKinds: ['camera', 'microphone', 'synthetic-demo'],
    route: '#lab/digital-fast-multimodal',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'face-analyzer',
    name: 'Face Symmetry Analyzer v2',
    tagline: 'Measure geometry, never diagnose',
    group: 'Vision AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'A geometry learning tool for facial landmarks with a strict photo quality gate for pose, sharpness, lighting balance, and landmark visibility. Reports three geometric measurements with uncertainty ranges, in a synthetic lab mode by default and an opt-in local photo mode.',
    limitations:
      'Measurements are geometric descriptions, not medical findings. There is no central versus peripheral classification, no lesion localization, and no symmetry verdict. Failed detection always reports cannot analyze, never a substitute normal result.',
    inputKinds: ['synthetic-demo', 'photo-upload', 'camera'],
    route: '#lab/face-analyzer',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'face-dynamics',
    name: 'Face Dynamics Lab',
    tagline: 'Watch facial movement over time',
    group: 'Vision AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Dynamic facial tasks (smile, brow raise, forehead wrinkle, cheek puff) tracked with MediaPipe blendshapes over time. Your curves are plotted next to labelled synthetic curves so you can compare visually.',
    limitations:
      'The system never labels a pattern in your own data. Webcam blendshapes are noisy and are shown as practice measurements only.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/face-dynamics',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'gaze-tracker',
    name: 'Eye and Gaze Tracker',
    tagline: 'Watch how eyes move, learn what clinicians look for',
    group: 'Vision AI',
    maturity: 'concept',
    phase: 3,
    summary:
      'Webcam iris tracking with a mandatory calibration step, then structured smooth pursuit, saccade, and gaze holding exercises. Results are descriptive session statistics with data quality markers.',
    limitations:
      'A consumer webcam at about 30 frames per second cannot characterize clinical eye movement findings. The actual measured frame rate is shown, and no pattern label is ever applied to your recording.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/gaze-tracker',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'neglect-explorer',
    name: 'Visual Field and Neglect Explorer',
    tagline: 'Experience the tests behind the neurology exam',
    group: 'Vision AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Digital versions of classic bedside tests: cancellation, line bisection, and peripheral awareness, with fully deterministic scoring shown on the page. A simulated patient mode with programmed response profiles separates learning from self-testing.',
    limitations:
      'A screen is far smaller than a real visual field, and results are practice observations affected by screen size, distance, attention, and fatigue. No neglect or field defect label is ever given to the user.',
    inputKinds: ['touch', 'mouse', 'synthetic-demo'],
    route: '#lab/neglect-explorer',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'scan-explainer',
    name: 'Scan Explainer',
    tagline: 'Learn to read a teaching scan, layer by layer',
    group: 'Vision AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'A curated library of synthetic and openly licensed teaching scans with curator-written annotation layers. A vision model may only explain from the provided annotations, and an interactive core, penumbra, and mismatch concept calculator teaches how imaging AI products reason.',
    limitations:
      'There is no upload path and no interpretation of any scan outside the curated library. Teaching examples do not represent all patients, and no diagnosis or report is produced.',
    inputKinds: ['library-case', 'text-question'],
    route: '#lab/scan-explainer',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'speech-analyzer',
    name: 'Dysarthria and Slurred Speech Analyzer',
    tagline: 'Hear how machine transcription hears a standard sentence',
    group: 'Speech and Language AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'You read a phonetically balanced standard sentence in English or Indonesian mode. Acoustic features are computed locally, the recording is transcribed through the Worker after consent, and clarity is measured deterministically by aligning the transcript to the known target sentence with per-word highlighting.',
    limitations:
      'Generic speech recognition is known to perform poorly on post-stroke speech, and that limitation is part of the experiment. Results are always compared with your own baseline recording, never with native speaker norms, and are not a clinical score.',
    inputKinds: ['microphone'],
    route: '#lab/speech-analyzer',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'aphasia-expression',
    name: 'Aphasia Expression Lab',
    tagline: 'Practice naming with layered feedback and cues',
    group: 'Speech and Language AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Picture naming practice answered by voice or typing. A deterministic layer measures phonetic distance and curated semantic closeness, and a rubric-bound model layer classifies error types experimentally. A cue ladder (semantic hint, first sound, multiple choice) appears when an answer misses.',
    limitations:
      'Error type labels are experimental and unvalidated. The transcript can always be corrected by the user before scoring, and this is practice support, not therapy or assessment.',
    inputKinds: ['microphone', 'text', 'touch'],
    route: '#lab/aphasia-expression',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'aphasia-communication',
    name: 'Aphasia Communication Mode',
    tagline: 'From fragments to a sentence you confirm',
    group: 'Speech and Language AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Type or speak a fragment and the model offers two or three candidate reconstructions. You pick or edit the one that matches your intent, then it can be read aloud with text to speech. Your confirmation, not the model, is the ground truth.',
    limitations:
      'Reconstructions can be wrong in meaning, which is why nothing is treated as your words until you confirm it. This is a research prototype, not a communication aid for clinical use.',
    inputKinds: ['microphone', 'text'],
    route: '#lab/aphasia-communication',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'comprehension-check',
    name: 'Interactive Comprehension Check',
    tagline: 'Listen, then respond by touch',
    group: 'Speech and Language AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Spoken commands are played locally with text to speech and answered by touch: point to objects, follow one-step then two-step commands, and answer yes or no questions about a short story. Scoring is fully deterministic on the device.',
    limitations:
      'Difficulty can reflect English listening skill or speech synthesis quality rather than comprehension. A familiarization task and volume check run first so technical failures are not read as comprehension failures. Nothing is uploaded.',
    inputKinds: ['touch', 'mouse'],
    route: '#lab/comprehension-check',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'nihss-language-assistant',
    name: 'Speech-to-NIHSS Language Item Assistant',
    tagline: 'Train the language item on simulated patients',
    group: 'Speech and Language AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'A training tool for students: pick a simulated case with an author-written language severity profile, run the practice language tasks, document your score and justification, and get rubric-based feedback before the fixed reference score is revealed.',
    limitations:
      'Training simulation only, watermarked as not for clinical use. Reference scores are always written by case authors, never by AI, and there is no path to score a real patient recording.',
    inputKinds: ['microphone', 'text', 'library-case'],
    route: '#lab/nihss-language-assistant',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'arm-drift',
    name: 'Arm Drift Quantifier',
    tagline: 'Turn arm drift into a measured curve',
    group: 'Motor AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'A guided 10 second two-arm raise measured with local pose tracking: elevation angle per side, drift in degrees and degrees per second, lateral deviation, and a descriptive asymmetry index, plotted with data gaps and variability bands.',
    limitations:
      'Pose tracking cannot reliably measure forearm pronation, so pronation drift is not claimed. There is no pass or fail status and no clinical score; drift not observed in 10 seconds does not rule out stroke.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/arm-drift',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'finger-tapping',
    name: 'Finger Tapping and Hand Dexterity Test',
    tagline: 'Measure tapping speed, rhythm, and consistency',
    group: 'Motor AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Thumb to index tapping for 10 seconds per hand with local hand landmark tracking. Reports frequency, rhythm variability, amplitude, fatigue slope, hesitation pauses, and a left-right comparison you can replay and audit tap by tap.',
    limitations:
      'There is deliberately no population norm table. Slowness can come from joint pain, fatigue, arthritis, or camera frame rate, and the results panel says so. This is not a bradykinesia test or a motor score.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/finger-tapping',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'balance-lab',
    name: 'Sit-to-Stand and Balance Lab',
    tagline: 'Count chair stands and visualize body sway',
    group: 'Motor AI',
    maturity: 'concept',
    phase: 3,
    summary:
      'Two gross motor tasks with full-body pose tracking: repeated chair stands counted from hip angle transitions over 30 seconds, and quiet standing sway visualized from a hip midpoint proxy with path length and spread statistics.',
    limitations:
      'A 2D camera cannot measure center of pressure and the hip midpoint is not true center of mass. This is not a balance score or a fall risk assessment. Support within reach and a companion for the balance task are mandatory instructions, and the task can be skipped entirely.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/balance-lab',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'fast-vision-check',
    name: 'FAST Vision Check',
    tagline: 'A guided experimental camera flow, step by step',
    group: 'Motor AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'One guided session that chains the face step and the arm drift step, with an optional hand tapping step, using one model at a time. The result is a per-step observation sheet held only in session memory and downloadable from your own device.',
    limitations:
      'There is intentionally no combined score and no final pass status, because a single number would act like a hidden diagnosis. The speech step is listen-back only and is labelled as not analyzed.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/fast-vision-check',
    models: 'None yet (concept)',
    retention: 'Session memory only, cleared when the session ends',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'nihss-trainer',
    name: 'NIHSS Co-Pilot Trainer',
    tagline: 'Score simulated patients, item by item',
    group: 'Clinical Reasoning AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Practice per item or a full 15 item exam on simulated patients presented as structured findings, transcripts, and validated actor or avatar clips. Score comparison with the case key is deterministic, and the model explains each difference using the official item definitions supplied by the server.',
    limitations:
      'This is a simulation trainer, not NIHSS certification and not a patient assessment tool. There is no mode for entering a real patient.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/nihss-trainer',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'stroke-code-simulator',
    name: 'Stroke Code Simulator',
    tagline: 'Decisions under the clock, with an AI examiner',
    group: 'Clinical Reasoning AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Acute stroke scenarios assembled from validated templates with controlled random parameters. You decide step by step on activation, workup priority, and time windows while a deterministic calculator computes every time interval. The model narrates only from the template and examines your reasoning and handoff against a fixed rubric.',
    limitations:
      'Eligibility inside a scenario is fixed by the case key, never decided by the model. Simulation labels appear at every step and real decisions always follow local stroke team protocols.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/stroke-code-simulator',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'mimic-detective',
    name: 'Stroke Mimic Detective',
    tagline: 'Stroke, mimic, or not sure yet',
    group: 'Clinical Reasoning AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Acute focal deficit cases from a curated bank, mixing real stroke patterns with hypoglycemia, Todd paresis, migraine aura, and functional presentations. You request clues from a fixed menu, classify the case, and get a side-by-side clue comparison with the strongest discriminator highlighted.',
    limitations:
      'Some cases are designed so the correct answer is that imaging is still needed, and safe escalation scores full marks. In real practice a mimic is a conclusion after evaluation, never a reason to delay emergency activation.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/mimic-detective',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'localization-challenge',
    name: 'Localization Challenge',
    tagline: 'From deficit pattern to arterial territory',
    group: 'Clinical Reasoning AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Validated cases present structured findings and you answer in two layers: side and level, then arterial territory. Partial credit is deterministic from a server-side finding-to-territory table, the 3D brain map highlights the key territory, and the model tutors only from that table.',
    limitations:
      'Clinical localization is a hypothesis that imaging must confirm. Atypical and trap cases are labelled as such, and there is no mode for entering real patient findings.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/localization-challenge',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'virtual-patient-osce',
    name: 'Virtual Patient OSCE',
    tagline: 'Interview a virtual patient, get structured feedback',
    group: 'Clinical Reasoning AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Multi-turn interview practice with a model-driven virtual patient, including aphasic patient and caregiver variants, on curated fictional cases. A deterministic checklist scores whether key history points were asked, and a rubric-bound judge scores communication quality.',
    limitations:
      'The patient cannot invent facts outside its case. This supplements standardized patient practice and does not replace it.',
    inputKinds: ['text', 'microphone'],
    route: '#lab/virtual-patient-osce',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'discharge-lens',
    name: 'Discharge Lens AI',
    tagline: 'From discharge paper to a verified checklist',
    group: 'Document and Data AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Structured extraction from a discharge document where every fact must point to its source line. Local OCR is the default path so the photo stays on the device, a vision model path is an explicit separate opt-in, and deterministic verbatim checks mark anything unverifiable as unverified instead of hiding it.',
    limitations:
      'Extraction can be wrong and the original paper always wins. Relative dates are never converted to calendar dates, doses are kept as raw text, and a per-document consent plus a redaction tool come before any upload path.',
    inputKinds: ['photo-upload', 'pdf', 'synthetic-demo'],
    route: '#lab/discharge-lens',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'risk-extractor',
    name: 'Risk Factor Extractor',
    tagline: 'Turn a history story into a structured risk profile',
    group: 'Document and Data AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Free-text history is converted into a fixed 10 factor profile where every factor needs a status (present, stated absent, or not mentioned) backed by an exact quote from your text, verified deterministically as a true substring. A local identifier check blocks sending until detected personal data is removed.',
    limitations:
      'There is deliberately no risk score, percentage, or stratification. Family history is never attributed to the patient, and not mentioned never means absent.',
    inputKinds: ['text', 'synthetic-demo'],
    route: '#lab/risk-extractor',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'guideline-navigator',
    name: 'Guideline Navigator',
    tagline: 'Ask the guidelines, get cited answers',
    group: 'Document and Data AI',
    maturity: 'concept',
    phase: 2,
    summary:
      'Questions are answered only from a curated library of evidence cards, each holding one paraphrased claim with full citation metadata. Retrieved cards are the only facts the model may use, every factual sentence must cite a card, and a post-generation check replaces answers with weak citation support by the raw cards themselves.',
    limitations:
      'Coverage is limited to the curated library and the refusal template says so. Answers are general education, never recommendations for an individual case.',
    inputKinds: ['text'],
    route: '#lab/guideline-navigator',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'plain-translator',
    name: 'Plain-Language Translator',
    tagline: 'Medical words in, everyday words out',
    group: 'Document and Data AI',
    maturity: 'concept',
    phase: 1,
    summary:
      'Medical text is rewritten into plain English at a grade 6 to 8 reading level, with an everyday Indonesian option. Numbers, doses, units, dates, and medicine names are locked before rewriting and verified identical afterwards; any change rejects the result instead of presenting shifted numbers.',
    limitations:
      'The output is a simpler wording of the same text shown side by side with the original, never new medical advice. The original text is never hidden or replaced.',
    inputKinds: ['text', 'synthetic-demo'],
    route: '#lab/plain-translator',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'model-bench',
    name: 'Model Experiment Bench',
    tagline: 'Same case, several models, open results',
    group: 'Research Platform',
    maturity: 'concept',
    phase: 2,
    summary:
      'Run the same fixed synthetic case set through two or three models or prompts, compare answers side by side, and flag hallucinations and guardrail violations with a shared rubric. Evaluation logs are publishable research artifacts with no user data.',
    limitations:
      'Benchmark results describe behaviour on synthetic cases only and are never evidence of clinical performance.',
    inputKinds: ['library-case'],
    route: '#lab/model-bench',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'privacy-shield',
    name: 'Privacy Shield',
    tagline: 'Planned: a clear view of what leaves your device',
    group: 'Research Platform',
    maturity: 'concept',
    phase: 0,
    summary:
      'A planned demonstration of the visual privacy policy intended for this lab. In the finished design, faces would be replaced by a landmark mesh or blur in shared views, and a per-feature panel would show precisely which data, if any, leaves the device in each processing mode. No working demonstration ships yet; for now this entry is a concept description only.',
    limitations:
      'This demonstration is planned, not built: the page processes no camera input and shows no live data flow panel. When built, the panel will describe this application only; hosting, model provider, and network metadata policies of third parties still apply and are named on the Scope page.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/privacy-shield',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'adaptive-tutor',
    name: 'Adaptive AI Tutor',
    tagline: 'Practice that follows your error patterns',
    group: 'Research Platform',
    maturity: 'concept',
    phase: 2,
    summary:
      'Your session error patterns in the simulator, quiz, and challenges drive what comes next: remedial cases are selected from the bank by error tag, and the model writes the session feedback narrative and practice plan. History lives only in session memory.',
    limitations:
      'Recommendations are based on a single session of practice behaviour, not on any assessment of clinical competence.',
    inputKinds: ['session-history'],
    route: '#lab/adaptive-tutor',
    models: 'None yet (concept)',
    retention: 'Session memory only, cleared when the session ends',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'transparency-dashboard',
    name: 'Evaluation and Transparency Dashboard',
    tagline: 'Benchmarks you can reproduce',
    group: 'Research Platform',
    maturity: 'concept',
    phase: 2,
    summary:
      'A public page of internal benchmark results generated from the evaluation harness artifacts in the repository: emergency guard recall on paraphrase sets, unsafe question refusal rates, latency, and cannot-analyze rates per feature.',
    limitations:
      'All numbers come from synthetic datasets and internal rubrics. They measure guard and explanation quality, not clinical accuracy.',
    inputKinds: ['repository-artifacts'],
    route: '#lab/transparency-dashboard',
    models: 'None yet (concept)',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
];

export function getFeature(id: string): FeatureEntry | undefined {
  return FEATURES.find((feature) => feature.id === id);
}
