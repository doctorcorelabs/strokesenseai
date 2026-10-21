// Training data and scoring guidance for the Speech-to-NIHSS Language
// Item Assistant.
//
// Every case here is fictional and written for this project. The reference
// score of each case was fixed by the case author when the case was
// written; it is never computed, inferred, or adjusted by any model. The
// reading cards and object names are paraphrased practice material, not
// reproductions of licensed NIHSS test materials. This is a study tool:
// nothing here produces an official clinical score.

export type NihssScore = 0 | 1 | 2 | 3;

export interface ScoreAnchor {
  score: NihssScore;
  label: string;
  /** Plain-language paraphrase of the anchor idea, for study only. */
  description: string;
}

/**
 * Educational paraphrase of the language item anchors. Students use these
 * to reason about a simulated performance; they are study notes, not the
 * official scale text.
 */
export const LANGUAGE_SCORE_ANCHORS: ScoreAnchor[] = [
  {
    score: 0,
    label: 'No aphasia',
    description:
      'Language works normally in the simulation: fluent conversation, objects named correctly, sentences read accurately, commands followed.',
  },
  {
    score: 1,
    label: 'Mild to moderate aphasia',
    description:
      'Some language loss is obvious, for example word-finding pauses or occasional wrong words, but the listener still follows the main ideas without reconstructing them.',
  },
  {
    score: 2,
    label: 'Severe aphasia',
    description:
      'Conversation is fragmentary. The listener has to question, guess, and piece meaning together, and expression is limited to short fragments.',
  },
  {
    score: 3,
    label: 'Mute or global aphasia',
    description:
      'No usable speech or understanding in the simulation: no meaningful words are produced, or language is not responded to at all.',
  },
];

/** The anchor entry for one score value. */
export function anchorFor(score: NihssScore): ScoreAnchor {
  return LANGUAGE_SCORE_ANCHORS[score];
}

export interface NamingItem {
  /** What the student shows or describes to the simulated patient. */
  prompt: string;
  /** What the simulated patient answers. Fixed by the case author. */
  patientResponse: string;
}

export interface NihssCase {
  id: string;
  title: string;
  /** Short fictional vignette shown before the tasks start. */
  vignette: string;
  naming: NamingItem[];
  /** Sentence card the student reads aloud to administer the reading task. */
  readingCard: string;
  /** What the simulated patient produces when asked to read the card. */
  readingPatientTranscript: string;
  conversationPrompt: string;
  conversationPatientResponse: string;
  /** Fixed by the case author. Never derived from the student's input. */
  referenceScore: NihssScore;
  /** Why the author set that reference score. Revealed only after scoring. */
  authorRationale: string;
}

export const NIHSS_CASES: NihssCase[] = [
  {
    id: 'case-rani',
    title: 'Case 1: Rani, 45 (training simulation)',
    vignette:
      'Rani is a fictional patient in a teaching ward round, one day after a small left-sided stroke. She is alert, friendly, and eager to talk. Run the three language tasks and judge only the language you observe.',
    naming: [
      { prompt: 'A metal object that opens a door lock', patientResponse: 'Key.' },
      { prompt: 'Something you wear on your hand in cold weather', patientResponse: 'A glove.' },
      { prompt: 'A tool used to drive in nails', patientResponse: 'Hammer.' },
      { prompt: 'Something soft from a bird that floats in the air', patientResponse: 'Feather.' },
      { prompt: 'A small seat without a back or arms', patientResponse: 'A stool.' },
    ],
    readingCard: 'The early train leaves the station before the sun is fully up.',
    readingPatientTranscript: 'The early train leaves the station before the sun is fully up.',
    conversationPrompt: 'Tell me what you did this morning before I came in.',
    conversationPatientResponse:
      'I woke up early, the nurse helped me sit up, and I had tea and porridge for breakfast. My husband is coming to visit this afternoon.',
    referenceScore: 0,
    authorRationale:
      'The author set 0 because every naming answer is correct, the reading card is reproduced word for word, and the conversation is fluent, complete, and easy to follow.',
  },
  {
    id: 'case-bambang',
    title: 'Case 2: Bambang, 68 (training simulation)',
    vignette:
      'Bambang is a fictional patient two days after a stroke affecting his language area. He understands most of what is said and tries hard, but words sometimes come out wrong or get stuck. Run the three language tasks.',
    naming: [
      { prompt: 'A metal object that opens a door lock', patientResponse: 'Key... yes, key.' },
      { prompt: 'Something you wear on your hand in cold weather', patientResponse: 'Glove.' },
      { prompt: 'A tool used to drive in nails', patientResponse: 'Hammer, the... the hitting thing, hammer.' },
      {
        prompt: 'Something soft from a bird that floats in the air',
        patientResponse: 'Fever... no, feather. Feather.',
      },
      { prompt: 'A small seat without a back or arms', patientResponse: 'Stool. A small chair, stool.' },
    ],
    readingCard: 'The early train leaves the station before the sun is fully up.',
    readingPatientTranscript: 'The early train leaves the station before the sun is... fully up.',
    conversationPrompt: 'Tell me what you did this morning before I came in.',
    conversationPatientResponse:
      'I... woke, then the nurse, she... helped me sit. I ate the... the porridge, a little. My son, he comes... later, I think.',
    referenceScore: 1,
    authorRationale:
      'The author set 1 because the language loss is obvious (word-finding pauses, one sound-based slip that he repairs himself), yet the listener follows every main idea without having to reconstruct the message.',
  },
  {
    id: 'case-sari',
    title: 'Case 3: Sari, 74 (training simulation)',
    vignette:
      'Sari is a fictional patient on the first day after a larger stroke. She is awake and tries to answer, but her speech comes out in short, effortful pieces and many words are wrong. Run the three language tasks and listen carefully.',
    naming: [
      { prompt: 'A metal object that opens a door lock', patientResponse: 'Door... thing. Lock thing.' },
      { prompt: 'Something you wear on your hand in cold weather', patientResponse: 'Hand... warm... no.' },
      { prompt: 'A tool used to drive in nails', patientResponse: 'Bang bang... that.' },
      {
        prompt: 'Something soft from a bird that floats in the air',
        patientResponse: 'Bird... fly... (shakes head)',
      },
      { prompt: 'A small seat without a back or arms', patientResponse: 'Sit... chair small.' },
    ],
    readingCard: 'The early train leaves the station before the sun is fully up.',
    readingPatientTranscript: 'The... train... sun... (stops, frustrated)',
    conversationPrompt: 'Tell me what you did this morning before I came in.',
    conversationPatientResponse: 'Morning... nurse... eat no... wife... (long pause) tired.',
    referenceScore: 2,
    authorRationale:
      'The author set 2 because conversation is fragmentary: most naming attempts miss or need heavy guessing, reading breaks down after a few words, and the listener must piece the meaning together from fragments.',
  },
  {
    id: 'case-tomo',
    title: 'Case 4: Tomo, 59 (training simulation)',
    vignette:
      'Tomo is a fictional patient a few hours after a major stroke. He is awake and looks at you, but his speech is fluent-sounding jargon without meaning, and he does not respond to simple requests. Run the three language tasks.',
    naming: [
      { prompt: 'A metal object that opens a door lock', patientResponse: 'Tavoo branna kel.' },
      { prompt: 'Something you wear on your hand in cold weather', patientResponse: 'Mana suta renno.' },
      { prompt: 'A tool used to drive in nails', patientResponse: 'Kello kello branna.' },
      {
        prompt: 'Something soft from a bird that floats in the air',
        patientResponse: 'Suta mana tavoo renno kel.',
      },
      { prompt: 'A small seat without a back or arms', patientResponse: 'Branna... (looks away)' },
    ],
    readingCard: 'The early train leaves the station before the sun is fully up.',
    readingPatientTranscript: '(Looks at the card, says) mana kel suta renno... (pushes the card away)',
    conversationPrompt: 'Tell me what you did this morning before I came in.',
    conversationPatientResponse:
      'Kel branna suta mana renno tavoo. Mana kel renno suta. (Smiles, seems unaware anything is wrong.)',
    referenceScore: 3,
    authorRationale:
      'The author set 3 because there is no usable language in either direction: naming and reading produce only jargon, conversation carries no meaning, and simple engagement through language does not get through.',
  },
];

/** One simulated case by id. */
export function getNihssCase(id: string): NihssCase | undefined {
  return NIHSS_CASES.find((entry) => entry.id === id);
}

export type ScoreVerdict = 'exact' | 'close' | 'far';

export interface ScoreEvaluation {
  verdict: ScoreVerdict;
  headline: string;
  detail: string;
}

/**
 * Compare the student's practice score with the author-fixed reference.
 * This only measures agreement with the case key; it never re-scores the
 * simulated patient.
 */
export function evaluateScore(studentScore: NihssScore, referenceScore: NihssScore): ScoreEvaluation {
  const difference = Math.abs(studentScore - referenceScore);
  if (difference === 0) {
    return {
      verdict: 'exact',
      headline: 'Your score matches the case key.',
      detail:
        'Agreement with the author key on a training case is a good sign, but the reasoning in your justification matters more than the number itself. Compare your justification with the anchor wording below.',
    };
  }
  if (difference === 1) {
    return {
      verdict: 'close',
      headline: 'Your score is one step away from the case key.',
      detail:
        studentScore < referenceScore
          ? 'You rated the language problem as milder than the author did. Re-read the anchor for the key score and check which observed errors you may have discounted, especially how much work the listener had to do.'
          : 'You rated the language problem as more severe than the author did. Re-read the anchor for the key score and check which preserved abilities you may have overlooked, especially how much meaning the listener still received.',
    };
  }
  return {
    verdict: 'far',
    headline: 'Your score is more than one step away from the case key.',
    detail:
      'A gap this large usually means one task dominated your judgement. Walk the three tasks again in order (naming, reading, conversation) and weigh them together against the anchors before your next attempt.',
  };
}

/**
 * Editable documentation draft for the student's training notes. It is
 * watermarked as simulation text and must never be pasted into a real
 * medical record.
 */
export function buildDocumentationDraft(
  nihssCase: NihssCase,
  studentScore: NihssScore,
  justification: string,
): string {
  const trimmed = justification.trim();
  return [
    'TRAINING SIMULATION NOTE - NOT A MEDICAL RECORD.',
    `Simulated case: ${nihssCase.title}. Language item practice.`,
    `Student score: ${studentScore} (${anchorFor(studentScore).label}). Case key: ${nihssCase.referenceScore} (${anchorFor(nihssCase.referenceScore).label}).`,
    trimmed ? `Student justification: ${trimmed}` : 'Student justification: (not provided)',
    'This draft was written for study feedback only and describes a fictional patient.',
  ].join('\n');
}
