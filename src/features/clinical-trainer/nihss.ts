// NIHSS Co-Pilot Trainer: case bank and deterministic scoring.
//
// TRAINING ONLY. Every patient here is fictional and written for practice.
// The item structure follows the official NIH Stroke Scale layout (15 scored
// entries, total 0 to 42) so learners rehearse the real instrument, but this
// module is not NIHSS certification, not an official scoring reference, and
// must never be used to assess a real patient.
//
// Scoring is fully deterministic: a case key is fixed in this file, and the
// comparison between the learner's scores and the key is simple arithmetic.
// No model output can change a key, a total, or a verdict.

export type NihssScore = number | 'UN';

export interface NihssItemOption {
  value: NihssScore;
  label: string;
  detail: string;
}

export interface NihssItem {
  id: string;
  name: string;
  instructions: string;
  trap: string;
  options: NihssItemOption[];
}

export interface NihssCaseFinding {
  itemId: string;
  finding: string;
  key: NihssScore;
  explanation: string;
}

export interface NihssCase {
  id: string;
  title: string;
  vignette: string;
  findings: NihssCaseFinding[];
}

/** The 15 scored NIHSS entries, in official order, with training anchors. */
export const NIHSS_ITEMS: NihssItem[] = [
  {
    id: '1a',
    name: '1a. Level of consciousness',
    instructions:
      'Judge the patient\'s responsiveness as you find it: alert, drowsy, stuporous, or comatose. Score what you see, even if lines or tubes get in the way.',
    trap: 'Do not average this item with 1b and 1c. A patient can be drowsy (1a = 1) yet still answer and obey perfectly once aroused.',
    options: [
      { value: 0, label: 'Alert', detail: 'Alert and keenly responsive.' },
      {
        value: 1,
        label: 'Not alert, arousable',
        detail: 'Not alert, but arousable by minor stimulation to obey, answer, or respond.',
      },
      {
        value: 2,
        label: 'Not alert, needs strong stimulation',
        detail:
          'Not alert; requires repeated stimulation to attend, or is obtunded and needs strong or painful stimulation to make movements that are not stereotyped.',
      },
      {
        value: 3,
        label: 'Coma',
        detail: 'Responds only with reflex motor or autonomic effects, or is totally unresponsive.',
      },
    ],
  },
  {
    id: '1b',
    name: '1b. LOC questions',
    instructions:
      'Ask the patient their age and the current month. Score only the first answer; no credit for a correct answer after repeated cueing.',
    trap: 'A patient who cannot speak because of severe aphasia scores 2 here, and dysarthria alone does not lower the score if the answer itself is right.',
    options: [
      { value: 0, label: 'Both correct', detail: 'Answers both questions correctly.' },
      { value: 1, label: 'One correct', detail: 'Answers one question correctly.' },
      { value: 2, label: 'Neither correct', detail: 'Answers neither question correctly.' },
    ],
  },
  {
    id: '1c',
    name: '1c. LOC commands',
    instructions:
      'Ask the patient to close and open the eyes, then to make a fist with the non-paretic hand. Credit one clear attempt even if weakness limits the result.',
    trap: 'Test the grip command with the non-paretic hand. Scoring the weak hand turns a language or arousal problem into a fake motor failure.',
    options: [
      { value: 0, label: 'Both performed', detail: 'Performs both tasks correctly.' },
      { value: 1, label: 'One performed', detail: 'Performs one task correctly.' },
      { value: 2, label: 'Neither performed', detail: 'Performs neither task correctly.' },
    ],
  },
  {
    id: '2',
    name: '2. Best gaze',
    instructions:
      'Test horizontal eye movements, voluntary or by following a target. In an unresponsive patient, use the oculocephalic maneuver.',
    trap: 'A partial palsy that the oculocephalic maneuver can overcome scores 1. Score 2 is reserved for a forced deviation that cannot be brought back to midline.',
    options: [
      { value: 0, label: 'Normal', detail: 'Normal horizontal gaze.' },
      {
        value: 1,
        label: 'Partial gaze palsy',
        detail:
          'Gaze is abnormal in one or both eyes, but the eyes can still be moved, voluntarily or reflexively, past the limit.',
      },
      {
        value: 2,
        label: 'Forced deviation',
        detail: 'Forced deviation, or total gaze paresis that the oculocephalic maneuver cannot overcome.',
      },
    ],
  },
  {
    id: '3',
    name: '3. Visual fields',
    instructions:
      'Test all four quadrants by confrontation. In a patient who cannot respond, use blink to visual threat from each side.',
    trap: 'Score the pattern the patient shows, not the lesion you expect. Loss of the full half field in both eyes is complete hemianopia (2), even when each eye was tested separately.',
    options: [
      { value: 0, label: 'No visual loss', detail: 'No visual field loss detected.' },
      { value: 1, label: 'Partial hemianopia', detail: 'Partial loss, such as a quadrantanopia or incomplete hemianopia.' },
      { value: 2, label: 'Complete hemianopia', detail: 'Complete loss of one half of the visual field in both eyes.' },
      {
        value: 3,
        label: 'Bilateral hemianopia',
        detail: 'Blind, including cortical blindness, or bilateral field loss.',
      },
    ],
  },
  {
    id: '4',
    name: '4. Facial palsy',
    instructions:
      'Ask the patient to show the teeth, raise the eyebrows, and close the eyes tightly. In a poorly responsive patient, watch the grimace to a painful stimulus.',
    trap: 'Score the amount of movement, not the cause. Total paralysis of the lower face scores 2 even when the forehead moves normally.',
    options: [
      { value: 0, label: 'Normal', detail: 'Normal symmetrical movement.' },
      {
        value: 1,
        label: 'Minor paralysis',
        detail: 'Minor paralysis: flattened nasolabial fold or asymmetry when smiling.',
      },
      {
        value: 2,
        label: 'Partial paralysis',
        detail: 'Partial paralysis: total or near-total paralysis of the lower face.',
      },
      {
        value: 3,
        label: 'Complete paralysis',
        detail: 'Complete paralysis of one or both sides: no movement in upper and lower face.',
      },
    ],
  },
  {
    id: '5a',
    name: '5a. Motor arm, left',
    instructions:
      'Position the arm at 90 degrees (sitting) or 45 degrees (supine), palm down, and ask the patient to hold it for 10 seconds. Score the first attempt.',
    trap: 'The line between 1 and 2 is the bed: a limb that drifts but never lands scores 1; a limb that falls to the bed despite effort scores 2.',
    options: [
      { value: 0, label: 'No drift', detail: 'Holds the position for the full 10 seconds.' },
      { value: 1, label: 'Drift', detail: 'Drifts down before 10 seconds but does not hit the bed or support.' },
      { value: 2, label: 'Some effort', detail: 'Some effort against gravity, but the limb falls to the bed.' },
      { value: 3, label: 'No effort', detail: 'No effort against gravity; the limb falls immediately.' },
      { value: 4, label: 'No movement', detail: 'No movement at all.' },
      { value: 'UN', label: 'Untestable', detail: 'Amputation or joint fusion.' },
    ],
  },
  {
    id: '5b',
    name: '5b. Motor arm, right',
    instructions:
      'Position the arm at 90 degrees (sitting) or 45 degrees (supine), palm down, and ask the patient to hold it for 10 seconds. Score the first attempt.',
    trap: 'Laterality mix-ups are the most common clerical error on this item. Confirm the side before you score.',
    options: [
      { value: 0, label: 'No drift', detail: 'Holds the position for the full 10 seconds.' },
      { value: 1, label: 'Drift', detail: 'Drifts down before 10 seconds but does not hit the bed or support.' },
      { value: 2, label: 'Some effort', detail: 'Some effort against gravity, but the limb falls to the bed.' },
      { value: 3, label: 'No effort', detail: 'No effort against gravity; the limb falls immediately.' },
      { value: 4, label: 'No movement', detail: 'No movement at all.' },
      { value: 'UN', label: 'Untestable', detail: 'Amputation or joint fusion.' },
    ],
  },
  {
    id: '6a',
    name: '6a. Motor leg, left',
    instructions:
      'Position the leg at 30 degrees and ask the patient to hold it for 5 seconds. The leg item uses 5 seconds, not the 10 seconds of the arm item.',
    trap: 'Do not count a drift that starts only after the 5 seconds are complete. The window is short on purpose.',
    options: [
      { value: 0, label: 'No drift', detail: 'Holds the position for the full 5 seconds.' },
      { value: 1, label: 'Drift', detail: 'Drifts down before 5 seconds but does not hit the bed.' },
      { value: 2, label: 'Some effort', detail: 'Some effort against gravity, but the leg falls to the bed.' },
      { value: 3, label: 'No effort', detail: 'No effort against gravity; the leg falls immediately.' },
      { value: 4, label: 'No movement', detail: 'No movement at all.' },
      { value: 'UN', label: 'Untestable', detail: 'Amputation or joint fusion.' },
    ],
  },
  {
    id: '6b',
    name: '6b. Motor leg, right',
    instructions:
      'Position the leg at 30 degrees and ask the patient to hold it for 5 seconds. The leg item uses 5 seconds, not the 10 seconds of the arm item.',
    trap: 'Score each leg on its own hold. Do not copy the arm score down to the leg item.',
    options: [
      { value: 0, label: 'No drift', detail: 'Holds the position for the full 5 seconds.' },
      { value: 1, label: 'Drift', detail: 'Drifts down before 5 seconds but does not hit the bed.' },
      { value: 2, label: 'Some effort', detail: 'Some effort against gravity, but the leg falls to the bed.' },
      { value: 3, label: 'No effort', detail: 'No effort against gravity; the leg falls immediately.' },
      { value: 4, label: 'No movement', detail: 'No movement at all.' },
      { value: 'UN', label: 'Untestable', detail: 'Amputation or joint fusion.' },
    ],
  },
  {
    id: '7',
    name: '7. Limb ataxia',
    instructions:
      'Test finger-to-nose and heel-to-shin on both sides, eyes open. Ataxia counts only when it is out of proportion to any weakness.',
    trap: 'Weakness is not ataxia. If paralysis or failure to understand explains the clumsiness, the score is 0, not a guess at coordination.',
    options: [
      { value: 0, label: 'Absent', detail: 'Ataxia absent, or the patient is paralyzed or cannot understand the task.' },
      { value: 1, label: 'One limb', detail: 'Ataxia present in one limb, out of proportion to weakness.' },
      { value: 2, label: 'Two limbs', detail: 'Ataxia present in two limbs, out of proportion to weakness.' },
      { value: 'UN', label: 'Untestable', detail: 'Amputation or joint fusion.' },
    ],
  },
  {
    id: '8',
    name: '8. Sensory',
    instructions:
      'Test pinprick sensation across the face, arms, trunk, and legs. In an obtunded patient, judge by grimace or a purposeful withdrawal.',
    trap: 'Score only the sensory loss that belongs to this stroke. A stocking-glove pattern from an old neuropathy is not this item\'s business.',
    options: [
      { value: 0, label: 'Normal', detail: 'Normal; no sensory loss.' },
      {
        value: 1,
        label: 'Mild to moderate loss',
        detail: 'The patient feels the pinprick as less sharp or dull on the affected side, but is aware of being touched.',
      },
      {
        value: 2,
        label: 'Severe to total loss',
        detail: 'The patient is not aware of being touched on the affected side, or shows no grimace to noxious stimulation.',
      },
    ],
  },
  {
    id: '9',
    name: '9. Best language',
    instructions:
      'Judge comprehension and expression from the whole encounter: describing a picture, naming objects, and reading sentences.',
    trap: 'Keep this item separate from dysarthria (item 10). Item 9 scores what the patient can express and understand; item 10 scores how clearly the speech sounds.',
    options: [
      { value: 0, label: 'No aphasia', detail: 'No aphasia; language is normal.' },
      {
        value: 1,
        label: 'Mild to moderate aphasia',
        detail:
          'Some loss of fluency or comprehension, but the patient still conveys ideas and the examiner can follow the exchange.',
      },
      {
        value: 2,
        label: 'Severe aphasia',
        detail:
          'Expression is fragmentary; communication happens through the listener\'s questions and inference, and the patient cannot identify the test materials correctly.',
      },
      { value: 3, label: 'Mute, global aphasia', detail: 'Mute, or no usable speech or auditory comprehension.' },
    ],
  },
  {
    id: '10',
    name: '10. Dysarthria',
    instructions:
      'Have the patient read or repeat a list of words. Judge articulation and intelligibility, not vocabulary or grammar.',
    trap: 'A mute patient scores 2 here, not untestable. UN is only for a physical barrier such as intubation.',
    options: [
      { value: 0, label: 'Normal', detail: 'Normal articulation.' },
      {
        value: 1,
        label: 'Mild to moderate',
        detail: 'Slurs at least some words; can be understood with some difficulty.',
      },
      {
        value: 2,
        label: 'Severe',
        detail: 'Speech is unintelligible, or the patient is mute or anarthric.',
      },
      { value: 'UN', label: 'Untestable', detail: 'Intubated or another physical barrier.' },
    ],
  },
  {
    id: '11',
    name: '11. Extinction and inattention',
    instructions:
      'Test single stimulation on each side, then double simultaneous stimulation, across the senses you can check, and look for personal neglect of one side of the body.',
    trap: 'Extinction (score 1) needs a specific pattern: single stimuli on the weak side are noticed, but simultaneous stimuli are not. Ignoring one side in more than one modality is profound hemi-inattention (2).',
    options: [
      { value: 0, label: 'No abnormality', detail: 'No inattention or extinction found.' },
      {
        value: 1,
        label: 'One modality',
        detail:
          'Visual, tactile, auditory, spatial, or personal inattention, or extinction to double simultaneous stimulation, in one modality only.',
      },
      {
        value: 2,
        label: 'Profound hemi-inattention',
        detail:
          'Profound hemi-inattention in more than one modality, or the patient does not recognize their own hand or orients only to one side.',
      },
    ],
  },
];

export function getNihssItem(itemId: string): NihssItem {
  const item = NIHSS_ITEMS.find((entry) => entry.id === itemId);
  if (!item) throw new Error(`Unknown NIHSS item: ${itemId}`);
  return item;
}

/** Numeric total: UN entries and unanswered entries contribute 0, and the result says so. */
export function nihssTotal(scores: Iterable<NihssScore | null | undefined>): number {
  let total = 0;
  for (const score of scores) {
    if (typeof score === 'number') total += score;
  }
  return total;
}

/** Standard descriptive band for a total, used as a training summary only. */
export function nihssBand(total: number): string {
  if (total <= 0) return 'No stroke symptoms on this scale';
  if (total <= 4) return 'Minor';
  if (total <= 15) return 'Moderate';
  if (total <= 20) return 'Moderate to severe';
  return 'Severe';
}

// ---------------------------------------------------------------------------
// Case bank. Fictional patients, written for this trainer.
// ---------------------------------------------------------------------------

function finding(itemId: string, text: string, key: NihssScore, explanation: string): NihssCaseFinding {
  return { itemId, finding: text, key, explanation };
}

export const NIHSS_CASES: NihssCase[] = [
  {
    id: 'case-a',
    title: 'Mrs. R, 68: right-sided weakness and speech loss',
    vignette:
      'A 68 year old woman is brought in 70 minutes after her husband saw her drop a cup and start speaking in single words. She is awake in the scanner corridor and the examination below is recorded item by item. Her face, arm, and leg findings are all on the right.',
    findings: [
      finding('1a', 'Awake, eyes open, responds promptly to voice.', 0, 'Alert and keenly responsive on first contact.'),
      finding(
        '1b',
        'Asked her age and the current month, she produces short effortful phrases and answers neither question correctly.',
        2,
        'Neither answer is correct. Aphasia does not excuse this item; it is scored on the answers actually given.',
      ),
      finding(
        '1c',
        'She closes and opens her eyes on command and squeezes twice with her left, non-paretic hand.',
        0,
        'Both tasks performed when the command is tested with the non-paretic hand.',
      ),
      finding('2', 'Her eyes move fully to both sides on command and track a moving target.', 0, 'Horizontal gaze is normal.'),
      finding(
        '3',
        'She does not detect fingers in the right visual field of either eye, in the upper or the lower quadrant. Left fields are intact.',
        2,
        'Loss of the full right half field in both eyes is a complete hemianopia.',
      ),
      finding(
        '4',
        'The right nasolabial fold is absent and the right lower face does not move when she tries to smile. The forehead wrinkles symmetrically.',
        2,
        'Total paralysis of the lower face is scored 2, partial paralysis. The item scores the amount of movement, not the forehead pattern.',
      ),
      finding('5a', 'She holds the left arm at 90 degrees for the full 10 seconds.', 0, 'No drift on the left.'),
      finding(
        '5b',
        'She raises the right arm off the bed with visible effort; it falls back to the bed within about 4 seconds despite her trying to hold it.',
        2,
        'Some effort against gravity, but the limb lands on the bed: score 2. A drift that never reaches the bed would be 1.',
      ),
      finding('6a', 'She holds the left leg at 30 degrees steadily for 5 seconds.', 0, 'No drift on the left.'),
      finding(
        '6b',
        'The right leg lifts briefly with effort and sinks back to the bed before the 5 seconds are up.',
        2,
        'Effort against gravity is present but the leg falls to the bed within the window.',
      ),
      finding(
        '7',
        'Finger-to-nose on the left is accurate. The weak right limbs cannot be tested meaningfully for coordination.',
        0,
        'Ataxia is scored only when out of proportion to weakness. Paralysis explains the right side, so the score is 0.',
      ),
      finding(
        '8',
        'Pinprick feels dull on the right arm and leg compared with the left, but she clearly registers every touch.',
        1,
        'She is aware of being touched but feels it as less sharp: mild to moderate loss.',
      ),
      finding(
        '9',
        'Speech is limited to single words and short phrases produced with great effort. She cannot name the pictured objects and follows only simple conversation.',
        2,
        'Severe aphasia: expression is fragmentary and the listener must infer meaning. She is not mute, so this is 2, not 3.',
      ),
      finding(
        '10',
        'The few words she does produce are slurred, but each word can be understood.',
        1,
        'Dysarthria is judged on the intelligibility of the speech that exists, separately from the aphasia.',
      ),
      finding('11', 'She notices touch on each side alone and on both sides at the same time.', 0, 'No extinction or inattention.'),
    ],
  },
  {
    id: 'case-b',
    title: 'Mr. T, 59: mild left-sided weakness',
    vignette:
      'A 59 year old man noticed his left hand fumbling with buttons this morning and his left leg feeling heavy. He walked into the department. His speech is fluent and he is fully alert.',
    findings: [
      finding('1a', 'Awake and fully responsive throughout the examination.', 0, 'Alert.'),
      finding('1b', 'He states his age and the current month correctly on the first attempt.', 0, 'Both answers correct.'),
      finding('1c', 'He performs both commands correctly on the first request.', 0, 'Both tasks performed.'),
      finding('2', 'Full eye movements in every direction.', 0, 'Gaze normal.'),
      finding('3', 'He detects finger movement in all four quadrants of both eyes.', 0, 'No field loss.'),
      finding(
        '4',
        'On smiling, the left nasolabial fold looks slightly flattened. Movement is present throughout the face.',
        1,
        'A flattened fold with movement preserved is minor paralysis.',
      ),
      finding(
        '5a',
        'The left arm drifts downward a few centimetres during the 10 seconds but never reaches the bed.',
        1,
        'Drift that does not land on the bed is score 1, the classic 1 versus 2 line.',
      ),
      finding('5b', 'The right arm is held steady for the full 10 seconds.', 0, 'No drift.'),
      finding(
        '6a',
        'The left leg drifts down before the 5 seconds are over but stays off the bed.',
        1,
        'Drift within the 5 second window without landing on the bed.',
      ),
      finding('6b', 'The right leg is held steady for the full 5 seconds.', 0, 'No drift.'),
      finding(
        '7',
        'Finger-to-nose and heel-to-shin are smooth on both sides, with no overshoot beyond what the mild weakness explains.',
        0,
        'No ataxia out of proportion to weakness.',
      ),
      finding(
        '8',
        'Pinprick feels slightly less sharp over the left arm and leg. He notices every stimulus.',
        1,
        'Aware of touch but dulled: mild to moderate loss.',
      ),
      finding('9', 'Fluent speech. He names every object and reads the sentences aloud correctly.', 0, 'No aphasia.'),
      finding('10', 'His speech is mildly slurred, but every word is easy to understand.', 1, 'Mild dysarthria with full intelligibility.'),
      finding('11', 'He detects single touch and double simultaneous touch on both sides.', 0, 'No extinction or inattention.'),
    ],
  },
  {
    id: 'case-c',
    title: 'Ms. L, 47: dizziness, unsteady gait, slurred speech',
    vignette:
      'A 47 year old woman presents with two hours of vertigo, vomiting, and an unsteady gait. Her strength is normal everywhere and her speech is slurred but fluent. She is fully alert.',
    findings: [
      finding('1a', 'Alert and responsive; she gives a clear history.', 0, 'Alert.'),
      finding('1b', 'She answers her age and the month correctly the first time.', 0, 'Both correct.'),
      finding('1c', 'She performs both commands correctly.', 0, 'Both performed.'),
      finding(
        '2',
        'She cannot move her eyes fully to the left on command. Turning her head reflexively (oculocephalic maneuver) brings the eyes further left than she can move them voluntarily.',
        1,
        'A gaze palsy that the oculocephalic maneuver can overcome is partial: score 1.',
      ),
      finding('3', 'She detects targets in all quadrants of both eyes.', 0, 'No field loss.'),
      finding('4', 'Facial movement is symmetric, including the forehead and both nasolabial folds.', 0, 'No facial palsy.'),
      finding('5a', 'She holds the left arm at 90 degrees for the full 10 seconds; strength is normal.', 0, 'No drift, full strength.'),
      finding('5b', 'She holds the right arm at 90 degrees for the full 10 seconds; strength is normal.', 0, 'No drift, full strength.'),
      finding('6a', 'She holds the left leg at 30 degrees for the full 5 seconds.', 0, 'No drift.'),
      finding('6b', 'She holds the right leg at 30 degrees for the full 5 seconds.', 0, 'No drift.'),
      finding(
        '7',
        'Finger-to-nose testing overshoots the target on the left, and heel-to-shin testing on the left leg is clumsy. Her strength is normal, so the clumsiness is out of proportion to any weakness.',
        2,
        'Ataxia in two limbs (left arm and left leg) with normal strength: score 2.',
      ),
      finding('8', 'Pinprick feels the same on both sides of the face, arms, and legs.', 0, 'No sensory loss.'),
      finding('9', 'Her language is intact: fluent, correct naming, normal comprehension.', 0, 'No aphasia. Slurred speech is scored on item 10, not here.'),
      finding(
        '10',
        'Her speech is slurred and scanning in rhythm, but she can be understood without difficulty.',
        1,
        'Mild to moderate dysarthria with preserved intelligibility.',
      ),
      finding('11', 'She detects single and double simultaneous stimuli on both sides.', 0, 'No extinction or inattention.'),
    ],
  },
  {
    id: 'case-d',
    title: 'Mr. S, 74: found unresponsive with left-sided paralysis',
    vignette:
      'A 74 year old man is found on the floor by his daughter and arrives drowsy and deteriorating. His deficits are on the left. Several items have to be judged from reflex responses because he cannot cooperate.',
    findings: [
      finding(
        '1a',
        'He opens his eyes only after a loud voice repeated several times plus a trapezius squeeze, and he does not stay awake.',
        2,
        'He needs repeated, strong stimulation to attend at all: score 2.',
      ),
      finding('1b', 'He makes no verbal answer to either question.', 2, 'Neither question answered correctly. Inability to answer scores 2 on this item.'),
      finding('1c', 'He performs neither the eye-closing command nor the hand command.', 2, 'Neither task performed.'),
      finding(
        '2',
        'Both eyes are deviated to the right and cannot be brought back past the midline, even when his head is turned.',
        2,
        'Forced deviation that the oculocephalic maneuver cannot overcome: score 2.',
      ),
      finding(
        '3',
        'He blinks to a threatening gesture approaching from the right side only. No blink is seen from the left, in either eye.',
        2,
        'Blink-to-threat testing in an obtunded patient shows loss of the full left half field in both eyes: complete hemianopia.',
      ),
      finding(
        '4',
        'The left lower face does not move at rest or on grimace; the left nasolabial fold is absent. Forehead movement is symmetric.',
        2,
        'Total paralysis of the lower face is partial paralysis, score 2, even with a moving forehead.',
      ),
      finding('5a', 'There is no movement of the left arm, even with painful stimulation.', 4, 'No movement at all.'),
      finding('5b', 'The right arm moves normally and holds position for 10 seconds when placed.', 0, 'Normal right arm.'),
      finding('6a', 'There is no movement of the left leg, even with painful stimulation.', 4, 'No movement at all.'),
      finding('6b', 'The right leg moves normally and holds position for 5 seconds when placed.', 0, 'Normal right leg.'),
      finding(
        '7',
        'Coordination cannot be assessed in the paralyzed left limbs. Testing on the right is smooth.',
        0,
        'Ataxia is not scored when paralysis explains the picture. Score 0, not untestable.',
      ),
      finding(
        '8',
        'Pinprick on the right produces a grimace. Pinprick anywhere on the left produces no grimace and no sign of awareness.',
        2,
        'In an obtunded patient, no awareness response on the affected side is severe to total sensory loss.',
      ),
      finding('9', 'He produces no sounds and no words, and shows no sign of understanding speech.', 3, 'Mute with no usable comprehension: global aphasia scoring.'),
      finding(
        '10',
        'There is no intelligible speech of any kind. He is not intubated.',
        2,
        'A mute patient scores 2 on dysarthria. UN is only for a physical barrier such as intubation.',
      ),
      finding(
        '11',
        'He responds only to voice and touch presented on his right side. Left-sided stimuli are ignored in every modality tried.',
        2,
        'Ignoring one side across more than one modality is profound hemi-inattention.',
      ),
    ],
  },
];

export function getNihssCase(caseId: string): NihssCase {
  const found = NIHSS_CASES.find((entry) => entry.id === caseId);
  if (!found) throw new Error(`Unknown NIHSS case: ${caseId}`);
  return found;
}

/** Key total for a case, computed from its findings. */
export function nihssCaseKeyTotal(kasus: NihssCase): number {
  return nihssTotal(kasus.findings.map((entry) => entry.key));
}

// ---------------------------------------------------------------------------
// Deterministic scoring of a learner's answers against a case key.
// ---------------------------------------------------------------------------

export type ItemStatus = 'exact' | 'close' | 'miss' | 'unanswered';

export interface ItemScoreResult {
  itemId: string;
  user: NihssScore | null;
  key: NihssScore;
  gap: number;
  status: ItemStatus;
  explanation: string;
}

export interface CaseScoreResult {
  items: ItemScoreResult[];
  userTotal: number;
  keyTotal: number;
  exactCount: number;
  answeredCount: number;
  userBand: string;
  keyBand: string;
  /** Item ids the learner should review, biggest gap first. */
  recommended: string[];
}

function gapBetween(user: NihssScore, key: NihssScore): number {
  if (typeof user === 'number' && typeof key === 'number') return Math.abs(user - key);
  if (user === key) return 0;
  // A UN answer against a numeric key (or the reverse) is a full miss on the
  // item, represented with a fixed gap of 2 so it sorts above close calls.
  return 2;
}

export function scoreNihssCase(
  kasus: NihssCase,
  answers: Record<string, NihssScore | null | undefined>,
): CaseScoreResult {
  const items: ItemScoreResult[] = kasus.findings.map((caseFinding) => {
    const raw = answers[caseFinding.itemId];
    const user: NihssScore | null = raw === undefined ? null : raw;
    if (user === null) {
      return {
        itemId: caseFinding.itemId,
        user,
        key: caseFinding.key,
        gap: 0,
        status: 'unanswered' as const,
        explanation: caseFinding.explanation,
      };
    }
    const gap = gapBetween(user, caseFinding.key);
    const status: ItemStatus = gap === 0 ? 'exact' : gap === 1 ? 'close' : 'miss';
    return {
      itemId: caseFinding.itemId,
      user,
      key: caseFinding.key,
      gap,
      status,
      explanation: caseFinding.explanation,
    };
  });
  const userTotal = nihssTotal(items.map((entry) => entry.user));
  const keyTotal = nihssCaseKeyTotal(kasus);
  const recommended = items
    .filter((entry) => entry.status === 'miss' || entry.status === 'close' || entry.status === 'unanswered')
    .sort((a, b) => b.gap - a.gap)
    .map((entry) => entry.itemId);
  return {
    items,
    userTotal,
    keyTotal,
    exactCount: items.filter((entry) => entry.status === 'exact').length,
    answeredCount: items.filter((entry) => entry.status !== 'unanswered').length,
    userBand: nihssBand(userTotal),
    keyBand: nihssBand(keyTotal),
    recommended,
  };
}

/** Every case finding for one item, for item-by-item drill mode. */
export interface ItemDrill {
  caseId: string;
  caseTitle: string;
  finding: string;
  key: NihssScore;
  explanation: string;
}

export function drillsForItem(itemId: string): ItemDrill[] {
  const drills: ItemDrill[] = [];
  for (const kasus of NIHSS_CASES) {
    const caseFinding = kasus.findings.find((entry) => entry.itemId === itemId);
    if (caseFinding) {
      drills.push({
        caseId: kasus.id,
        caseTitle: kasus.title,
        finding: caseFinding.finding,
        key: caseFinding.key,
        explanation: caseFinding.explanation,
      });
    }
  }
  return drills;
}
