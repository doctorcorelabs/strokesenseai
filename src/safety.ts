export const EMERGENCY_TEXT =
  'Possible stroke signs are a medical emergency. Call 119 in Indonesia now, or your local emergency service elsewhere. Do not wait for a chat response, even if symptoms disappear. Note when symptoms began or when the person was last known well. Follow the instructions of the dispatcher.';

// Homoglyph folding: common Cyrillic and Greek letters that look identical
// to Latin letters are folded back before matching, so an obfuscated
// keyword (a "face" written with a Cyrillic a) reads the same as plain text.
const HOMOGLYPH_RE =
  /[\u0430\u0435\u043E\u0440\u0441\u0445\u0443\u0456\u0458\u0455\u04BB\u0501\u03B1\u03BF\u03C1\u03B5\u03BA\u03BD\u03C4\u03C7\u0391\u0392\u0395\u0397\u0399\u039A\u039C\u039D\u039F\u03A1\u03A4\u03A7\u0396]/g;
const HOMOGLYPHS: Record<string, string> = {
  '\u0430': 'a',
  '\u0435': 'e',
  '\u043E': 'o',
  '\u0440': 'p',
  '\u0441': 'c',
  '\u0445': 'x',
  '\u0443': 'y',
  '\u0456': 'i',
  '\u0458': 'j',
  '\u0455': 's',
  '\u04BB': 'h',
  '\u0501': 'd',
  '\u03B1': 'a',
  '\u03BF': 'o',
  '\u03C1': 'p',
  '\u03B5': 'e',
  '\u03BA': 'k',
  '\u03BD': 'v',
  '\u03C4': 't',
  '\u03C7': 'x',
  '\u0391': 'A',
  '\u0392': 'B',
  '\u0395': 'E',
  '\u0397': 'H',
  '\u0399': 'I',
  '\u039A': 'K',
  '\u039C': 'M',
  '\u039D': 'N',
  '\u039F': 'O',
  '\u03A1': 'P',
  '\u03A4': 'T',
  '\u03A7': 'X',
  '\u0396': 'Z',
};

// Zero-width characters, soft hyphens, and bidirectional control marks
// break keyword matching when they land inside a symptom word, so they
// are removed outright.
const INVISIBLE_RE = /[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Hardened normalization, identical step for step to the Worker guard in
// worker/src/guard.ts: NFKC fold, invisible and BiDi control removal,
// homoglyph folding, whitespace collapse (so phrases split across lines
// cannot slip past), then rejoining of letter-spelled words (a run of
// four or more single-letter tokens becomes one word again).
export function normalizeText(message: string): string {
  const cleaned = message
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .replace(HOMOGLYPH_RE, (ch) => HOMOGLYPHS[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.replace(/\b(?:[A-Za-z] ){3,}[A-Za-z]\b/g, (run) => run.replace(/ /g, ''));
}

// Text pasted through a right-to-left override arrives with every word
// spelled backwards; the reversed spellings of the highest-risk symptom
// words are matched directly.
const REVERSED_SYMPTOM_RE = /(?:gnocnem|gnipoord|derruls|olep|gnolot)/i;

// A conservative reminder, not a clinically validated symptom classifier.
// It runs client-side before consent, before any network call, and mirrors
// the Worker guard pattern for pattern (parity is enforced by the shared
// regression lists in src/safety.test.ts and worker/test/guard.test.ts).
// Bias is deliberate: a false alarm costs a phone call, a miss can cost a
// treatment window.
const ACUTE_PATTERNS: RegExp[] = [
  // English: face
  /(?:face|facial).{0,20}(?:droop|weak)/i,
  /(?:mouth|lip).{0,20}(?:droop|drooping|hanging|uneven|weak)/i,
  /(?:cannot|can't|can not|unable to)\s+(?:smile|see|move\s+(?:my\s+|the\s+|his\s+|her\s+|their\s+)?(?:left\s+|right\s+)?(?:face|arm|leg|hand))/i,
  // English: vision loss and numbness in either word order
  /(?:cannot|can't|can not)\s+see|vision\s+(?:loss|blurred|gone)|blurred\s+vision|double\s+vision|lost\s+(?:my\s+)?vision/i,
  /\bnumb(?:ness)?\b.{0,35}(?:one[- ]side|arm|leg|hand|face|left|right)|(?:one[- ]side|left side|right side).{0,25}\bnumb/i,
  /\bworst headache\b|(?:headache).{0,40}(?:started|began|came on)\s+(?:suddenly|all of a sudden)/i,
  // English: limbs and one-sided symptoms
  /(?:arm|leg|one[- ]side(?:d)?).{0,25}(?:weak|numb)|(?:weakness|numbness).{0,35}(?:arm|leg|one[- ]side)/i,
  /(?:tingling|pins and needles).{0,35}(?:arm|leg|hand|face|one[- ]side|left|right)/i,
  // English: arm drift as a standalone phrase. A self report like "my arm
  // keeps drifting down" is a FAST finding and must escalate here too.
  // The FAST wizard itself never calls this guard (it scores answers with
  // needsUrgentAction below), so educational FAST wording in the wizard
  // is unaffected; on the Worker tools path the fiction and education
  // layer can still suppress a purely educational mention.
  /(?:arm|hand).{0,25}drift\w*|drift\w*.{0,20}(?:down|arm|hand)/i,
  // English: speech and language. slur tolerates the one-r spelling.
  /slur{1,2}\w*\s*(?:speech|words)|(?:speech|words).{0,20}slur{1,2}/i,
  /\baphasia\b|\baphasic\b/i,
  /(?:trouble|difficulty|cannot|can't|unable to)\s*(?:speak|speaking|talk|raise.{0,15}arm|lift.{0,15}arm)/i,
  // English: lay phrasings people actually type when panicking
  /(?:arm|leg|hand|side|face).{0,20}(?:feels?|went|gone|is)\s+dead\b/i,
  /(?:tongue).{0,20}(?:thick|heavy|clumsy|stiff)/i,
  /(?:words|speech).{0,25}(?:come out|coming out|comes out)\s+(?:wrong|garbled|mixed up)|\bgarbled\b/i,
  /(?:face|arm|leg|hand|side)\s+(?:will not|won't|can no longer)\s+(?:move|lift|raise|grip)|(?:hand)\s+(?:will not|won't|cannot|can't)\s+grip/i,
  /(?:everything|it all|my vision)\s+(?:went|gone|is|turned)\s+double|room\s+(?:keeps\s+)?spinning|\bdouble\s+(?:sight|everything)\b/i,
  // English: sudden onset symptoms, including vertigo and instability
  /sudden.{0,45}(?:vision|blind|balance|dizz|vertigo|headache|confus|weak|numb|tingl)/i,
  /\bbe[- ]?fast\b/i,
  /(?:having|had|suspect|possible|think|signs? of|symptoms? of|do I have|is this|could).{0,30}\bstroke\b/i,
  // Indonesian: face, colloquial crooked-face words (perot, peyot), and
  // the common typo mencog for mencong
  /(?:wajah|muka|mulut|senyum|bibir).{0,25}(?:mencon\w*|mencog|miring|turun|perot|peyot|penyot|merot|tidak simetris|lemah)/i,
  // Indonesian: limbs, including kesemutan, baal, Javanese gringging,
  // gemetar, and lemas/lemes
  /(?:lengan|tangan|kaki|sebelah|satu sisi|separuh).{0,35}(?:lemah|lemas|lemes|kebas|mati rasa|lumpuh|kesemutan|baal|gringging\w*|gemetar)|(?:lemah|lemas|lemes|kebas|mati rasa|lumpuh|kesemutan|baal|gringging\w*|gemetar).{0,35}(?:lengan|tangan|kaki|sebelah|satu sisi|separuh)/i,
  // Indonesian: speech, including pelo, colloquial negations (ndak bisa,
  // nggak bisa, gak bisa), ngomong, and bare angkat without meng-
  /\bpelo\b|(?:bicara|berbicara|ucapan|omongan|kata).{0,20}(?:cadel|tidak jelas|pelo)|(?:sulit|susah|tidak bisa|ndak bisa|nggak bisa|gak bisa).{0,15}(?:bicara|berbicara|ngomong|mengangkat.{0,15}(?:lengan|tangan)|angkat.{0,10}(?:lengan|tangan|arm))/i,
  // Indonesian: a stiff or heavy tongue (lidah kelu, lidah kaku)
  /(?:lidah).{0,20}(?:kelu|kaku|berat|tebal)/i,
  // Indonesian: sudden onset, including vertigo and unsteadiness (limbung)
  /(?:tiba[- ]tiba|mendadak).{0,45}(?:penglihatan|pandangan|kabur|buta|keseimbangan|pusing|vertigo|limbung|sakit kepala|bingung|lemah|kebas|kesemutan|baal)/i,
  /(?:sakit kepala|nyeri kepala).{0,30}(?:tiba[- ]tiba|mendadak)/i,
  // Indonesian: unsteadiness on its own, and blurred or lost vision
  /\blimbung\b/i,
  /(?:penglihatan|pandangan).{0,20}(?:kabur|buram|hilang|gelap)|(?:kabur|buta).{0,15}(?:sebelah|satu mata|mata)/i,
  /(?:curiga|diduga|mungkin|sepertinya|apakah|sedang|mengalami|terkena|tanda|gejala).{0,30}\bstroke\b/i,
  // Joined words: the highest-risk phrases typed without any spaces
  /\btidakbisabicara\b|\btidakbisangomong\b|\btidakbisagerak\b|\btidakbisadigerakkan\b|\bcannotlift\w*|\bcannotmove\w*|\bcannotsmile\b|\bcannotsee\b/i,
];

// Second pass, identical to the Worker guard: body part and symptom word
// in the same sentence but far apart, gated on the sentence also reading
// like a report (a person pronoun or a time word).
const SENTENCE_ORGAN_RE =
  /\b(?:face|facial|arm|leg|hand|speech|tongue|wajah|muka|tangan|lengan|kaki|bicara|lidah|mulut|bibir)\b/i;
const SENTENCE_SYMPTOM_RE =
  /(?:droop\w*|weak\w*|slur{1,2}\w*|numb\w*|drift\w*|mencon\w*|mencog|pelo|lemah|lemas|kesemutan|baal|miring|kebas)/i;
const SENTENCE_REPORT_RE =
  /\b(?:I|my|her|his|she|he|we|saya|dia|ibu|ayah|istri|suami|by|since|sejak|tadi|now|sekarang|began|started)\b/i;
const SENTENCE_WINDOW = 200;

function sentenceWindowHit(normalized: string): boolean {
  for (const sentence of normalized.split(/(?<=[.!?])\s+/)) {
    if (sentence.length > 400) continue;
    const organ = SENTENCE_ORGAN_RE.exec(sentence);
    if (!organ) continue;
    const symptom = SENTENCE_SYMPTOM_RE.exec(sentence);
    if (!symptom) continue;
    if (Math.abs(symptom.index - organ.index) > SENTENCE_WINDOW) continue;
    if (SENTENCE_REPORT_RE.test(sentence)) return true;
  }
  return false;
}

export function mentionsAcuteSigns(message: string): boolean {
  if (!message) return false;
  const text = normalizeText(message);
  if (REVERSED_SYMPTOM_RE.test(text)) return true;
  if (ACUTE_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return sentenceWindowHit(text);
}

export type FastAnswer = 'yes' | 'no' | 'unsure';
export function needsUrgentAction(answers: (FastAnswer | null)[], otherSymptoms = false): boolean {
  return otherSymptoms || answers.some((answer) => answer === 'yes' || answer === 'unsure');
}

export const RESOURCE_LINKS = [
  {
    title: 'AHA / ASA: stroke symptoms',
    url: 'https://www.stroke.org/en/about-stroke/stroke-symptoms',
  },
  {
    title: 'Kemenkes: calling emergency services',
    url: 'https://psc.kemkes.go.id/web/cara-melakukan-panggilan-emergency-call-119',
  },
];

export const OFFLINE_TOPICS = [
  {
    question: 'What does FAST stand for?',
    reply:
      'FAST is a way to remember common stroke warning signs: Face drooping, Arm weakness, Speech difficulty, and Time to call emergency services. If any sign appears suddenly, call 119 in Indonesia now. Other warning signs can include sudden vision or balance problems and a sudden severe headache. FAST cannot rule out stroke.',
  },
  {
    question: 'Can stroke happen at any age?',
    reply:
      'Yes. Stroke risk increases with age, but stroke can happen at any age. Learning warning signs matters for everyone. Managing blood pressure and other health conditions with a healthcare professional can help lower risk, but does not guarantee prevention.',
  },
  {
    question: 'What is a TIA?',
    reply:
      'A transient ischemic attack (TIA) can cause stroke-like symptoms that disappear. You cannot tell at the start whether symptoms are a TIA or a stroke. Symptoms that resolve still need emergency assessment. Call 119 in Indonesia immediately rather than waiting for symptoms to return.',
  },
  {
    question: 'How can I support a caregiver?',
    reply:
      'Offer specific, practical help: an errand, transport, a meal, or time for a break. Listen to what the caregiver and survivor need. Ask their care team about safe assistance and local support. Do not change medicines, prescribe exercises, or try swallowing techniques without professional guidance.',
  },
];
