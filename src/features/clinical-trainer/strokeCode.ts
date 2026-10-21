// Stroke Code Simulator: deterministic, template-based acute scenarios.
//
// TRAINING ONLY. All patients are fictional. Scenarios are fixed templates
// written for this trainer; nothing is generated per session. A deterministic
// engine owns the clock, the milestones, and every score. Time targets are
// common teaching targets for stroke pathways (door to CT within 25 minutes,
// door to needle within 60 minutes, last known well to needle within 270
// minutes, door to arterial puncture within 90 minutes). They are training
// benchmarks, not a substitute for a local stroke protocol, and eligibility
// inside a scenario is fixed by the scenario key, never by a model.

export type Verdict = 'optimal' | 'acceptable' | 'poor' | 'critical';
export type Milestone = 'ct' | 'needle' | 'groin';

export interface SimOption {
  id: string;
  label: string;
  detail?: string;
  /** Simulated minutes this choice consumes. */
  minutes: number;
  /** Points earned, out of the step's maxPoints. */
  points: number;
  verdict: Verdict;
  feedback: string;
  milestone?: Milestone;
  flag?: string;
}

export interface SimStep {
  id: string;
  phase: string;
  title: string;
  prompt: string;
  context?: string;
  maxPoints: number;
  options: SimOption[];
}

export interface SimTarget {
  id: string;
  label: string;
  limitMinutes: number;
  source: Milestone | 'lkwToNeedle';
}

export interface SimScenario {
  id: string;
  title: string;
  difficulty: 'Classic' | 'Intermediate' | 'Complicated';
  doorClock: string;
  /** Minutes from last known well (or witnessed onset) to the door. */
  lkwMinutesBeforeDoor: number;
  onsetKind: 'witnessed onset' | 'last known well';
  intro: string[];
  targets: SimTarget[];
  idealPath: string[];
  steps: SimStep[];
}

export interface TimelineEntry {
  stepId: string;
  phase: string;
  choiceLabel: string;
  startAt: number;
  endAt: number;
  verdict: Verdict;
}

export interface RunState {
  scenarioId: string;
  stepIndex: number;
  elapsed: number;
  points: number;
  maxPoints: number;
  entries: TimelineEntry[];
  milestones: Partial<Record<Milestone, number>>;
  flags: string[];
  critical: string[];
  finished: boolean;
}

export function createRun(scenario: SimScenario): RunState {
  return {
    scenarioId: scenario.id,
    stepIndex: 0,
    elapsed: 0,
    points: 0,
    maxPoints: 0,
    entries: [],
    milestones: {},
    flags: [],
    critical: [],
    finished: false,
  };
}

/**
 * Apply one decision. Pure: the input state is never mutated, so the UI can
 * keep a history and tests can replay any path.
 */
export function applyChoice(scenario: SimScenario, state: RunState, optionId: string): RunState {
  if (state.finished) return state;
  const step = scenario.steps[state.stepIndex];
  if (!step) return state;
  const option = step.options.find((entry) => entry.id === optionId);
  if (!option) return state;
  const startAt = state.elapsed;
  const endAt = startAt + option.minutes;
  const milestones = { ...state.milestones };
  if (option.milestone && milestones[option.milestone] === undefined) {
    milestones[option.milestone] = endAt;
  }
  const nextIndex = state.stepIndex + 1;
  return {
    scenarioId: state.scenarioId,
    stepIndex: nextIndex,
    elapsed: endAt,
    points: state.points + option.points,
    maxPoints: state.maxPoints + step.maxPoints,
    entries: [
      ...state.entries,
      {
        stepId: step.id,
        phase: step.phase,
        choiceLabel: option.label,
        startAt,
        endAt,
        verdict: option.verdict,
      },
    ],
    milestones,
    flags: option.flag && !state.flags.includes(option.flag) ? [...state.flags, option.flag] : state.flags,
    critical:
      option.verdict === 'critical'
        ? [...state.critical, `${step.title}: ${option.feedback}`]
        : state.critical,
    finished: nextIndex >= scenario.steps.length,
  };
}

export interface TargetCheck {
  id: string;
  label: string;
  limitMinutes: number;
  /** Minutes achieved, or null when the milestone never happened. */
  value: number | null;
  met: boolean | null;
  note: string;
}

export interface SimResults {
  rawScorePct: number;
  scorePct: number;
  grade: string;
  doorToCT: number | null;
  doorToNeedle: number | null;
  lkwToNeedle: number | null;
  doorToGroin: number | null;
  targetChecks: TargetCheck[];
  critical: string[];
  debrief: string[];
}

function scoreGrade(scorePct: number, criticalCount: number): string {
  if (criticalCount > 0) return 'Unsafe path: review the critical decisions before anything else';
  if (scorePct >= 90) return 'Excellent: fast and guideline-shaped';
  if (scorePct >= 75) return 'Solid: minor inefficiencies only';
  if (scorePct >= 60) return 'Developing: the right ideas, in a slower order';
  return 'Needs review: rebuild the sequence step by step';
}

export function computeResults(scenario: SimScenario, state: RunState): SimResults {
  const doorToCT = state.milestones.ct ?? null;
  const doorToNeedle = state.milestones.needle ?? null;
  const doorToGroin = state.milestones.groin ?? null;
  const lkwToNeedle =
    doorToNeedle === null ? null : scenario.lkwMinutesBeforeDoor + doorToNeedle;

  const valueFor = (source: SimTarget['source']): number | null => {
    if (source === 'ct') return doorToCT;
    if (source === 'needle') return doorToNeedle;
    if (source === 'groin') return doorToGroin;
    return lkwToNeedle;
  };

  const targetChecks: TargetCheck[] = scenario.targets.map((target) => {
    const value = valueFor(target.source);
    if (value === null) {
      return {
        id: target.id,
        label: target.label,
        limitMinutes: target.limitMinutes,
        value,
        met: null,
        note: 'This milestone never happened in your run.',
      };
    }
    const met = value <= target.limitMinutes;
    return {
      id: target.id,
      label: target.label,
      limitMinutes: target.limitMinutes,
      value,
      met,
      note: met
        ? `Done in ${value} minutes against a ${target.limitMinutes} minute target.`
        : `${value} minutes, which misses the ${target.limitMinutes} minute target by ${value - target.limitMinutes} minutes.`,
    };
  });

  const rawScorePct = state.maxPoints > 0 ? Math.round((state.points / state.maxPoints) * 100) : 100;
  // A single critical decision (treating before imaging, lysing a
  // contraindicated patient, anchoring the window on the wrong time) makes
  // the whole run unsafe in real life, so the score is capped, not averaged.
  const scorePct = state.critical.length > 0 ? Math.min(rawScorePct, 49) : rawScorePct;

  const debrief: string[] = [];
  debrief.push(
    `Final clock: ${state.elapsed} simulated minutes from door to the end of the scenario.`,
  );
  for (const check of targetChecks) {
    debrief.push(`${check.label}: ${check.note}`);
  }
  if (!state.flags.includes('glucose-checked')) {
    debrief.push(
      'Bedside glucose was never checked. A glucose check is a basic safety step: hypoglycemia can imitate a stroke, and the result belongs in every stroke code.',
    );
  }
  if (state.critical.length > 0) {
    debrief.push(
      `${state.critical.length} critical decision(s) were made. In a real pathway any one of them can harm a patient, which is why the score is capped regardless of the rest of the run.`,
    );
  } else {
    debrief.push('No critical decisions. Every unsafe branch was avoided.');
  }

  return {
    rawScorePct,
    scorePct,
    grade: scoreGrade(scorePct, state.critical.length),
    doorToCT,
    doorToNeedle,
    lkwToNeedle,
    doorToGroin,
    targetChecks,
    critical: [...state.critical],
    debrief,
  };
}

/** Add simulated minutes to an "HH:MM" clock label, wrapping past midnight. */
export function addMinutesToClock(clock: string, minutes: number): string {
  const parts = clock.split(':');
  const hours = Number(parts[0] ?? '0');
  const mins = Number(parts[1] ?? '0');
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Scenario bank. Fixed templates with planted facts and contraindications.
// ---------------------------------------------------------------------------

const DOOR_STEP: SimStep = {
  id: 'door',
  phase: 'Door',
  title: 'First move on arrival',
  prompt: 'The patient arrives in the emergency department. What happens first?',
  maxPoints: 10,
  options: [
    {
      id: 'activate',
      label: 'Activate the stroke code, record the door time, and move straight toward the scanner',
      minutes: 5,
      points: 10,
      verdict: 'optimal',
      feedback: 'Activation first. The clock is the treatment, and the scanner is the next decision point.',
      flag: 'code-activated',
    },
    {
      id: 'full-exam-first',
      label: 'Complete a full, detailed neurological examination at the bedside first',
      minutes: 12,
      points: 4,
      verdict: 'poor',
      feedback:
        'A focused exam matters, but a full examination before imaging spends the window. Examine on the way, not instead of the way.',
    },
    {
      id: 'wait-labs',
      label: 'Wait for the full laboratory panel before ordering any imaging',
      minutes: 20,
      points: 0,
      verdict: 'critical',
      feedback:
        'Imaging must never wait for routine labs. Only a glucose result is needed before treatment decisions; everything else runs in parallel.',
    },
    {
      id: 'observe',
      label: 'Place a peripheral line and observe for 30 minutes to see if symptoms settle',
      minutes: 30,
      points: 0,
      verdict: 'critical',
      feedback:
        'Observation is not a plan in acute stroke. Symptoms that settle can still be an occluded artery, and the treatment window closes meanwhile.',
    },
  ],
};

const GLUCOSE_STEP: SimStep = {
  id: 'safety-checks',
  phase: 'Parallel checks',
  title: 'The check that must not be skipped',
  prompt: 'While the scanner is being prepared, which bedside step is essential right now?',
  maxPoints: 10,
  options: [
    {
      id: 'glucose',
      label: 'Check finger-stick glucose now',
      detail: 'Result returns within the step and is recorded for the team.',
      minutes: 2,
      points: 10,
      verdict: 'optimal',
      feedback: 'Correct. Low blood sugar can imitate a stroke, and glucose is the one lab value the pathway cannot proceed without.',
      flag: 'glucose-checked',
    },
    {
      id: 'ecg-first',
      label: 'Obtain a 12-lead ECG and wait for the printed tracing before scanning',
      minutes: 8,
      points: 4,
      verdict: 'poor',
      feedback: 'Cardiac monitoring matters, but it runs in parallel. A printed ECG must not stand between the patient and the scanner.',
    },
    {
      id: 'aspirin-now',
      label: 'Give aspirin 300 mg immediately',
      minutes: 1,
      points: 0,
      verdict: 'critical',
      feedback:
        'Antiplatelets before imaging can be given into an undiagnosed hemorrhage. Aspirin waits until bleeding is excluded on the scan.',
    },
    {
      id: 'skip-checks',
      label: 'Skip bedside checks entirely; everything can wait until after treatment',
      minutes: 0,
      points: 2,
      verdict: 'poor',
      feedback: 'Speed is right, but skipping the glucose check removes a basic safety net and can send a mimic down the stroke pathway.',
    },
  ],
};

export const STROKE_CODE_SCENARIOS: SimScenario[] = [
  {
    id: 'scenario-classic',
    title: 'First Light: a classic window case',
    difficulty: 'Classic',
    doorClock: '09:00',
    lkwMinutesBeforeDoor: 50,
    onsetKind: 'witnessed onset',
    intro: [
      'A 72 year old woman had a witnessed onset at 08:10 while eating breakfast: sudden right-sided weakness and loss of speech. Paramedics pre-notified the hospital.',
      'At the door (09:00) she has a global aphasia, right facial weakness, and a right arm and leg that barely move against gravity. Training NIHSS estimate: 16.',
      'Blood pressure 168/92. She takes no anticoagulant. Weight about 70 kg. Glucose has not been checked yet.',
    ],
    targets: [
      { id: 'd2ct', label: 'Door to CT', limitMinutes: 25, source: 'ct' },
      { id: 'd2n', label: 'Door to needle', limitMinutes: 60, source: 'needle' },
      { id: 'lkw2n', label: 'Onset to needle', limitMinutes: 270, source: 'lkwToNeedle' },
    ],
    idealPath: [
      'Activate the stroke code at the door and move to imaging without waiting for labs.',
      'Check glucose in parallel; never give antiplatelets before the scan.',
      'Non-contrast CT plus CT angiography in one session: no hemorrhage, left M1 occlusion.',
      'Blood pressure 168/92 is below the 185/110 thrombolysis threshold, so proceed without delay.',
      'Give IV thrombolysis inside the window and activate thrombectomy in parallel for the M1 occlusion.',
    ],
    steps: [
      DOOR_STEP,
      GLUCOSE_STEP,
      {
        id: 'imaging',
        phase: 'Imaging',
        title: 'First imaging',
        prompt: 'Which imaging do you order first?',
        maxPoints: 10,
        options: [
          {
            id: 'ct-cta',
            label: 'Non-contrast head CT plus CT angiography in the same session',
            minutes: 15,
            points: 10,
            verdict: 'optimal',
            feedback:
              'One trip answers both questions: is there bleeding, and is a large artery blocked. CT: no hemorrhage, early ischemic change, ASPECTS 9. CTA: left M1 occlusion.',
            milestone: 'ct',
          },
          {
            id: 'ncct-only',
            label: 'Non-contrast head CT only, decide about angiography afterwards',
            minutes: 10,
            points: 7,
            verdict: 'acceptable',
            feedback:
              'The bleeding question is answered fast, but the vessel question then needs a second trip. CT: no hemorrhage, ASPECTS 9. You still do not know about the M1.',
            milestone: 'ct',
          },
          {
            id: 'mri-first',
            label: 'MRI brain with diffusion sequences first',
            minutes: 35,
            points: 4,
            verdict: 'poor',
            feedback:
              'MRI shows more, later. It delays the bleeding answer and the thrombolysis decision without changing either one in this case.',
            milestone: 'ct',
          },
          {
            id: 'xray-first',
            label: 'Skull and chest X-rays first',
            minutes: 15,
            points: 0,
            verdict: 'critical',
            feedback: 'Plain films answer neither the bleeding question nor the vessel question. The window closes while they are taken.',
          },
        ],
      },
      {
        id: 'bp',
        phase: 'Blood pressure',
        title: 'Pressure check before the drug',
        prompt: 'The scan shows no hemorrhage. Blood pressure is 168/92 and IV thrombolysis is being prepared. What do you do about the pressure?',
        maxPoints: 10,
        options: [
          {
            id: 'proceed',
            label: 'Proceed: 168/92 is below the 185/110 treatment threshold',
            minutes: 0,
            points: 10,
            verdict: 'optimal',
            feedback: 'Correct. The threshold for withholding or treating before thrombolysis is 185/110. This pressure needs monitoring, not a delay.',
          },
          {
            id: 'lower-hard',
            label: 'Lower the pressure aggressively toward 120/80 before treating',
            minutes: 15,
            points: 2,
            verdict: 'poor',
            feedback: 'Overshooting the pressure drop can starve the penumbra, and the 15 minutes come straight out of the window.',
          },
          {
            id: 'withhold-bp',
            label: 'Withhold thrombolysis because the blood pressure is too high',
            minutes: 0,
            points: 0,
            verdict: 'critical',
            feedback: '168/92 is not above the treatment threshold. Withholding here denies a therapy the patient is eligible for.',
          },
        ],
      },
      {
        id: 'therapy',
        phase: 'Reperfusion decision',
        title: 'Choosing the reperfusion plan',
        prompt: 'Angiography (or the thrombectomy team\'s review) confirms a left M1 occlusion. She is inside the IV thrombolysis window. What is the plan?',
        context: 'If angiography was not part of your imaging, the thrombectomy team confirms the M1 occlusion on a rapid CTA acquired during this step.',
        maxPoints: 10,
        options: [
          {
            id: 'both',
            label: 'Give IV thrombolysis now and activate thrombectomy in parallel',
            minutes: 10,
            points: 10,
            verdict: 'optimal',
            feedback: 'Both, in parallel. Eligible patients receive IV thrombolysis even when thrombectomy is planned; one pathway never waits for the other.',
            milestone: 'needle',
            flag: 'thrombectomy-activated',
          },
          {
            id: 'iv-only',
            label: 'Give IV thrombolysis and admit for observation, with no thrombectomy referral',
            minutes: 10,
            points: 5,
            verdict: 'acceptable',
            feedback: 'The drug is right, but an M1 occlusion frequently needs mechanical removal. Leaving thrombectomy out halves the plan.',
            milestone: 'needle',
          },
          {
            id: 'mt-only',
            label: 'Skip IV thrombolysis and go straight to thrombectomy',
            minutes: 10,
            points: 5,
            verdict: 'acceptable',
            feedback: 'Thrombectomy is right; skipping the drug is not. When a patient is eligible for both, guidelines keep the IV treatment and add the procedure.',
            flag: 'thrombectomy-activated',
          },
          {
            id: 'neither',
            label: 'No reperfusion therapy. Start antiplatelets and reassess tomorrow',
            minutes: 5,
            points: 0,
            verdict: 'critical',
            feedback: 'This abandons both proven treatments inside their windows. Antiplatelets are not a reperfusion strategy.',
          },
        ],
      },
      {
        id: 'handoff',
        phase: 'Handoff',
        title: 'Moving to the angiography suite',
        prompt: 'The patient is being transferred for thrombectomy. How do you hand over?',
        maxPoints: 10,
        options: [
          {
            id: 'structured',
            label: 'Structured handoff: onset time, imaging findings, needle time, pressure, glucose, and pending tasks',
            minutes: 3,
            points: 10,
            verdict: 'optimal',
            feedback: 'Every number the receiving team needs, in one pass. Nothing has to be re-asked while the clock runs.',
          },
          {
            id: 'brief',
            label: 'Brief verbal summary: "M1 occlusion, lysed, coming up now"',
            minutes: 1,
            points: 5,
            verdict: 'acceptable',
            feedback: 'The headline is there, but the receiving team will have to chase the times and values themselves.',
          },
          {
            id: 'none',
            label: 'Send the patient up; the chart will follow when it is ready',
            minutes: 0,
            points: 0,
            verdict: 'critical',
            feedback: 'An undocumented transfer in a time-critical pathway loses times, doses, and contraindication checks.',
          },
        ],
      },
    ],
  },
  {
    id: 'scenario-wakeup',
    title: 'Found at Dawn: a wake-up stroke',
    difficulty: 'Intermediate',
    doorClock: '07:15',
    lkwMinutesBeforeDoor: 495,
    onsetKind: 'last known well',
    intro: [
      'A 78 year old man was last seen normal by his wife at 23:00. At 06:30 she finds him awake in bed with a weak right side and almost no speech.',
      'At the door (07:15) he has a right facial weakness, a weak right arm and leg, and a severe expressive aphasia. Training NIHSS estimate: 15.',
      'Blood pressure 158/88. No anticoagulant. Glucose has not been checked yet.',
    ],
    targets: [
      { id: 'd2ct', label: 'Door to CT', limitMinutes: 25, source: 'ct' },
      { id: 'd2g', label: 'Door to arterial puncture', limitMinutes: 90, source: 'groin' },
    ],
    idealPath: [
      'Anchor every window on last known well (23:00), never on the time he was found.',
      'Activate the code and image immediately: the onset question does not slow the scanner.',
      'CT plus CTA: no hemorrhage, left M1 occlusion.',
      'No IV thrombolysis on clock criteria alone; the window is measured from last known well.',
      'Move urgently to thrombectomy evaluation and the angiography suite.',
    ],
    steps: [
      {
        id: 'onset-anchor',
        phase: 'History',
        title: 'Which time anchors the windows?',
        prompt: 'His wife last saw him normal at 23:00 and found him at 06:30. Which time do the treatment windows run from?',
        maxPoints: 10,
        options: [
          {
            id: 'lkw',
            label: 'Last known well: 23:00 last night',
            minutes: 2,
            points: 10,
            verdict: 'optimal',
            feedback: 'Correct. For an unwitnessed onset, the clock runs from last known well. Discovery time describes when help started, not when the stroke did.',
            flag: 'lkw-anchored',
          },
          {
            id: 'found',
            label: 'When he was found: 06:30 this morning',
            minutes: 2,
            points: 0,
            verdict: 'critical',
            feedback:
              'This is the classic wake-up stroke error. Anchoring on discovery time can push a team to give a time-limited drug many hours after the true window.',
          },
          {
            id: 'door-anchor',
            label: 'Door time: the clock starts when he reaches hospital',
            minutes: 2,
            points: 2,
            verdict: 'poor',
            feedback: 'Door time starts the hospital targets (door to CT, door to needle). It never resets the onset window.',
          },
        ],
      },
      DOOR_STEP,
      GLUCOSE_STEP,
      {
        id: 'imaging',
        phase: 'Imaging',
        title: 'First imaging',
        prompt: 'Which imaging do you order first?',
        maxPoints: 10,
        options: [
          {
            id: 'ct-cta',
            label: 'Non-contrast head CT plus CT angiography in the same session',
            minutes: 15,
            points: 10,
            verdict: 'optimal',
            feedback: 'CT: no hemorrhage. CTA: left M1 occlusion. The vessel finding is what drives the next decision in a wake-up case.',
            milestone: 'ct',
          },
          {
            id: 'ncct-only',
            label: 'Non-contrast head CT only',
            minutes: 10,
            points: 6,
            verdict: 'acceptable',
            feedback: 'No hemorrhage is confirmed, but without the vessel picture you cannot route him to thrombectomy evaluation yet.',
            milestone: 'ct',
          },
          {
            id: 'mri-first',
            label: 'MRI first, looking for a diffusion and FLAIR mismatch',
            minutes: 35,
            points: 5,
            verdict: 'acceptable',
            feedback:
              'Imaging-selected wake-up treatment exists in equipped centers under protocol, but MRI first delays the vessel answer that thrombectomy triage depends on.',
            milestone: 'ct',
          },
          {
            id: 'wait-repeat',
            label: 'No imaging yet; repeat the examination in one hour',
            minutes: 60,
            points: 0,
            verdict: 'critical',
            feedback: 'Waiting cannot clarify an unknown onset. Only imaging can move this case forward.',
          },
        ],
      },
      {
        id: 'therapy',
        phase: 'Reperfusion decision',
        title: 'The window decision',
        prompt: 'No hemorrhage, and a left M1 occlusion is confirmed. Last known well was over 8 hours ago. What is the reperfusion plan?',
        maxPoints: 10,
        options: [
          {
            id: 'mt-eval',
            label: 'No IV thrombolysis on clock criteria; urgent thrombectomy evaluation for the M1 occlusion',
            minutes: 10,
            points: 10,
            verdict: 'optimal',
            feedback: 'Correct. Large vessel occlusion keeps a mechanical pathway open well beyond the IV window, and evaluation is time-critical.',
            flag: 'thrombectomy-activated',
          },
          {
            id: 'imaging-selection',
            label: 'Pursue advanced imaging selection (perfusion or MRI mismatch) under the local extended-window protocol',
            minutes: 20,
            points: 8,
            verdict: 'acceptable',
            feedback:
              'A defensible protocol-based route in equipped centers. It earns its time only when it runs in parallel with thrombectomy triage, not instead of it.',
            flag: 'thrombectomy-activated',
          },
          {
            id: 'iv-by-discovery',
            label: 'Give IV thrombolysis, counting the window from the 06:30 discovery time',
            minutes: 10,
            points: 0,
            verdict: 'critical',
            feedback:
              'This treats a clock that never existed. From last known well he is far outside the IV window, and the bleeding risk of the drug is real.',
            milestone: 'needle',
          },
          {
            id: 'admit',
            label: 'Outside all windows. Admit to the ward without reperfusion evaluation',
            minutes: 5,
            points: 0,
            verdict: 'critical',
            feedback: 'The IV window being closed says nothing about the thrombectomy window. An M1 occlusion still needs urgent evaluation.',
          },
        ],
      },
      {
        id: 'transport',
        phase: 'Transfer',
        title: 'Getting to the angiography suite',
        prompt: 'Thrombectomy evaluation is positive. What happens next?',
        maxPoints: 10,
        options: [
          {
            id: 'wheels-now',
            label: 'Transfer to the angiography suite now, handoff on the move',
            minutes: 40,
            points: 10,
            verdict: 'optimal',
            feedback: 'Wheels moving is the metric. Door to arterial puncture is a tracked target in every mature pathway.',
            milestone: 'groin',
          },
          {
            id: 'repeat-ct',
            label: 'Repeat the CT in 6 hours to see how the infarct evolves first',
            minutes: 360,
            points: 0,
            verdict: 'critical',
            feedback: 'A delayed scan documents a larger infarct; it does not treat one. The occlusion will not wait politely.',
          },
          {
            id: 'observe-ed',
            label: 'Keep him in the emergency department for observation overnight',
            minutes: 120,
            points: 2,
            verdict: 'poor',
            feedback: 'Observation after a positive thrombectomy decision spends the remaining salvageable tissue.',
          },
        ],
      },
    ],
  },
  {
    id: 'scenario-complicated',
    title: 'Two Contraindications: anticoagulant and recent surgery',
    difficulty: 'Complicated',
    doorClock: '14:20',
    lkwMinutesBeforeDoor: 40,
    onsetKind: 'witnessed onset',
    intro: [
      'A 65 year old woman with atrial fibrillation takes apixaban; her last dose was 6 hours ago. Ten days ago she had a laparoscopic gallbladder removal.',
      'Onset was witnessed at 13:40: sudden right-sided weakness and speech arrest. At the door (14:20) the training NIHSS estimate is 18.',
      'Blood pressure 172/98. Glucose has not been checked yet. She is well inside the time window, which is exactly what makes the next decisions dangerous.',
    ],
    targets: [
      { id: 'd2ct', label: 'Door to CT', limitMinutes: 25, source: 'ct' },
      { id: 'd2g', label: 'Door to arterial puncture', limitMinutes: 90, source: 'groin' },
    ],
    idealPath: [
      'Activate the code and image immediately; contraindications change the drug decision, not the urgency.',
      'Take the medication and surgical history explicitly: apixaban 6 hours ago, major surgery 10 days ago.',
      'Check glucose in parallel, as always.',
      'CT plus CTA: no hemorrhage, left M1 occlusion.',
      'No IV thrombolysis: recent direct oral anticoagulant intake and surgery within 14 days are both contraindications.',
      'Activate thrombectomy and transfer without delay.',
    ],
    steps: [
      DOOR_STEP,
      {
        id: 'meds-history',
        phase: 'History',
        title: 'The history that changes the drug decision',
        prompt: 'While she is being moved, which history must be nailed down before any drug is given?',
        maxPoints: 10,
        options: [
          {
            id: 'ask-both',
            label: 'Ask directly: anticoagulant use and last dose, plus any surgery in the last 3 months',
            detail: 'Answer: apixaban, last dose 6 hours ago; gallbladder surgery 10 days ago.',
            minutes: 3,
            points: 10,
            verdict: 'optimal',
            feedback: 'Two planted contraindications found before they could hurt her: a direct oral anticoagulant taken 6 hours ago, and major surgery 10 days ago.',
            flag: 'contraindications-known',
          },
          {
            id: 'glucose-only-history',
            label: 'Check glucose and blood pressure; the medication list can be reconciled on the ward',
            minutes: 2,
            points: 3,
            verdict: 'poor',
            feedback: 'Glucose matters, but an unreconciled medication list is how contraindicated drugs get drawn up.',
          },
          {
            id: 'skip-history',
            label: 'Skip the detailed history; the window is short and the chart will catch up',
            minutes: 0,
            points: 0,
            verdict: 'critical',
            feedback: 'A short window is a reason to ask the two decisive questions faster, not to skip them.',
          },
        ],
      },
      GLUCOSE_STEP,
      {
        id: 'imaging',
        phase: 'Imaging',
        title: 'First imaging',
        prompt: 'Which imaging do you order first?',
        maxPoints: 10,
        options: [
          {
            id: 'ct-cta',
            label: 'Non-contrast head CT plus CT angiography in the same session',
            minutes: 15,
            points: 10,
            verdict: 'optimal',
            feedback: 'CT: no hemorrhage. CTA: left M1 occlusion. The vessel finding now carries the whole reperfusion plan.',
            milestone: 'ct',
          },
          {
            id: 'ncct-only',
            label: 'Non-contrast head CT only',
            minutes: 10,
            points: 6,
            verdict: 'acceptable',
            feedback: 'Bleeding is excluded, but the thrombectomy decision still needs the vessel picture.',
            milestone: 'ct',
          },
          {
            id: 'mri-first',
            label: 'MRI brain first for a complete picture',
            minutes: 35,
            points: 4,
            verdict: 'poor',
            feedback: 'Completeness is not the bottleneck; time is. MRI delays both the drug decision and the thrombectomy route.',
            milestone: 'ct',
          },
        ],
      },
      {
        id: 'therapy',
        phase: 'Reperfusion decision',
        title: 'The drug decision with two contraindications',
        prompt: 'No hemorrhage, left M1 occlusion, inside the time window, apixaban 6 hours ago, major surgery 10 days ago. What do you give and activate?',
        maxPoints: 10,
        options: [
          {
            id: 'mt-only-safe',
            label: 'No IV thrombolysis. Activate thrombectomy for the M1 occlusion',
            minutes: 10,
            points: 10,
            verdict: 'optimal',
            feedback: 'Correct on both counts: the drug is contraindicated twice over, and the mechanical pathway is fully open.',
            flag: 'thrombectomy-activated',
          },
          {
            id: 'iv-lytic',
            label: 'Give IV thrombolysis; she is young, severe, and inside the window',
            minutes: 10,
            points: 0,
            verdict: 'critical',
            feedback:
              'Severity and timing do not cancel contraindications. A recent direct oral anticoagulant and surgery 10 days ago both prohibit the drug.',
            milestone: 'needle',
          },
          {
            id: 'reversal-then-lytic',
            label: 'Give a reversal agent first, then IV thrombolysis',
            minutes: 25,
            points: 0,
            verdict: 'critical',
            feedback:
              'Reversal does not erase the surgical contraindication, and reversal agents are not a bridge to thrombolysis. The time is also lost.',
          },
          {
            id: 'heparin',
            label: 'Start an IV heparin infusion as the acute treatment',
            minutes: 5,
            points: 0,
            verdict: 'critical',
            feedback: 'Heparin is not an acute reperfusion therapy and adds bleeding risk in a recently operated patient with an occluded artery.',
          },
        ],
      },
      {
        id: 'transport',
        phase: 'Transfer',
        title: 'Getting to the angiography suite',
        prompt: 'The thrombectomy team accepts her. What happens next?',
        maxPoints: 10,
        options: [
          {
            id: 'wheels-now',
            label: 'Transfer to the angiography suite now, handoff on the move',
            minutes: 40,
            points: 10,
            verdict: 'optimal',
            feedback: 'The mechanical window is generous but not infinite, and penumbra is lost by the minute.',
            milestone: 'groin',
          },
          {
            id: 'wait-labs-full',
            label: 'Wait for the complete coagulation panel before transfer',
            minutes: 30,
            points: 2,
            verdict: 'poor',
            feedback: 'The panel informs the procedure; it does not gate it. Blood can be drawn on the way.',
          },
          {
            id: 'admit-ward',
            label: 'Admit to the ward; the procedure can be scheduled in the morning',
            minutes: 60,
            points: 0,
            verdict: 'critical',
            feedback: 'Thrombectomy is an emergency treatment, not an elective booking.',
          },
        ],
      },
    ],
  },
];

export function getStrokeCodeScenario(scenarioId: string): SimScenario {
  const found = STROKE_CODE_SCENARIOS.find((entry) => entry.id === scenarioId);
  if (!found) throw new Error(`Unknown stroke code scenario: ${scenarioId}`);
  return found;
}

/** Replay a list of option ids from the start; used by the UI to reset and by tests. */
export function replayChoices(scenario: SimScenario, optionIds: string[]): RunState {
  let state = createRun(scenario);
  for (const optionId of optionIds) {
    state = applyChoice(scenario, state, optionId);
  }
  return state;
}
