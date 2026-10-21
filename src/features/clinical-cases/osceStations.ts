// Station bank and deterministic rubric scoring for the Virtual Patient OSCE.
// Stations simulate an OSCE flow with guided choices: history questions are
// picked from a menu (each reveals the scripted answer), examination steps
// reveal scripted findings, communication moments offer graded responses,
// and the station closes with a working diagnosis and next step. The rubric
// is fixed data; nothing here is judged by a model. All patients are
// fictional teaching cases.

import { proportionalPoints, summarizeScore } from './engine';
import type { ScorePart, ScoreSummary } from './engine';

export interface OsceHistoryOption {
  id: string;
  label: string;
  /** Scripted answer revealed when the candidate asks this question. */
  answer: string;
  /** Key history points carry rubric weight. */
  key: boolean;
  domain: string;
}

export interface OsceExamOption {
  id: string;
  label: string;
  result: string;
  key: boolean;
}

export interface OsceCommOption {
  id: string;
  text: string;
  score: 0 | 1 | 2;
  feedback: string;
}

export interface OsceCommPrompt {
  id: string;
  prompt: string;
  options: OsceCommOption[];
}

export interface OsceStation {
  id: string;
  title: string;
  setting: string;
  candidateInstructions: string;
  timeLimitSeconds: number;
  historyOptions: OsceHistoryOption[];
  examOptions: OsceExamOption[];
  commPrompts: OsceCommPrompt[];
  diagnosisOptions: { id: string; label: string }[];
  keyDiagnosisId: string;
  nextStepOptions: { id: string; label: string }[];
  keyNextStepIds: string[];
  closingNote: string;
}

export interface OsceAttempt {
  askedIds: string[];
  examIds: string[];
  commChoices: Record<string, string>;
  diagnosisId: string | null;
  nextStepIds: string[];
}

export const OSCE_STATIONS: OsceStation[] = [
  {
    id: 'drooping-face-spouse',
    title: 'Station 1: The drooping face',
    setting:
      'Emergency department, relatives room. The historian is Mr. Hartono, husband of a 69 year old woman who developed a facial droop and right arm weakness 90 minutes ago. She is with the imaging team. You interview him.',
    candidateInstructions:
      'Take a focused history from the husband. Then choose your examination priorities, respond to him at the marked moments, and close with a working diagnosis and next step. You have 8 minutes.',
    timeLimitSeconds: 480,
    historyOptions: [
      {
        id: 'onset',
        label: 'When exactly was she last seen completely normal?',
        answer:
          '"She was fine at breakfast, talking normally at about half past eight. At five past nine she could not lift her cup and her mouth looked twisted."',
        key: true,
        domain: 'Onset and last known well',
      },
      {
        id: 'symptom-course',
        label: 'Did the symptoms come on suddenly or build up slowly?',
        answer: '"Suddenly. One minute she was fine, the next the cup dropped."',
        key: true,
        domain: 'Tempo of onset',
      },
      {
        id: 'anticoagulant',
        label: 'Does she take any blood thinning medicine?',
        answer: '"Yes, a tablet for her irregular heartbeat. Apixaban, twice a day. She took it this morning."',
        key: true,
        domain: 'Anticoagulation status',
      },
      {
        id: 'allergies',
        label: 'Any allergies, especially to medicines or contrast dye?',
        answer: '"Penicillin gives her a rash. Nothing else that I know of."',
        key: true,
        domain: 'Allergies',
      },
      {
        id: 'glucose-diabetes',
        label: 'Does she have diabetes, and when did she last eat?',
        answer: '"No diabetes. She ate breakfast normally at eight."',
        key: true,
        domain: 'Metabolic context',
      },
      {
        id: 'recent-surgery',
        label: 'Any recent surgery, bleeding, or head injury?',
        answer: '"No, nothing like that. She had a flu jab last week, that is all."',
        key: true,
        domain: 'Bleeding and contraindication screen',
      },
      {
        id: 'prior-stroke',
        label: 'Has she had a stroke or similar episode before?',
        answer: '"Never a stroke. Her heart has been irregular for years though."',
        key: false,
        domain: 'Past history',
      },
      {
        id: 'handedness',
        label: 'Is she right or left handed?',
        answer: '"Right handed, always has been."',
        key: false,
        domain: 'Background',
      },
      {
        id: 'holiday',
        label: 'Have you been on holiday recently?',
        answer: '"We went to see our daughter last month. Why, does that matter?"',
        key: false,
        domain: 'Background',
      },
      {
        id: 'witness-weakness',
        label: 'Which side is weak, and can she speak and understand?',
        answer:
          '"Her right arm and the right side of her face. She understands me but her words come out slurred."',
        key: true,
        domain: 'Deficit description',
      },
    ],
    examOptions: [
      {
        id: 'glucose',
        label: 'Capillary blood glucose',
        result: '112 mg/dL (6.2 mmol/L).',
        key: true,
      },
      {
        id: 'vitals-ecg',
        label: 'Vital signs and ECG',
        result: 'BP 172/94, pulse irregular at 108. ECG confirms atrial fibrillation.',
        key: true,
      },
      {
        id: 'nihss',
        label: 'Focused neurological examination (NIHSS style)',
        result: 'Right facial droop, right arm drift to plegia, moderate dysarthria, no aphasia. Estimated NIHSS 9.',
        key: true,
      },
      {
        id: 'ct-order',
        label: 'Confirm the non-contrast CT head request is in',
        result: 'CT requested at triage and the scanner is ready now.',
        key: true,
      },
      {
        id: 'fundoscopy',
        label: 'Fundoscopy',
        result: 'Difficult view, no clear abnormality.',
        key: false,
      },
      {
        id: 'reflexes-full',
        label: 'Full tendon reflex survey of all limbs',
        result: 'Brisk right reflexes, others normal.',
        key: false,
      },
    ],
    commPrompts: [
      {
        id: 'opening',
        prompt:
          'Mr. Hartono is gripping the chair and repeats: "Is she going to die? Please tell me she is not going to die." Choose your response.',
        options: [
          {
            id: 'opening-empathic',
            text: 'I can see how frightening this is. I cannot promise an outcome, but she is in the right place, the team is scanning her brain right now, and I will update you the moment we know more.',
            score: 2,
            feedback:
              'Acknowledges the fear, is honest about uncertainty, and gives a concrete commitment to update. That combination is what a frightened relative can actually hold on to.',
          },
          {
            id: 'opening-reassure',
            text: 'Please stay calm, most people with this survive, she will probably be fine.',
            score: 0,
            feedback:
              'False reassurance. It promises something nobody knows yet and relatives remember it word for word when the outcome differs.',
          },
          {
            id: 'opening-technical',
            text: 'We need to establish whether this is an ischemic event within the thrombolysis window before we discuss prognosis.',
            score: 1,
            feedback:
              'Accurate but cold and full of jargon. The information matters later; the first response has to meet the emotion in the room.',
          },
        ],
      },
      {
        id: 'consent-explain',
        prompt:
          'He asks: "What are you going to do to her now?" Choose how you explain the immediate plan.',
        options: [
          {
            id: 'explain-plain',
            text: 'First a scan of her brain, which takes a few minutes. The scan shows whether this is a blockage or a bleed, and that decides the treatment. Some treatments only work in the first few hours, which is why we are moving fast.',
            score: 2,
            feedback:
              'Plain language, correct sequence, and it explains the urgency instead of just announcing it. A relative who understands the clock becomes a partner in it.',
          },
          {
            id: 'explain-vague',
            text: 'We are running some tests and the doctors will decide after that.',
            score: 1,
            feedback: 'Not wrong, but it wastes a chance to build understanding and consent for time critical steps.',
          },
          {
            id: 'explain-overpromise',
            text: 'We will give her the clot busting drug right away and she should recover.',
            score: 0,
            feedback:
              'Treatment is promised before imaging, and recovery is promised outright. Both are things no one can know yet, and the anticoagulant history makes the promise unsafe as well.',
          },
        ],
      },
      {
        id: 'closing-spouse',
        prompt: 'The interview is ending. Choose your closing line to Mr. Hartono.',
        options: [
          {
            id: 'closing-open',
            text: 'Before I go: what is worrying you most right now, and is there anyone you would like me to call for you?',
            score: 2,
            feedback:
              'An open closing question plus practical help. It surfaces the real concern and leaves the relative with agency instead of helplessness.',
          },
          {
            id: 'closing-abrupt',
            text: 'That is all I need, thank you, please wait here.',
            score: 0,
            feedback: 'Abrupt. The relative is left alone with the worst thoughts and no idea what happens next.',
          },
          {
            id: 'closing-partial',
            text: 'Thank you, that was very helpful. The team will come and find you when the scan is done.',
            score: 1,
            feedback: 'Polite and gives a next step, but never asks what he is most afraid of.',
          },
        ],
      },
    ],
    diagnosisOptions: [
      { id: 'ischemic-af', label: 'Acute ischemic stroke, likely cardioembolic from atrial fibrillation' },
      { id: 'hemorrhage', label: 'Intracerebral hemorrhage' },
      { id: 'hypoglycemia', label: 'Hypoglycemia' },
      { id: 'bell', label: 'Bell palsy' },
    ],
    keyDiagnosisId: 'ischemic-af',
    nextStepOptions: [
      { id: 'ct-now', label: 'Immediate non-contrast CT head, then reperfusion assessment' },
      { id: 'observe', label: 'Observe for two hours and repeat the examination' },
      { id: 'mri-tomorrow', label: 'Book an outpatient MRI for tomorrow' },
      { id: 'discharge', label: 'Discharge home with GP follow up' },
    ],
    keyNextStepIds: ['ct-now'],
    closingNote:
      'The husband held every time critical fact: last known well at 08:35, sudden onset, apixaban taken this morning, penicillin allergy. Stations reward the candidate who asks for those four before anything decorative.',
  },
  {
    id: 'aphasia-yes-no',
    title: 'Station 2: Talking with aphasia',
    setting:
      'Stroke unit, day 2. Mr. Beno, 63, has an expressive (Broca) aphasia after a left MCA stroke. He understands well but produces only a few words. The task is communication, not diagnosis.',
    candidateInstructions:
      'Communicate with Mr. Beno about his night, his pain, and his worries. Choose your questions from the menu, select examination items that are appropriate today, respond at the marked moments, and close with a summary and next step. You have 8 minutes.',
    timeLimitSeconds: 480,
    historyOptions: [
      {
        id: 'yesno-pain',
        label: 'Use a yes or no question: "Do you have pain anywhere?"',
        answer: 'He nods, then points firmly at his right shoulder.',
        key: true,
        domain: 'Closed questions the patient can answer',
      },
      {
        id: 'gesture-sleep',
        label: 'Mime sleeping, then ask: "Did you sleep well?"',
        answer: 'He shakes his head and holds up three fingers, then mimes waking.',
        key: true,
        domain: 'Gesture supported communication',
      },
      {
        id: 'open-ended-day',
        label: 'Ask an open question: "Tell me everything about how your day went yesterday."',
        answer: 'He tries, produces "I... the... no...", becomes frustrated and turns away.',
        key: false,
        domain: 'Question design',
      },
      {
        id: 'writing-board',
        label: 'Offer the letter and picture board and ask him to point to what he needs',
        answer: 'He points to the water cup picture, then to the toilet picture, and smiles with relief.',
        key: true,
        domain: 'Communication aids',
      },
      {
        id: 'family-phone',
        label: 'Ask: "Shall I call your wife so she can explain what you need?"',
        answer: 'He shakes his head hard and points at himself, clearly wanting to communicate directly.',
        key: false,
        domain: 'Autonomy',
      },
      {
        id: 'check-understanding',
        label: 'After his answers, repeat back what you understood and ask him to confirm',
        answer: 'He nods with visible relief when your summary matches, and corrects one point by pointing.',
        key: true,
        domain: 'Verification of understanding',
      },
      {
        id: 'swallow-ask',
        label: 'Ask about swallowing with a demonstration: "Does drinking feel safe, like this?"',
        answer: 'He coughs when miming a swallow and points at his throat, looking worried.',
        key: true,
        domain: 'Safety relevant communication',
      },
      {
        id: 'rapid-fire',
        label: 'Ask three quick questions in one sentence to save time',
        answer: 'He stares, unable to separate the questions, and answers none of them.',
        key: false,
        domain: 'Question design',
      },
    ],
    examOptions: [
      {
        id: 'shoulder-exam',
        label: 'Examine the painful right shoulder gently',
        result: 'Subluxation suspected: a gap under the acromion, pain on passive movement. The weak arm has been unsupported in bed.',
        key: true,
      },
      {
        id: 'swallow-screen',
        label: 'Check his swallow screening status before any oral intake',
        result: 'Chart shows swallow screen not yet done today; he is still nil by mouth pending assessment.',
        key: true,
      },
      {
        id: 'tone-check',
        label: 'Assess tone and range in the weak arm',
        result: 'Flaccid tone, full passive range with pain at the shoulder only.',
        key: true,
      },
      {
        id: 'repeat-ct',
        label: 'Request a repeat CT head to check his progress',
        result: 'No new signs to justify it; yesterday scan is unchanged and he is stable.',
        key: false,
      },
      {
        id: 'bloods-full',
        label: 'Take a full set of bloods including rare antibodies',
        result: 'Bloods from this morning are all back and normal.',
        key: false,
      },
    ],
    commPrompts: [
      {
        id: 'frustration',
        prompt:
          'Midway, Mr. Beno slams the table softly with his good hand and tears up after failing to say a word he clearly knows. Choose your response.',
        options: [
          {
            id: 'frustration-pause',
            text: 'Slow down, make eye contact, and say: "I can see the word is there and it will not come out. That is the stroke, not you. Take your time, I am not in a hurry," then offer the picture board again.',
            score: 2,
            feedback:
              'Names the emotion, separates the person from the deficit, removes time pressure, and immediately offers a working alternative channel. This is supported conversation in one move.',
          },
          {
            id: 'frustration-guess',
            text: 'Quickly guess the word for him and move on to the next question to spare him the struggle.',
            score: 1,
            feedback:
              'Well meant, and sometimes a guess helps, but finishing his sentences by default teaches him that his attempts are too slow to matter.',
          },
          {
            id: 'frustration-ignore',
            text: 'Ignore the outburst and continue with the next question on your list.',
            score: 0,
            feedback: 'Ignoring visible distress in a man who cannot protest verbally is the one response he cannot recover from.',
          },
        ],
      },
      {
        id: 'bad-news-style',
        prompt:
          'You need to tell him the swallow screen means no drinking until the assessment. Choose how.',
        options: [
          {
            id: 'swallow-plain',
            text: 'Use short phrases with gesture: "Water... not yet. First, a test... so water goes the right way." Then show him the nil by mouth sign and ask him to point to show he understood.',
            score: 2,
            feedback:
              'Short chunks, gesture support, a reason, and a comprehension check he can answer. Safety information delivered in a form he can actually receive.',
          },
          {
            id: 'swallow-technical',
            text: 'Explain that his dysphagia creates aspiration risk and he must remain nil by mouth pending formal speech and language therapy assessment.',
            score: 0,
            feedback:
              'Accurate and completely inaccessible. Long clauses and jargon give him almost nothing to hold on to.',
          },
          {
            id: 'swallow-written',
            text: 'Write the full explanation on paper in sentences and hand it to him.',
            score: 1,
            feedback:
              'Writing helps some patients, but his reading is also impaired after this stroke, and there is no check that he understood.',
          },
        ],
      },
    ],
    diagnosisOptions: [
      { id: 'remain-aphasia-care', label: 'Ongoing expressive aphasia care: communication support, shoulder protection, swallow safety' },
      { id: 'new-stroke', label: 'A second new stroke has occurred today' },
      { id: 'depression-only', label: 'His only problem is low mood' },
      { id: 'noncompliant', label: 'He is not cooperating with the team' },
    ],
    keyDiagnosisId: 'remain-aphasia-care',
    nextStepOptions: [
      { id: 'slp-physio', label: 'Speech therapy communication plan plus physiotherapy shoulder support and positioning' },
      { id: 'sedate', label: 'Sedate him so he rests quietly' },
      { id: 'discharge-now', label: 'Discharge today without a communication plan' },
      { id: 'family-speaks', label: 'Ask the family to answer all questions for him from now on' },
    ],
    keyNextStepIds: ['slp-physio'],
    closingNote:
      'This station is scored on respect for a mind that understands far more than it can say. Closed questions, gesture, aids, and verification are the skills; talking over him is the failure mode.',
  },
  {
    id: 'wake-up-window',
    title: 'Station 3: The wake-up stroke',
    setting:
      'Emergency department. Mrs. Sari, 77, woke at 06:30 with a dense left hemiparesis and slurred speech. Her son, who lives with her, is your historian. The reperfusion decision depends on times only he can give.',
    candidateInstructions:
      'Establish the timeline from the son, choose examination priorities, respond at the marked moments, then close with the working summary and the single most important next step. You have 8 minutes.',
    timeLimitSeconds: 480,
    historyOptions: [
      {
        id: 'lkw-evening',
        label: 'When was she last seen completely normal?',
        answer: '"She phoned me from her room at 22:40, totally normal, then went to sleep. I found her at 06:30 like this."',
        key: true,
        domain: 'Last known well',
      },
      {
        id: 'night-wakings',
        label: 'Did she wake at all during the night, and was she normal then?',
        answer: '"She got up to the bathroom around 03:00. I heard her, she walked fine and spoke to me normally."',
        key: true,
        domain: 'Refining the onset window',
      },
      {
        id: 'found-state',
        label: 'Describe exactly how she was when you found her',
        answer: '"Left side completely floppy, face drooping on the left, speech slurred but I could understand her."',
        key: true,
        domain: 'Deficit at discovery',
      },
      {
        id: 'anticoag-prior',
        label: 'Her regular medicines, especially blood thinners?',
        answer: '"Blood pressure tablets and a statin. No blood thinner. She refused the heart tracing test last year."',
        key: true,
        domain: 'Medication and risk screen',
      },
      {
        id: 'baseline-function',
        label: 'What could she do for herself before today?',
        answer: '"Fully independent. She cooks, shops, walks to the market alone."',
        key: true,
        domain: 'Baseline function',
      },
      {
        id: 'recent-illness',
        label: 'Any recent illness, falls, or procedures?',
        answer: '"Nothing. She was gardening yesterday."',
        key: false,
        domain: 'Background',
      },
      {
        id: 'sons-job',
        label: 'Ask the son what he does for a living',
        answer: '"I drive a delivery van. Is that important right now?"',
        key: false,
        domain: 'Background',
      },
      {
        id: 'sleep-apnea',
        label: 'Does she snore heavily or stop breathing in her sleep?',
        answer: '"She snores, yes. Nobody ever checked it."',
        key: false,
        domain: 'Background',
      },
    ],
    examOptions: [
      {
        id: 'ct-cta',
        label: 'Urgent CT and CT angiography head and neck',
        result:
          'CT: no hemorrhage. CTA: right M1 occlusion. ASPECTS 8. MRI, if instant, would be needed to prove tissue time; the working window rests on the 03:00 normal check.',
        key: true,
      },
      {
        id: 'glucose-first',
        label: 'Capillary glucose before imaging',
        result: '124 mg/dL (6.9 mmol/L).',
        key: true,
      },
      {
        id: 'nihss-base',
        label: 'NIHSS and baseline disability (modified Rankin) documentation',
        result: 'NIHSS 14. Pre-stroke modified Rankin 0 by the son account.',
        key: true,
      },
      {
        id: 'echo-first',
        label: 'Bedside echocardiogram before CT',
        result: 'Available, but it would delay imaging by 25 minutes.',
        key: false,
      },
      {
        id: 'lumbar',
        label: 'Lumbar puncture to exclude infection',
        result: 'No fever, no neck stiffness, no indication.',
        key: false,
      },
    ],
    commPrompts: [
      {
        id: 'son-guilt',
        prompt:
          'The son says: "If only I had checked on her in the night, maybe this would not have happened." Choose your response.',
        options: [
          {
            id: 'guilt-answer',
            text: 'What you did this morning is exactly what mattered: you found her, you noted the times, and you called immediately. In fact, remembering that she was normal at 03:00 may open a treatment window for her that many patients do not get.',
            score: 2,
            feedback:
              'It answers the guilt with facts, and it shows him the real value of his 03:00 memory: it narrows the onset window and can change eligibility. Relatives remember being told their information mattered.',
          },
          {
            id: 'guilt-dismiss',
            text: 'Do not blame yourself, these things happen.',
            score: 1,
            feedback: 'Kind, but empty. It does not tell him that his timeline is clinically valuable, and guilt usually survives vague comfort.',
          },
          {
            id: 'guilt-agree',
            text: 'Yes, earlier detection is always better in stroke.',
            score: 0,
            feedback: 'True in the abstract and cruel in the room. It confirms a frightened son worst belief about himself and adds nothing clinical.',
          },
        ],
      },
      {
        id: 'window-explain',
        prompt:
          'He asks: "But she went to bed healthy. How can you still treat it if nobody knows when it started?" Choose your explanation.',
        options: [
          {
            id: 'window-plain',
            text: 'Because you heard her normal at 03:00, we treat that as the latest possible start. Scans of the brain tissue then tell us whether treatment can still help. Your memory of that bathroom trip is a real part of her treatment decision.',
            score: 2,
            feedback:
              'It explains last known well in plain words and ties it to imaging based selection, which is the actual logic of wake-up stroke care.',
          },
          {
            id: 'window-vague',
            text: 'Sometimes we can still treat wake-up strokes, the specialists will decide.',
            score: 1,
            feedback: 'Defers everything to specialists and leaves his genuine question unanswered.',
          },
          {
            id: 'window-no',
            text: 'Unfortunately, if onset is unknown, no acute treatment is possible.',
            score: 0,
            feedback:
              'Factually wrong in the era of imaging selected wake-up stroke treatment, and it discards the 03:00 information he just gave.',
          },
        ],
      },
    ],
    diagnosisOptions: [
      { id: 'wake-ischemic', label: 'Wake-up ischemic stroke, right M1 occlusion, onset window bounded by the 03:00 normal check' },
      { id: 'tia-resolved', label: 'Transient ischemic attack that has resolved' },
      { id: 'conversion', label: 'Functional weakness from stress' },
      { id: 'hypoglycemia-wake', label: 'Nocturnal hypoglycemia' },
    ],
    keyDiagnosisId: 'wake-ischemic',
    nextStepOptions: [
      { id: 'reperfusion-assess', label: 'Immediate reperfusion assessment: thrombectomy pathway with imaging based selection' },
      { id: 'wait-morning', label: 'Wait until morning rounds to reassess' },
      { id: 'oral-aspirin-only', label: 'Give aspirin and admit to a general ward without further imaging' },
      { id: 'sedation-rest', label: 'Sedate and let her sleep it off' },
    ],
    keyNextStepIds: ['reperfusion-assess'],
    closingNote:
      'The whole station turns on one sentence: "She was normal at 03:00." Candidates who chase that detail convert an unknown onset into a bounded window; candidates who skip it are left with a case they cannot treat.',
  },
];

export function getOsceStation(id: string): OsceStation | undefined {
  return OSCE_STATIONS.find((s) => s.id === id);
}

/**
 * Deterministic OSCE rubric.
 * Parts: history checklist 40, examination checklist 20, communication 25,
 * closing summary (diagnosis plus next step) 15.
 */
export function scoreOsceStation(station: OsceStation, attempt: OsceAttempt): ScoreSummary {
  const parts: ScorePart[] = [];

  const keyHistory = station.historyOptions.filter((o) => o.key);
  const askedKey = keyHistory.filter((o) => attempt.askedIds.includes(o.id));
  parts.push({
    id: 'history',
    label: 'History checklist',
    earned: proportionalPoints(askedKey.length, keyHistory.length, 40),
    max: 40,
    note:
      askedKey.length === keyHistory.length
        ? 'Every key history point was covered.'
        : `Covered ${askedKey.length} of ${keyHistory.length} key points. Missed: ${keyHistory
            .filter((o) => !attempt.askedIds.includes(o.id))
            .map((o) => o.domain)
            .join('; ')}.`,
  });

  const keyExam = station.examOptions.filter((o) => o.key);
  const doneKey = keyExam.filter((o) => attempt.examIds.includes(o.id));
  parts.push({
    id: 'examination',
    label: 'Examination priorities',
    earned: proportionalPoints(doneKey.length, keyExam.length, 20),
    max: 20,
    note:
      doneKey.length === keyExam.length
        ? 'All priority examinations were selected.'
        : `Selected ${doneKey.length} of ${keyExam.length} priority items. Missed: ${keyExam
            .filter((o) => !attempt.examIds.includes(o.id))
            .map((o) => o.label)
            .join('; ')}.`,
  });

  const commMax = station.commPrompts.length * 2;
  let commEarned = 0;
  for (const prompt of station.commPrompts) {
    const chosen = prompt.options.find((o) => o.id === attempt.commChoices[prompt.id]);
    if (chosen) commEarned += chosen.score;
  }
  parts.push({
    id: 'communication',
    label: 'Communication rubric',
    earned: proportionalPoints(commEarned, commMax, 25),
    max: 25,
    note: 'Graded from the fixed rubric on each marked communication moment.',
  });

  const diagnosisOk = attempt.diagnosisId === station.keyDiagnosisId;
  const stepsOk = station.keyNextStepIds.filter((id) => attempt.nextStepIds.includes(id)).length;
  parts.push({
    id: 'summary',
    label: 'Working summary and next step',
    earned:
      (diagnosisOk ? 8 : 0) + proportionalPoints(stepsOk, station.keyNextStepIds.length, 7),
    max: 15,
    note: diagnosisOk
      ? 'Working diagnosis matches the station key.'
      : 'Working diagnosis does not match the station key. Read the closing note for the reasoning.',
  });

  return summarizeScore(parts);
}
