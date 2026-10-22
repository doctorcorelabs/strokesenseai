// Feature registry: the single source of truth for what exists in this lab.
// README, the Scope page, and the UI are verified against this file in CI.
// A live route without an entry here, or an entry without a route, fails CI.
// See PLANNING.md sections 6 and 9.3.
//
// Registry v2 (rebuild R1): entries may carry the optional v2 fields
// (displayName, benefit, inputs, minutes, zone) that the rebuilt hub uses.
// The R1 feature set lives in R1_FEATURES further down and is kept separate
// from FEATURES so the legacy catalog and its consistency gates stay intact
// until the new shell replaces the old one; R1_CATALOG is the combined
// public catalog for R1. LEGACY_ALIASES maps retired or merged legacy
// routes to their rebuild targets.
export type FeatureMaturity = 'concept' | 'lab' | 'validated';

/** Registry v2: what the user has to provide or use for a feature. */
export type FeatureInput = 'camera' | 'microphone' | 'text' | 'touch' | 'none';

/** Registry v2: hub zone, grouped by what the user does, not by technology. */
export type FeatureZone = 'check' | 'play' | 'think' | 'review';

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
  /** Registry v2: plain-language display name used by the rebuilt hub. */
  displayName?: string;
  /** Registry v2: one lay benefit sentence, at most 12 words. */
  benefit?: string;
  /** Registry v2: what the user needs to provide or use. */
  inputs?: FeatureInput[];
  /** Registry v2: estimated minutes to a first result. */
  minutes?: number;
  /** Registry v2: hub zone for this feature. */
  zone?: FeatureZone;
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
    tagline: 'Face, arm, and speech checks in one guided checklist session',
    group: 'Flagship',
    maturity: 'lab',
    phase: 2,
    summary:
      'One guided session that walks you through a smile check, a two-arm raise, and a repeated standard sentence as a checklist. A camera preview helps with framing, but nothing is measured automatically: you record what you observe at each step yourself, and each step is reported separately with its own data quality.',
    limitations:
      'No combined score is produced and no step can fill in for a failed one. A step that cannot be observed reports cannot analyze. This session cannot rule out stroke.',
    inputKinds: ['camera', 'microphone', 'synthetic-demo'],
    route: '#lab/digital-fast-multimodal',
    models:
      'No automatic measurement and no AI model scores the session: the stages are human checklist observations recorded in the browser. An optional Worker AI coach (tool explanation endpoint) may explain the finished observation sheets after consent; it never sets a measurement or a score.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'face-analyzer',
    name: 'Face Symmetry Analyzer v2',
    tagline: 'Measure geometry, never diagnose',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'A geometry learning tool for facial landmarks. The synthetic lab mode with generated faces is the main path. In the opt-in local photo mode there is no landmark model, so you place the 16 landmarks by hand, and a strict quality gate checks your placements for pose, sharpness, and lighting balance. Reports three geometric measurements with uncertainty ranges.',
    limitations:
      'Measurements are geometric descriptions, not medical findings. There is no central versus peripheral classification, no lesion localization, and no symmetry verdict. When placements cannot support a measurement, the lab reports cannot analyze, never a substitute normal result.',
    inputKinds: ['synthetic-demo', 'photo-upload', 'camera'],
    route: '#lab/face-analyzer',
    models:
      'No AI model and no automatic landmark detection. Deterministic geometry computed locally in the browser from generated synthetic landmarks or landmarks you place by hand, plus image quality checks on the photo.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'face-dynamics',
    name: 'Face Dynamics Lab',
    tagline: 'Watch facial movement over time',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Dynamic facial tasks (smile, brow raise, forehead wrinkle, cheek puff) charted over time from facial landmarks: a synthetic performer by default, or a photo or camera snapshot where you place the landmarks by hand for each pose. Your curves are plotted next to labelled synthetic curves so you can compare visually.',
    limitations:
      'The system never labels a pattern in your own data. Hand-placed landmarks are imprecise, so the curves are noisy and are shown as practice measurements only.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/face-dynamics',
    models:
      'No AI model and no automatic face tracking. Rule-based charting in the browser of synthetic or hand-placed landmarks over time; the curves are descriptive practice measurements and no pattern is ever classified.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'gaze-tracker',
    name: 'Eye and Gaze Tracker',
    tagline: 'Watch how eyes move, learn what clinicians look for',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 3,
    summary:
      'Pointer-based practice that stands in for gaze: the pointer is the measured signal, and the webcam is only a preview that is never analyzed. A mandatory pointer calibration step comes first, then structured smooth pursuit, saccade, and gaze holding exercises. Results are descriptive session statistics with data quality markers.',
    limitations:
      'A pointer is not an eye, and pointer practice cannot characterize clinical eye movement findings. The calibration error is shown before the exercises start, and no pattern label is ever applied to your session.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/gaze-tracker',
    models:
      'Local deterministic statistics of pointer movement computed in the browser, plus an optional Worker AI coach for explanations. No eye tracking and no clinical eye movement model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'neglect-explorer',
    name: 'Visual Field and Neglect Explorer',
    tagline: 'Experience the tests behind the neurology exam',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Digital versions of classic bedside tests: cancellation, line bisection, and peripheral awareness, with fully deterministic scoring shown on the page. A simulated patient mode with programmed response profiles separates learning from self-testing.',
    limitations:
      'A screen is far smaller than a real visual field, and results are practice observations affected by screen size, distance, attention, and fatigue. No neglect or field defect label is ever given to the user.',
    inputKinds: ['touch', 'mouse', 'synthetic-demo'],
    route: '#lab/neglect-explorer',
    models:
      'Deterministic local scoring of the cancellation, bisection, and awareness tasks. An optional Worker AI coach explains results; no AI model takes part in scoring.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'scan-explainer',
    name: 'Scan Explainer',
    tagline: 'Learn to read a teaching scan, layer by layer',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'A curated library of synthetic and openly licensed teaching scans with curator-written annotation layers. A vision model may only explain from the provided annotations, and an interactive core, penumbra, and mismatch concept calculator teaches how imaging AI products reason.',
    limitations:
      'There is no upload path and no interpretation of any scan outside the curated library. Teaching examples do not represent all patients, and no diagnosis or report is produced.',
    inputKinds: ['library-case', 'text-question'],
    route: '#lab/scan-explainer',
    models:
      'The curated annotation library is the source of truth. An optional Worker AI coach may only explain from those annotations; there is no image interpretation model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'speech-analyzer',
    name: 'Dysarthria and Slurred Speech Analyzer',
    tagline: 'Hear how machine transcription hears a standard sentence',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'You read a phonetically balanced standard sentence in English or Indonesian mode. Acoustic features are computed locally, the browser speech recognition service transcribes the recording, and clarity is measured deterministically by aligning the transcript to the known target sentence with per-word highlighting.',
    limitations:
      'Generic speech recognition is known to perform poorly on post-stroke speech, and that limitation is part of the experiment. Results are always compared with your own baseline recording, never with native speaker norms, and are not a clinical score.',
    inputKinds: ['microphone'],
    route: '#lab/speech-analyzer',
    models:
      'Browser speech recognition supplies the transcript, and clarity is scored by deterministic local alignment against the known target sentence plus local acoustic features. No clinical speech model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'aphasia-expression',
    name: 'Aphasia Expression Lab',
    tagline: 'Practice naming with layered feedback and cues',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Picture naming practice answered by typing. A deterministic local layer measures phonetic distance and curated semantic closeness, and a fixed rule layer labels error types experimentally. A cue ladder (semantic hint, first sound, multiple choice) appears when an answer misses.',
    limitations:
      'Error type labels are experimental and unvalidated. The typed answer can always be edited by the user before scoring, and this is practice support, not therapy or assessment.',
    inputKinds: ['microphone', 'text', 'touch'],
    route: '#lab/aphasia-expression',
    models:
      'Fully local and deterministic: edit distance, simple phonetic closeness, and a curated semantic field table. Error type labels come from experimental rules, not a validated model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'aphasia-communication',
    name: 'Aphasia Communication Mode',
    tagline: 'From fragments to a sentence you confirm',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Type a fragment, or build one by tapping words, and a local pattern engine offers two or three candidate sentences. You pick or edit the one that matches your intent, then it can be read aloud with text to speech. Your confirmation, not the suggestion, is the ground truth.',
    limitations:
      'Reconstructions can be wrong in meaning, which is why nothing is treated as your words until you confirm it. This is a research prototype, not a communication aid for clinical use.',
    inputKinds: ['microphone', 'text'],
    route: '#lab/aphasia-communication',
    models:
      'Fully local: a tap-to-build sentence strip with deterministic pattern suggestions computed on device. Nothing is sent to a server, and speech output uses browser text to speech.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'comprehension-check',
    name: 'Interactive Comprehension Check',
    tagline: 'Listen, then respond by touch',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Spoken commands are played locally with text to speech and answered by touch: point to objects, follow one-step then two-step commands, and answer yes or no questions about a short story. Scoring is fully deterministic on the device.',
    limitations:
      'Difficulty can reflect English listening skill or speech synthesis quality rather than comprehension. A familiarization task and volume check run first so technical failures are not read as comprehension failures. Nothing is uploaded.',
    inputKinds: ['touch', 'mouse'],
    route: '#lab/comprehension-check',
    models:
      'Fully local and deterministic: browser text to speech plays the commands and fixed rules score the responses on the device. No AI model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'nihss-language-assistant',
    name: 'Speech-to-NIHSS Language Item Assistant',
    tagline: 'Train the language item on simulated patients',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'A training tool for students: pick a simulated case with an author-written language severity profile, run the practice language tasks, document your score and justification, and get rubric-based feedback before the fixed reference score is revealed.',
    limitations:
      'Training simulation only, watermarked as not for clinical use. Reference scores are always written by case authors, never by AI, and there is no path to score a real patient recording.',
    inputKinds: ['microphone', 'text', 'library-case'],
    route: '#lab/nihss-language-assistant',
    models:
      'Fully local: simulated cases with author-written reference scores and deterministic rubric scoring in the browser. No AI model scores anything.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'arm-drift',
    name: 'Arm Drift Quantifier',
    tagline: 'Drift curves in simulation and pointer practice',
    group: 'Motor AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'A drift practice lab with two modes and no camera: a simulation mode plays synthetic two-arm raise scenarios, and a pointer hold practice mode maps the pointer position you hold on a pad to an angle over 10 seconds per side. Both plot elevation angle, drift in degrees and degrees per second, lateral deviation, and a descriptive asymmetry index.',
    limitations:
      'The pointer mode measures your pointer, not your arm, and neither mode observes forearm pronation, so pronation drift is not claimed. There is no pass or fail status and no clinical score; drift not observed in 10 seconds does not rule out stroke.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/arm-drift',
    models:
      'Local deterministic analysis in the browser (elevation angle, drift rate, lateral deviation, asymmetry) of a synthetic series or of pointer positions you hold on a pad. No camera input, no AI model, and no clinical score.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'finger-tapping',
    name: 'Finger Tapping and Hand Dexterity Test',
    tagline: 'Measure pad tapping speed, rhythm, and consistency',
    group: 'Motor AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Rapid tapping on an on-screen pad, or by mouse click or spacebar, for 15 seconds per hand, with no camera involved. Reports frequency, rhythm variability, fatigue slope, hesitation pauses, and a left-right comparison you can replay and audit tap by tap.',
    limitations:
      'There is deliberately no population norm table. Slowness can come from joint pain, fatigue, arthritis, or the input device used, and the results panel says so. This is not a bradykinesia test or a motor score.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/finger-tapping',
    models:
      'Local deterministic tap detection and rhythm statistics in the browser, from on-screen pad, mouse, or spacebar input. No AI model and no population norm table.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'balance-lab',
    name: 'Sit-to-Stand and Balance Lab',
    tagline: 'Time chair stands and measure sway with your phone',
    group: 'Motor AI',
    maturity: 'lab',
    phase: 3,
    summary:
      'Two gross motor tasks with no camera: repeated chair stands timed by tapping a large button at each full stand, by yourself or a companion, and quiet standing sway measured for 30 seconds from a phone motion sensor held against your body, or marked manually by a companion, with tilt path and spread statistics.',
    limitations:
      'A phone motion sensor measures device tilt, not center of pressure, and self-timed stands depend on tap timing. Some devices provide no usable motion data, and the sway task then reports cannot analyze. This is not a balance score or a fall risk assessment. Support within reach and a companion for the balance task are mandatory instructions, and the task can be skipped entirely.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/balance-lab',
    models:
      'Local deterministic statistics in the browser: chair stands timed from button taps at each stand, and sway computed from phone motion sensor samples or manual companion marks. No camera and no AI model; this is not a balance score.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'fast-vision-check',
    name: 'FAST Vision Check',
    tagline: 'Notice the peripheral dots, one eye at a time',
    group: 'Motor AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'A screen test of peripheral noticing, despite the FAST name: with one eye covered, dots appear one at a time in the four quadrants of the screen and you tap as soon as you notice each one, then you repeat with the other eye. The result is a per-eye, per-quadrant count of noticed dots, held only in session memory.',
    limitations:
      'There is intentionally no combined score and no final pass status, because a single number would act like a hidden diagnosis. Reaction speed is mixed into every tap, and a missed dot in one round is not a visual field finding.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/fast-vision-check',
    models:
      'Local deterministic screen test in the browser: dot timing and tap responses per quadrant. No camera, no face or arm steps, and no AI model.',
    retention: 'Session memory only, cleared when the session ends',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'nihss-trainer',
    name: 'NIHSS Co-Pilot Trainer',
    tagline: 'Score simulated patients, item by item',
    group: 'Clinical Reasoning AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Practice per item or a full 15 item exam on simulated patients presented as structured findings, transcripts, and validated actor or avatar clips. Score comparison with the case key is deterministic, and each difference is explained from the official item definitions bundled with the case.',
    limitations:
      'This is a simulation trainer, not NIHSS certification and not a patient assessment tool. There is no mode for entering a real patient.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/nihss-trainer',
    models:
      'Fully local: fixed case keys with deterministic score comparison in the browser, and explanations drawn from the official item definitions bundled with the cases. No AI model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'stroke-code-simulator',
    name: 'Stroke Code Simulator',
    tagline: 'Decisions under the clock, scored by a fixed rubric',
    group: 'Clinical Reasoning AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Acute stroke scenarios assembled from validated templates with controlled random parameters. You decide step by step on activation, workup priority, and time windows while a deterministic calculator computes every time interval. Scenario text comes only from the template, and a fixed rubric checks your reasoning and handoff.',
    limitations:
      'Eligibility inside a scenario is fixed by the case key, never decided by the model. Simulation labels appear at every step and real decisions always follow local stroke team protocols.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/stroke-code-simulator',
    models:
      'Fully local: template scenarios with a deterministic time interval calculator and fixed rubric scoring in the browser. No AI model decides eligibility or scores decisions.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'mimic-detective',
    name: 'Stroke Mimic Detective',
    tagline: 'Stroke, mimic, or not sure yet',
    group: 'Clinical Reasoning AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Acute focal deficit cases from a curated bank, mixing real stroke patterns with hypoglycemia, Todd paresis, migraine aura, and functional presentations. You request clues from a fixed menu, classify the case, and get a side-by-side clue comparison with the strongest discriminator highlighted.',
    limitations:
      'Some cases are designed so the correct answer is that imaging is still needed, and safe escalation scores full marks. In real practice a mimic is a conclusion after evaluation, never a reason to delay emergency activation.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/mimic-detective',
    models:
      'Fully local: a curated case bank with deterministic clue comparison and scoring in the browser. No AI model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'localization-challenge',
    name: 'Localization Challenge',
    tagline: 'From deficit pattern to arterial territory',
    group: 'Clinical Reasoning AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Validated cases present structured findings and you answer in two layers: side and level, then arterial territory. Partial credit is deterministic from a bundled finding-to-territory table, the 3D brain map highlights the key territory, and feedback is drawn only from that table.',
    limitations:
      'Clinical localization is a hypothesis that imaging must confirm. Atypical and trap cases are labelled as such, and there is no mode for entering real patient findings.',
    inputKinds: ['library-case', 'text'],
    route: '#lab/localization-challenge',
    models:
      'Fully local: deterministic partial credit from a bundled finding-to-territory table. No AI model.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'virtual-patient-osce',
    name: 'Virtual Patient OSCE',
    tagline: 'Interview a virtual patient, get structured feedback',
    group: 'Clinical Reasoning AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Multi-turn interview practice with a scripted virtual patient that can only answer from its case facts, including aphasic patient and caregiver variants, on curated fictional cases. A deterministic checklist scores whether key history points were asked, and communication feedback follows a fixed rubric.',
    limitations:
      'The patient cannot invent facts outside its case. This supplements standardized patient practice and does not replace it.',
    inputKinds: ['text', 'microphone'],
    route: '#lab/virtual-patient-osce',
    models:
      'Fully local: a scripted virtual patient engine with deterministic checklist scoring in the browser. No AI model generates the patient replies.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'discharge-lens',
    name: 'Discharge Lens AI',
    tagline: 'Paste discharge text, get a verified checklist',
    group: 'Document and Data AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Structured extraction from discharge text you paste in, where every fact must point to its source line. A deterministic local parser reads the pasted text on this device; there is no photo, PDF, or OCR path. Verbatim checks mark anything unverifiable as unverified instead of hiding it.',
    limitations:
      'Extraction can be wrong and the original document always wins. Relative dates are never converted to calendar dates, doses are kept as raw text, and a consent check plus a personal data scan with a redaction tool run before any analysis.',
    inputKinds: ['photo-upload', 'pdf', 'synthetic-demo'],
    route: '#lab/discharge-lens',
    models:
      'Fully local: a deterministic line-based parser with verbatim source line verification and a local personal data scan. No AI model and no upload path in the current implementation.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'risk-extractor',
    name: 'Risk Factor Extractor',
    tagline: 'Turn a history story into a structured risk profile',
    group: 'Document and Data AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Free-text history is converted into a fixed 10 factor profile where every factor needs a status (present, stated absent, or not mentioned) backed by an exact quote from your text, verified deterministically as a true substring. A local identifier check blocks analysis until detected personal data is removed.',
    limitations:
      'There is deliberately no risk score, percentage, or stratification. Family history is never attributed to the patient, and not mentioned never means absent.',
    inputKinds: ['text', 'synthetic-demo'],
    route: '#lab/risk-extractor',
    models:
      'Fully local: deterministic extraction over a fixed 10 factor profile, each factor verified as an exact quote from the source text, plus a local personal data check. No AI model and deliberately no risk score.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'guideline-navigator',
    name: 'Guideline Navigator',
    tagline: 'Ask the guidelines, get cited answers',
    group: 'Document and Data AI',
    maturity: 'lab',
    phase: 2,
    summary:
      'Questions are answered only from a curated library of evidence cards, each holding one paraphrased claim with full citation metadata. Retrieved cards are the only facts the model may use, every factual sentence must cite a card, and a post-generation check replaces answers with weak citation support by the raw cards themselves.',
    limitations:
      'Coverage is limited to the curated library and the refusal template says so. Answers are general education, never recommendations for an individual case.',
    inputKinds: ['text'],
    route: '#lab/guideline-navigator',
    models:
      'A curated evidence card library is retrieved locally and the cards are the only facts used. An optional Worker AI explanation may narrate the retrieved cards after consent; weak citation support falls back to the raw cards.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
    displayName: 'Ask the Guidelines',
    benefit: 'Ask a question and get an answer with its sources.',
    inputs: ['text'],
    minutes: 2,
    zone: 'think',
  },
  {
    id: 'plain-translator',
    name: 'Plain-Language Translator',
    tagline: 'Medical words in, everyday words out',
    group: 'Document and Data AI',
    maturity: 'lab',
    phase: 1,
    summary:
      'Medical text is rewritten into plain English at a grade 6 to 8 reading level, with an everyday Indonesian option. Numbers, doses, units, dates, and medicine names are locked before rewriting and verified identical afterwards; any change rejects the result instead of presenting shifted numbers.',
    limitations:
      'The output is a simpler wording of the same text shown side by side with the original, never new medical advice. The original text is never hidden or replaced.',
    inputKinds: ['text', 'synthetic-demo'],
    route: '#lab/plain-translator',
    models:
      'Rewriting is requested through the Worker AI endpoint after consent, and a deterministic local check verifies that every number, dose, date, and medicine name matches the original; any change rejects the result.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'model-bench',
    name: 'Model Experiment Bench',
    tagline: 'Same case, several models, open results',
    group: 'Research Platform',
    maturity: 'lab',
    phase: 2,
    summary:
      'Run the same fixed synthetic case set through two or three models or prompts, compare answers side by side, and flag hallucinations and guardrail violations with a shared rubric. Evaluation logs are publishable research artifacts with no user data.',
    limitations:
      'Benchmark results describe behaviour on synthetic cases only and are never evidence of clinical performance.',
    inputKinds: ['library-case'],
    route: '#lab/model-bench',
    models:
      'Runs fixed synthetic cases through the Worker AI endpoint (models configured on the server) and scores the replies with a local deterministic rubric. Results describe behaviour on synthetic cases only.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
    displayName: 'Model Bench',
    benefit: 'Watch how AI models answer the same case, side by side.',
    inputs: ['touch'],
    minutes: 3,
    zone: 'review',
  },
  {
    id: 'privacy-shield',
    name: 'Privacy Shield',
    tagline: 'Find identifiers in your text and mask them before sharing',
    group: 'Research Platform',
    maturity: 'lab',
    phase: 0,
    summary:
      'Paste a draft message, case note, or document excerpt and Privacy Shield scans it entirely in your browser for patterns that look like personal identifiers: names after greetings and labels, email addresses, phone numbers, medical record numbers, national ID numbers (NIK), and dates of birth. The original text with finds highlighted is shown side by side with a masked copy that you can copy or download. The text is never uploaded, stored, or sent to the AI service.',
    limitations:
      'Detection is a pattern-matching learning aid, not a compliance guarantee: it can miss identifiers and can mask words that are not identifiers, and finding nothing is not proof that a text is safe to share. Always read the masked copy yourself and check it before sharing it anywhere.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/privacy-shield',
    models:
      'Fully local: deterministic personal data pattern scanning and a per-feature data flow inventory rendered in the browser. No AI model, and no data leaves the device.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
    displayName: 'Privacy Shield',
    benefit: 'Find and mask personal details before you share any text.',
    inputs: ['text'],
    minutes: 1,
    zone: 'think',
  },
  {
    id: 'adaptive-tutor',
    name: 'Adaptive AI Tutor',
    tagline: 'Practice that follows your error patterns',
    group: 'Research Platform',
    maturity: 'lab',
    phase: 2,
    summary:
      'Your session error patterns in the simulator, quiz, and challenges drive what comes next: remedial cases are selected from the bank by error tag, and the model writes the session feedback narrative and practice plan. History lives only in session memory.',
    limitations:
      'Recommendations are based on a single session of practice behaviour, not on any assessment of clinical competence.',
    inputKinds: ['session-history'],
    route: '#lab/adaptive-tutor',
    models:
      'Local deterministic tracking of practice error patterns in the browser; an optional Worker AI explanation writes the session feedback narrative after consent. Progress is stored only in localStorage on this device.',
    retention:
      'Progress stored only in localStorage in this browser on this device; it is never uploaded and can be cleared from the tutor page',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'transparency-dashboard',
    name: 'Evaluation and Transparency Dashboard',
    tagline: 'Benchmarks you can reproduce',
    group: 'Research Platform',
    maturity: 'lab',
    phase: 2,
    summary:
      'A public page of internal benchmark results generated from the evaluation harness artifacts in the repository: emergency guard recall on paraphrase sets, unsafe question refusal rates, latency, and cannot-analyze rates per feature.',
    limitations:
      'All numbers come from synthetic datasets and internal rubrics. They measure guard and explanation quality, not clinical accuracy.',
    inputKinds: ['repository-artifacts'],
    route: '#lab/transparency-dashboard',
    models:
      'No AI model. Static aggregation in the browser of evaluation artifacts bundled from the repository: guard recall, refusal rates, latency, and cannot-analyze rates.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
];

/**
 * Registry v2: the R1 rebuild features. These are new entries, not renames
 * of legacy ones: their copy describes the technology that actually runs
 * (MediaPipe landmark models and browser speech recognition), and their
 * legacy predecessors stay in FEATURES until the rebuilt shell takes over.
 * The migration map between the two sets is LEGACY_ALIASES below.
 */
export const R1_FEATURES: FeatureEntry[] = [
  {
    id: 'fast-live-check',
    name: 'FAST Live Check',
    displayName: 'FAST Live Check',
    tagline: 'Face, arm, and speech practice that the camera really measures',
    group: 'Flagship',
    maturity: 'lab',
    phase: 1,
    benefit: 'Practice the FAST signs, measured live or described from an upload.',
    inputs: ['camera', 'microphone'],
    minutes: 3,
    zone: 'check',
    summary:
      'One guided session with three measured stages. The Face stage tracks your face with an on-device landmark model while you smile and raise your brows, and compares how much each side moved from your own resting face. The Arm stage measures each arm angle in the camera picture while you hold both arms raised out to the sides for 10 seconds. The Speech stage transcribes one target sentence with the browser speech recognizer and aligns it word by word. Every stage reports its own data quality, and a stage that cannot be measured says so instead of filling in a value. For the face and arm stages you can also upload a photo or a short video instead of using the camera: frames prepared on this device are sent to the Worker AI endpoint, which describes what it sees in them rather than measuring.',
    limitations:
      'The output is an observation sheet, never a score, a verdict, or a diagnosis. On the upload path the sheet records the AI description as an impression from the images, not a measurement. The arm position is adapted to the sides because a forward raise cannot be measured honestly from a single 2D camera. Small left-right differences are common, landmark estimates are noisy, and this session cannot rule out stroke.',
    inputKinds: ['camera', 'microphone'],
    route: '#lab/fast-live-check',
    models:
      'On the camera path, MediaPipe Face Landmarker and Pose Landmarker run locally in the browser on the camera video; no camera video is uploaded or stored. On the upload path, frames extracted on this device from a photo or video you choose are sent to the Worker AI endpoint (a server-side model configured by the site), which describes what it sees in them; those frames are described, not measured, and they are not stored. The speech stage is transcribed by the browser speech recognition service (see Speech Lab for the provider details), and the word alignment is deterministic and computed on the device. No model produces a score or a diagnosis.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'face-lab',
    name: 'Face Lab',
    displayName: 'Face Lab',
    tagline: 'Automatic face landmarks, expression missions, honest comparisons',
    group: 'Vision AI',
    maturity: 'lab',
    phase: 1,
    benefit: 'Compare how each side of your face moves, live or uploaded.',
    inputs: ['camera'],
    minutes: 2,
    zone: 'check',
    summary:
      'Your camera finds your face automatically, so there are no landmarks to place by hand. Short expression missions (smile, brow raise, cheek puff) are tracked live, and the result compares the relative movement of the left and right sides of your face against your own resting baseline. A labelled learning mode places your curves next to a symmetric example and a teaching case. You can also upload a photo or a short video instead of using the camera: the photo, or frames prepared on this device from the video, are described by the Worker AI endpoint instead of being measured.',
    limitations:
      'Comparisons describe relative movement in one recording, not symmetry findings. Landmark estimates shift with lighting, distance, and head turns, so small differences are expected and are never labelled normal or abnormal. When the face cannot be tracked well enough, the lab reports cannot analyze.',
    inputKinds: ['camera'],
    route: '#lab/face-lab',
    models:
      'On the camera path, MediaPipe Face Landmarker runs locally in the browser and estimates 478 facial landmarks and expression blendshapes from the camera video. The left-right movement comparisons are deterministic geometry computed on the device from those landmarks, and camera video is never uploaded or stored. On the upload path, the photo itself, or frames extracted on this device from a video you choose, are sent to the Worker AI endpoint (a server-side model configured by the site), which describes what it can see in them; that description is an impression from the images, not a measurement, and the frames are not stored.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'movement-lab',
    name: 'Movement Lab',
    displayName: 'Movement Lab',
    tagline: 'Arm drift and finger taps, measured by your camera',
    group: 'Motor AI',
    maturity: 'lab',
    phase: 1,
    benefit: 'Watch arm angles and finger taps become charts, live or uploaded.',
    inputs: ['camera'],
    minutes: 3,
    zone: 'check',
    summary:
      'Two camera-measured movement practices. Arm Raise follows each arm angle in the camera picture while you hold both arms out to the sides for 10 seconds, charting any drift as it happens. Hand Lab counts real thumb-to-index finger taps from the distance between hand landmarks, 10 seconds per hand, and shows your rhythm as a strip for each hand. A clearly labelled simulation mode replays recorded landmark sessions when no camera is available. For either exercise you can also upload a video instead of using the camera: frames extracted on this device are described by the Worker AI endpoint rather than measured.',
    limitations:
      'Angles are 2D projections in the camera picture, not depth, strength, or a clinical measurement. The practice threshold line is a training aid you can move; it is explicitly not a medical cut-off. Limbs that leave the frame cannot be measured, and the lab reports cannot analyze instead of guessing.',
    inputKinds: ['camera', 'synthetic-demo'],
    route: '#lab/movement-lab',
    models:
      'On the camera path, MediaPipe Pose Landmarker and Hand Landmarker run locally in the browser on the camera video; arm angles and tap counts are deterministic geometry computed on the device from those landmarks, and camera video is never uploaded or stored. The simulation mode replays recorded landmark data and is labelled as a demo. On the upload path, frames extracted on this device from a video you choose are sent to the Worker AI endpoint (a server-side model configured by the site), which describes the movement it can see across the frames; it does not measure angles or count taps, and the frames are not stored.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'speech-lab',
    name: 'Speech Lab',
    displayName: 'Speech Lab',
    tagline: 'Read one sentence and see exactly what was heard',
    group: 'Speech and Language AI',
    maturity: 'lab',
    phase: 1,
    benefit: 'Read a sentence aloud and see every word it heard.',
    inputs: ['microphone'],
    minutes: 2,
    zone: 'check',
    summary:
      'You read one target sentence aloud. The browser speech recognizer transcribes it, and a deterministic local alignment marks every target word as heard as written, heard differently (with the word that was actually heard), or not heard. The raw transcript is always shown exactly as received, and a listen-and-compare panel plays your recording next to a human example reading.',
    limitations:
      'A mismatch shows what the recognizer heard, not how well you speak: recognizers mishear accents, noise, and quiet voices, and they are known to perform worse on post-stroke speech. There is no speech score. Browsers without speech recognition, such as Firefox, get a clearly labelled typing practice instead; it is never presented as a speech measurement.',
    inputKinds: ['microphone'],
    route: '#lab/speech-lab',
    models:
      'The browser speech recognition service transcribes your reading, so it is not transcribed purely on this device: in Chrome and Edge the audio is sent to the browser provider (Google or Microsoft) for transcription, and in Safari it is handled by Apple. This site receives only the transcript text. The word-by-word alignment against the target sentence is deterministic and computed locally, and nothing is stored.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'document-studio',
    name: 'Document Studio',
    displayName: 'Document Studio',
    tagline: 'One pasted document, three checklists you can trust',
    group: 'Document and Data AI',
    maturity: 'lab',
    phase: 1,
    benefit: 'Turn discharge papers, pasted or photographed, into checklists you can follow.',
    inputs: ['text'],
    minutes: 2,
    zone: 'think',
    summary:
      'Paste a discharge summary or a health history into one box. The studio detects which kind of document it is (and lets you switch the guess with one tap), then offers three outputs over the same text: a discharge checklist whose facts point back to their source lines, a risk factor profile where every factor carries a verbatim quote and a status, and a plain-language version whose numbers, doses, dates, and medicine names are locked and verified unchanged. A fictional example document is one tap away. A second, separate path accepts a photo of the document instead of pasted text: the photo is sent to the Worker AI endpoint, which reads and summarizes what it can see in the image, and that reading is labelled as AI output everywhere it appears.',
    limitations:
      'Extraction can be wrong and the original document always wins. There is deliberately no risk score and no conversion of relative dates. The photo path is a separate AI reading, not a studio OCR step: the AI can misread handwriting, doses, and names, and PDF files are not accepted on either path.',
    inputKinds: ['text', 'synthetic-demo'],
    route: '#lab/document-studio',
    models:
      'The pasted-text path uses fully local deterministic parsers on this device: a line-based document parser, a fixed risk factor extractor verified as exact quotes, and a glossary-based plain-language rewrite guarded by a number and name locking check, and nothing is uploaded for pasted text. The separate photo path sends the photo to the Worker AI endpoint (a server-side model configured by the site), which reads and summarizes the document image; the studio itself runs no OCR. Nothing is stored on either path.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
  {
    id: 'ask-the-lab',
    name: 'Ask the Lab',
    displayName: 'Ask the Lab',
    tagline: 'One door for every question about this lab',
    group: 'Research Platform',
    maturity: 'lab',
    phase: 1,
    benefit: 'Ask anything about the lab and get a guarded answer.',
    inputs: ['text'],
    minutes: 1,
    zone: 'think',
    summary:
      'A single chat door for the whole site, replacing the separate coach on every feature page. Example question chips cover general questions and the feature you just tried. When you come from a lab, a short context note travels with your question, but it only ever contains labels and counts from your session, never your raw text, recordings, or document content.',
    limitations:
      'Answers are general education and can be wrong; they are never advice for an individual case. Questions describing current symptoms are routed to the emergency panel instead of being answered as chat.',
    inputKinds: ['text'],
    route: '#lab/ask-the-lab',
    models:
      'Questions are answered through the Worker AI endpoint (a server-side model configured by the site) after one session consent, behind the same emergency guard, personal data redaction, and per-feature rate limits as the rest of the site. The labs themselves keep their deterministic local cores; this door only explains and answers.',
    retention: 'Nothing is stored',
    evalReport: 'Not evaluated yet',
  },
];

/**
 * Feature ids that exist as rebuild targets for R2 but have no registry
 * entry yet. LEGACY_ALIASES may point at them; they join the catalog when
 * their phase is built.
 */
export const PLANNED_FEATURE_IDS: readonly string[] = [
  'language-practice',
  'case-room',
  'vision-tests',
  'scope-reviewers',
];

/** Legacy features that stay in the public catalog for R1, with v2 fields filled. */
export const R1_RETAINED_IDS: readonly string[] = [
  'guideline-navigator',
  'privacy-shield',
  'model-bench',
];

/** The combined public catalog for R1: the new features plus the retained ones. */
export const R1_CATALOG: FeatureEntry[] = [
  ...R1_FEATURES,
  ...FEATURES.filter((feature) => R1_RETAINED_IDS.includes(feature.id)),
];

/**
 * Migration map from a legacy feature id to its rebuild target, as data
 * only (no routing logic lives here). A null target means the feature is
 * retired with no successor. Targets listed in PLANNED_FEATURE_IDS are R2
 * features that have no registry entry yet.
 */
export const LEGACY_ALIASES: Readonly<Record<string, string | null>> = {
  'digital-fast-multimodal': 'fast-live-check',
  'face-analyzer': 'face-lab',
  'face-dynamics': 'face-lab',
  'gaze-tracker': null,
  'neglect-explorer': 'vision-tests',
  'speech-analyzer': 'speech-lab',
  'aphasia-expression': 'language-practice',
  'aphasia-communication': 'language-practice',
  'comprehension-check': 'language-practice',
  'nihss-language-assistant': 'nihss-trainer',
  'arm-drift': 'movement-lab',
  'finger-tapping': 'movement-lab',
  'balance-lab': 'movement-lab',
  'fast-vision-check': 'vision-tests',
  'stroke-code-simulator': 'case-room',
  'mimic-detective': 'case-room',
  'localization-challenge': 'case-room',
  'virtual-patient-osce': 'case-room',
  'adaptive-tutor': 'case-room',
  'discharge-lens': 'document-studio',
  'risk-extractor': 'document-studio',
  'plain-translator': 'document-studio',
  'transparency-dashboard': 'scope-reviewers',
};

export function getFeature(id: string): FeatureEntry | undefined {
  return (
    FEATURES.find((feature) => feature.id === id) ??
    R1_FEATURES.find((feature) => feature.id === id)
  );
}
