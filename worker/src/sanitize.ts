// Output sanitization for model replies and for untrusted client text that
// is embedded into prompts. The model is never a trusted source of links,
// markup, or medication instructions.

export const MAX_REPLY_CHARS = 6_000;

// Strips markdown links (keeping their visible text), HTML tags, and bare
// URLs, then trims and caps the result at MAX_REPLY_CHARS characters.
export function sanitizeReply(text: string): string {
  const cleaned = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, '[link omitted]')
    .trim();
  return cleaned.length > MAX_REPLY_CHARS ? cleaned.slice(0, MAX_REPLY_CHARS).trim() : cleaned;
}

// Removes clear dosing instructions from a reply. Deliberately
// conservative: a dose amount is only replaced when it appears together
// with an instruction to take it, a dosing schedule, a weight-based
// rate, or a loading/maintenance list format, so general educational
// text that merely names a medicine or a strength in passing is not
// mangled. Amounts may be digits or English number words, units may be
// abbreviated or written out in full, and the common Indonesian dosing
// phrasings are covered as well, because the filter is the last line of
// defense and cannot depend on the reply language. This is a backstop,
// not a substitute for the system prompt prohibition on dosing advice.
const AMOUNT = String.raw`\d+(?:[.,]\d+)?`;
const NUMWORD = String.raw`(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred)`;
const UNIT = String.raw`(?:milligrams?|micrograms?|millilit(?:er|re)s?|grams?|mg|mcg|g|ml|iu|units?)`;
const TAIL = String.raw`[^.!?\n]*`;

const DOSING_PATTERNS: RegExp[] = [
  // Instruction verbs followed by an amount and a unit: "take 81 mg",
  // "take two 81 mg tablets", "take one hundred milligrams",
  // "administer 10 mg", "start 500 milligrams".
  new RegExp(
    String.raw`\b(?:take|taking|taken|give|giving|administer|administering|start|starting|dose of|dosage of)\s+(?:(?:${NUMWORD}\s+)?${AMOUNT}\s*${UNIT}\b|(?:${NUMWORD}\s+){1,2}${UNIT}\b)${TAIL}`,
    'gi',
  ),
  // Amount, unit, and a schedule: "81 mg twice daily", "500 milligrams
  // twice a day", "5 ml every 8 hours", "100 mg per day", "81 mg each
  // morning".
  new RegExp(
    String.raw`\b${AMOUNT}\s*${UNIT}\s*(?:\/\s*(?:day|dose|kg)\s*)?(?:,?\s*(?:once|twice|three times|\d+\s*times)\s+)?(?:daily|per day|a day|each day|every day|each morning|every morning|each evening|every\s+\d+\s*hours?|before meals?|after meals?|at bedtime|with food)\b${TAIL}`,
    'gi',
  ),
  // Amount and unit tied to a treatment duration, possibly across a
  // second drug: "aspirin 81 mg plus clopidogrel 75 mg for 21 days".
  new RegExp(String.raw`\b${AMOUNT}\s*${UNIT}\b${TAIL.replace('*', '{0,60}?')}\bfor\s+\d+\s+days?\b${TAIL}`, 'gi'),
  // Weight-based dosing: "0.9 mg per kilogram", "0.9 mg/kg".
  new RegExp(String.raw`\b${AMOUNT}\s*${UNIT}\s*(?:\/\s*kg\b|per\s+(?:kilogram|kg)\b)${TAIL}`, 'gi'),
  // List formats without a verb or a schedule word: "300 mg loading,
  // then 75 mg maintenance", "loading dose of 300 mg".
  new RegExp(String.raw`\b${AMOUNT}\s*${UNIT}\s+(?:loading|maintenance)\b${TAIL}`, 'gi'),
  new RegExp(String.raw`\b(?:loading|maintenance)(?:\s+dose)?\s*(?::|of)?\s*${AMOUNT}\s*${UNIT}\b${TAIL}`, 'gi'),
  // Indonesian dosing phrasings: "Minum aspirin 80 mg sekali sehari",
  // "dosis 80 mg", "80 mg sehari", "80 mg sesudah makan".
  new RegExp(String.raw`\b(?:minum|minumlah|diminum|konsumsi|dikonsumsi|dosis)\b${TAIL.replace('*', '{0,30}?')}${AMOUNT}\s*${UNIT}\b${TAIL}`, 'gi'),
  new RegExp(
    String.raw`\b${AMOUNT}\s*${UNIT}\b${TAIL.replace('*', '{0,30}?')}\b(?:sehari|per\s+hari|sesudah\s+makan|sebelum\s+makan|setiap\s+hari)\b${TAIL}`,
    'gi',
  ),
];

export function filterDosingPatterns(text: string): string {
  let result = text;
  for (const pattern of DOSING_PATTERNS) {
    result = result.replace(pattern, '[dosing detail removed]');
  }
  return result;
}
