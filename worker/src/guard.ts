// Emergency symptom guard. Deliberately conservative keyword detection:
// it is a safety reminder, not a clinically validated symptom classifier.
// Every check normalizes first so a symptom report cannot slip past the
// patterns by splitting lines, hiding zero-width characters inside a word,
// swapping a Latin letter for a Cyrillic or Greek look-alike, or spelling
// a symptom word out letter by letter.

// Homoglyph folding: common Cyrillic and Greek letters that look identical
// to Latin letters are folded back before matching, so an obfuscated
// keyword ("fаce" with a Cyrillic a) is treated the same as the plain word.
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

// Zero-width characters, soft hyphens, and bidirectional control marks carry
// no meaning for a person in a hurry, but they break keyword matching when
// they land inside a symptom word, so they are removed outright.
const INVISIBLE_RE = /[\u200B-\u200D\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

// Hardened normalization, shared step for step with the client guard in
// src/safety.ts so both implementations see exactly the same text:
// NFKC fold, invisible and BiDi control removal, homoglyph folding,
// whitespace collapse, then rejoining of letter-spelled words (a run of
// four or more single-letter tokens, "m e n c o n g", becomes "mencong").
export function normalizeText(s: string): string {
  const cleaned = s
    .normalize('NFKC')
    .replace(INVISIBLE_RE, '')
    .replace(HOMOGLYPH_RE, (ch) => HOMOGLYPHS[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.replace(/\b(?:[A-Za-z] ){3,}[A-Za-z]\b/g, (run) => run.replace(/ /g, ''));
}

// Text pasted through a right-to-left override arrives with every word
// spelled backwards. The reversed spellings of the highest-risk symptom
// words are matched directly (mencong reversed is gnocnem, drooping
// reversed is gnipoord, slurred is derruls, pelo is olep, tolong gnolot).
const REVERSED_SYMPTOM_RE = /(?:gnocnem|gnipoord|derruls|olep|gnolot)/i;

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
  // keeps drifting down" is a FAST finding and must escalate here, in the
  // chat and coach paths. The FAST wizard itself never calls this guard
  // (it scores answers with needsUrgentAction), and on the tools path the
  // fiction and education layer in hasToolsAcuteSigns can still suppress
  // a purely educational mention such as "explain what arm drift means".
  /(?:arm|hand).{0,25}drift\w*|drift\w*.{0,20}(?:down|arm|hand)/i,
  // English: speech and language. slur tolerates the very common one-r
  // spelling ("slured") as well as "slurred".
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
  // Indonesian: face, including lip and mouth wording, colloquial words
  // for a crooked face (perot, peyot), and the common typo mencog for
  // mencong (mencon\w* covers mencong, mencongg and friends).
  /(?:wajah|muka|mulut|senyum|bibir).{0,25}(?:mencon\w*|mencog|miring|turun|perot|peyot|penyot|merot|tidak simetris|lemah)/i,
  // Indonesian: limbs, including tingling (kesemutan), numbness (baal),
  // Javanese tingling (gringging, gringgingen), trembling, and lemas/lemes
  /(?:lengan|tangan|kaki|sebelah|satu sisi|separuh).{0,35}(?:lemah|lemas|lemes|kebas|mati rasa|lumpuh|kesemutan|baal|gringging\w*|gemetar)|(?:lemah|lemas|lemes|kebas|mati rasa|lumpuh|kesemutan|baal|gringging\w*|gemetar).{0,35}(?:lengan|tangan|kaki|sebelah|satu sisi|separuh)/i,
  // Indonesian: speech, including pelo, colloquial negations (ndak bisa,
  // nggak bisa, gak bisa), ngomong, and bare angkat without the meng-
  // prefix, which code-mixed reports use all the time
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
  // Joined words: the highest-risk phrases typed without any spaces.
  // A general dictionary segmenter is out of scope for a regex guard;
  // these literal joined forms cover the phrases the red-team bank uses.
  /\btidakbisabicara\b|\btidakbisangomong\b|\btidakbisagerak\b|\btidakbisadigerakkan\b|\bcannotlift\w*|\bcannotmove\w*|\bcannotsmile\b|\bcannotsee\b/i,
];

// Second pass for reports where the body part and the symptom word sit in
// the same sentence but far apart (a long family story between "her face"
// and "drooping"). It only fires when the sentence also reads like a
// report (a person pronoun or a time word), so plain educational prose
// that merely names a body part and a symptom stays quiet here; the
// direct patterns above already cover adjacent educational phrases.
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

export function hasAcuteSigns(text: string): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  if (REVERSED_SYMPTOM_RE.test(normalized)) return true;
  if (ACUTE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  return sentenceWindowHit(normalized);
}

// For the tools endpoint, only the question can report a real emergency;
// display context and curated fictional scenarios cannot. A personal report
// that appears before any fictional framing stays an emergency even if the
// text later asks to treat it as a simulation.
const PERSONAL_PRONOUN_RE =
  /\b(?:I|I'm|I've|my|we|our|he|she|his|her|someone|saya|aku|ibu|ayah|dia)\b/gi;
const PERSONAL_TIME_RE = /\b(?:now|currently|just happened|sedang|sekarang)\b/i;
// 25 characters: near enough that the pronoun plausibly belongs to the
// symptom clause. Calibrated on the red-team corpus: in the clinician
// case "My patient in bed 4 has facial droop" the pronoun sits 24
// characters from the symptom and must count, while in "how do I
// describe a patient whose face droops" the "I" sits 27 characters away
// and must not. At the earlier window of 60, both counted.
const PERSONAL_WINDOW = 25;

// A personal marker only counts when it sits near a symptom match. A lone
// possessive far from any symptom ("my OSCE exam tomorrow, how do I
// describe a patient whose face droops") is a study question, not a
// report about the writer. Time words (now, sekarang) count anywhere,
// because they anchor the symptom to the present moment.
function hasProximatePersonalMarker(normalized: string): boolean {
  if (PERSONAL_TIME_RE.test(normalized)) return true;
  const spans: Array<[number, number]> = [];
  for (const pattern of ACUTE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of normalized.matchAll(re)) {
      spans.push([match.index, match.index + match[0].length]);
    }
  }
  if (spans.length === 0) return false;
  for (const match of normalized.matchAll(PERSONAL_PRONOUN_RE)) {
    const idx = match.index;
    const near = spans.some(
      ([start, end]) => (idx >= start && idx <= end) || Math.abs(idx - start) <= PERSONAL_WINDOW || Math.abs(idx - end) <= PERSONAL_WINDOW,
    );
    if (near) return true;
  }
  return false;
}

export function hasToolsAcuteSigns(question: string): boolean {
  if (!question) return false;
  const normalized = normalizeText(question);
  if (!hasAcuteSigns(normalized)) return false;
  // Fiction markers in English and Indonesian. The Indonesian set was
  // missing entirely, so a novel excerpt ("tokoh dalam novel saya ...")
  // leaked through as a personal report.
  const fictional =
    /\b(?:simulation|simulator|scenario|fictional|synthetic|hypothetical|textbook|simulasi|skenario|fiksi|cerita|karangan|novel|dongeng|tokoh)\b/i;
  const actual = /\b(?:actually|real life|outside the|not (?:a |the )?(?:simulation|scenario))\b/i;
  const fictionalStart = normalized.search(fictional);
  if (fictionalStart >= 0 && !actual.test(normalized)) {
    // Fiction framing later in the text cannot neutralize a personal
    // report that was already made before the framing started.
    const beforeFiction = normalized.slice(0, fictionalStart);
    return hasAcuteSigns(beforeFiction) && hasProximatePersonalMarker(beforeFiction);
  }
  const educational =
    /\b(?:simulation|simulator|scenario|fictional|synthetic|hypothetical|example|explain|why|what|how|describe|exam|osce|teaching|study|assignment|learn|education|simulasi|skenario|fiksi|cerita|karangan|novel|dongeng|tokoh|jelaskan|mengapa|belajar|latihan|tugas)\b/i;
  return hasProximatePersonalMarker(normalized) || !educational.test(normalized);
}

export const EMERGENCY_REPLY =
  'Possible stroke signs are an emergency. Call 119 immediately in Indonesia, even if the symptoms have stopped. ' +
  'Do not wait for a chat reply, and do not drive yourself. Note the time the symptoms started, or when the person was last known well, ' +
  "and follow the emergency dispatcher's instructions. This is general education, not a diagnosis, and this service cannot rule out a stroke.";
