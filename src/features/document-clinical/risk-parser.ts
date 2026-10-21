// Rule-based local extractor for the Risk Factor Extractor.
// Turns a free-text history into the fixed 10 factor profile from
// PLANNING.md section 6.6. The clinical core is attribution and negation:
// "no history of diabetes" is stated absent, "father had a stroke" is
// family history and never the patient's own event, and a factor that is
// not mentioned is listed as not mentioned, never as absent. There is
// deliberately no score, percentage, or stratification anywhere here.

import { findVerbatimSpan, splitIntoSentences } from './text-utils';
import type {
  RiskExtraction,
  RiskFactorId,
  RiskFactorResult,
  SourceSentence,
} from './types';

interface FactorPattern {
  regex: RegExp;
  /**
   * 'phrase' patterns already state the factor in their own wording
   * ("does not exercise", "rarely exercises"), so a negation cue in front
   * of them must not flip them to absent. 'term' patterns are plain
   * condition words and obey the normal negation rules. 'measure' patterns
   * are bare measurement nouns ("blood pressure", "cholesterol"): a bare
   * mention is not evidence either way, so it only counts when a nearby
   * cue says the value was high (present) or in the normal range (stated
   * absent).
   */
  kind: 'term' | 'phrase' | 'measure';
}

interface FactorDefinition {
  id: RiskFactorId;
  label: string;
  patterns: FactorPattern[];
  /** Whether a "normal range" statement after the term means stated absent. */
  normalMeansAbsent: boolean;
  education: string;
}

const term = (regex: RegExp): FactorPattern => ({ regex, kind: 'term' });
const phrase = (regex: RegExp): FactorPattern => ({ regex, kind: 'phrase' });
const measure = (regex: RegExp): FactorPattern => ({ regex, kind: 'measure' });

export const RISK_FACTORS: FactorDefinition[] = [
  {
    id: 'hypertension',
    label: 'Hypertension (high blood pressure)',
    normalMeansAbsent: true,
    patterns: [
      term(/hypertension/i),
      term(/high blood pressure/i),
      term(/blood pressure (?:was |is )?(?:high|elevated|raised)/i),
      term(/hipertensi/i),
      term(/tekanan darah tinggi/i),
      term(/darah tinggi/i),
      measure(/blood pressure/i),
      measure(/tekanan darah/i),
    ],
    education:
      'High blood pressure is one of the strongest modifiable risk factors for stroke. It usually causes no symptoms, so regular measurement is the only way to know the values.',
  },
  {
    id: 'diabetes',
    label: 'Diabetes',
    normalMeansAbsent: true,
    patterns: [
      term(/diabetes/i),
      term(/diabetic/i),
      term(/high blood sugar/i),
      term(/blood sugar (?:was |is )?high/i),
      term(/gula darah tinggi/i),
      term(/kencing manis/i),
      measure(/blood sugar/i),
      measure(/gula darah/i),
    ],
    education:
      'Diabetes damages blood vessels over time and raises stroke risk. Long term blood sugar control, usually tracked with HbA1c, is a core part of stroke prevention.',
  },
  {
    id: 'atrial-fibrillation',
    label: 'Atrial fibrillation',
    normalMeansAbsent: false,
    patterns: [
      term(/atrial fibrillation/i),
      term(/\bafib\b/i),
      term(/fibrilasi atrium/i),
    ],
    education:
      'Atrial fibrillation is an irregular heart rhythm that lets clots form inside the heart; those clots can travel to the brain. It can come and go, so a single normal ECG does not exclude it.',
  },
  {
    id: 'smoking',
    label: 'Smoking',
    normalMeansAbsent: false,
    patterns: [
      term(/smok\w*/i),
      term(/cigarettes?\b/i),
      term(/tobacco/i),
      term(/merokok/i),
      term(/\brokok\b/i),
      term(/perokok/i),
    ],
    education:
      'Smoking injures vessel walls and makes blood more likely to clot. Quitting lowers stroke risk substantially over the following years, and past smoking still counts in a risk profile.',
  },
  {
    id: 'dyslipidemia',
    label: 'Dyslipidemia (cholesterol problems)',
    normalMeansAbsent: true,
    patterns: [
      term(/dyslipidemia/i),
      term(/dislipidemia/i),
      term(/high cholesterol/i),
      term(/cholesterol (?:was |is )?high/i),
      term(/raised cholesterol/i),
      term(/kolesterol tinggi/i),
      term(/high ldl/i),
      measure(/cholesterol/i),
      measure(/kolesterol/i),
    ],
    education:
      'Raised LDL cholesterol contributes to the fatty plaques that narrow arteries. Lipid values come from a blood test; a history text can only report what was already measured.',
  },
  {
    id: 'prior-stroke-tia',
    label: 'Previous stroke or TIA',
    normalMeansAbsent: false,
    patterns: [
      term(/\bstroke\b/i),
      term(/\btia\b/i),
      term(/transient isch[ae]mic attack/i),
      term(/mini[ -]?stroke/i),
    ],
    education:
      'A previous stroke or transient ischemic attack (TIA) is one of the strongest predictors of another stroke, which is why secondary prevention after an event is so intensive.',
  },
  {
    id: 'obesity',
    label: 'Obesity or excess weight',
    normalMeansAbsent: true,
    patterns: [
      term(/obes\w*/i),
      term(/overweight/i),
      term(/bmi (?:is |of )?(?:[3-9]\d|\d{3,})/i),
      term(/kelebihan berat badan/i),
      term(/berat badan berlebih/i),
      term(/obesitas/i),
    ],
    education:
      'Excess weight raises stroke risk directly and through blood pressure, diabetes, and sleep apnea. In a structured profile it is recorded from stated weight, BMI, or a stated diagnosis, never guessed.',
  },
  {
    id: 'inactivity',
    label: 'Physical inactivity',
    normalMeansAbsent: false,
    patterns: [
      term(/sedentary/i),
      term(/physically inactive/i),
      term(/inactive lifestyle/i),
      term(/kurang gerak/i),
      term(/kurang aktivitas fisik/i),
      phrase(/does not exercise/i),
      phrase(/never exercises?\b/i),
      phrase(/no regular exercise/i),
      phrase(/rarely exercises?\b/i),
      phrase(/mostly sits\b/i),
      phrase(/sits (?:at home )?all day/i),
      phrase(/jarang berolahraga/i),
      phrase(/tidak pernah berolahraga/i),
      phrase(/tidak berolahraga/i),
    ],
    education:
      'Regular physical activity lowers blood pressure, improves blood sugar control, and is associated with lower stroke risk. Guidelines commonly describe at least 150 minutes of moderate activity per week for adults who can do it.',
  },
  {
    id: 'alcohol',
    label: 'Alcohol use',
    normalMeansAbsent: false,
    patterns: [
      term(/alcohol/i),
      term(/alkohol/i),
      term(/heavy drinking/i),
      term(/drinks? (?:beer|wine|spirits|whisky|vodka)/i),
      term(/minuman keras/i),
      term(/\bmiras\b/i),
    ],
    education:
      'Heavier alcohol use raises blood pressure and the risk of bleeding in the brain, and it can trigger atrial fibrillation. The profile records stated use only; amounts in a story are rarely precise.',
  },
  {
    id: 'family-history',
    label: 'Family history of stroke',
    normalMeansAbsent: false,
    patterns: [
      term(/family history of (?:stroke|tia)/i),
      term(/riwayat keluarga[^.!?]*stroke/i),
    ],
    education:
      'A close relative who had a stroke, especially at a younger age, is associated with higher personal risk, partly through shared genes and shared habits. Family history belongs to the family member, never to the patient.',
  },
];

export function riskFactorLabel(id: RiskFactorId): string {
  return RISK_FACTORS.find((factor) => factor.id === id)?.label ?? id;
}

export function riskFactorEducation(id: RiskFactorId): string {
  return RISK_FACTORS.find((factor) => factor.id === id)?.education ?? '';
}

const NEGATION_CUES = /\b(no|not|never|denies|denied|without|none|non|tidak|bukan|tanpa|bebas)\b/i;
const NORMAL_CUES = /\bnormal\b|within normal limits|in the normal range|normal range/i;
const FAMILY_CUES =
  /\b(father|mother|parents?|brother|sister|sibling|family|ayah|ibu|bapak|saudara|keluarga)\b/i;
const RULED_OUT = /\bruled out\b|\bexcluded\b/i;
const CLAUSE_BREAKS = [',', ';', ' and ', ' but ', ' dan ', ' tetapi '];

interface MatchInfo {
  sentenceIndex: number;
  negated: boolean;
  family: boolean;
  kind: 'term' | 'phrase' | 'measure';
}

function clauseStart(sentence: string, at: number): number {
  let start = 0;
  for (const separator of CLAUSE_BREAKS) {
    const idx = sentence.lastIndexOf(separator, at - 1);
    if (idx !== -1) start = Math.max(start, idx + separator.length);
  }
  return start;
}

function clauseEnd(sentence: string, at: number): number {
  let end = sentence.length;
  for (const separator of CLAUSE_BREAKS) {
    const idx = sentence.indexOf(separator, at);
    if (idx !== -1) end = Math.min(end, idx);
  }
  return end;
}

function findMatches(
  definition: FactorDefinition,
  sentences: SourceSentence[],
): MatchInfo[] {
  const matches: MatchInfo[] = [];
  for (const sentence of sentences) {
    for (const pattern of definition.patterns) {
      const global = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : `${pattern.regex.flags}g`);
      for (const match of sentence.text.matchAll(global)) {
        const at = match.index ?? 0;
        const start = clauseStart(sentence.text, at);
        const end = clauseEnd(sentence.text, at + match[0].length);
        const before = sentence.text.slice(start, at);
        const after = sentence.text.slice(at + match[0].length, at + match[0].length + 70);
        const clause = sentence.text.slice(start, end);
        let negated = false;
        if (pattern.kind === 'term') {
          negated =
            NEGATION_CUES.test(before) ||
            /^\s*[:\-]?\s*(no|none|denied|tidak)\b/i.test(
              sentence.text.slice(at + match[0].length, at + match[0].length + 14),
            ) ||
            RULED_OUT.test(clause);
          if (!negated && definition.normalMeansAbsent && NORMAL_CUES.test(after)) {
            negated = true;
          }
        }
        const family = FAMILY_CUES.test(sentence.text.slice(0, at + match[0].length));
        if (pattern.kind === 'measure') {
          // A bare measurement noun is evidence only with a value cue:
          // a normal range statement means stated absent, a high cue
          // means present, and a bare mention is ignored entirely.
          if (definition.normalMeansAbsent && NORMAL_CUES.test(after)) {
            matches.push({ sentenceIndex: sentence.index, negated: true, family, kind: pattern.kind });
          } else if (/\b(high|elevated|raised|tinggi)\b/i.test(after.slice(0, 30))) {
            matches.push({ sentenceIndex: sentence.index, negated: false, family, kind: pattern.kind });
          }
          continue;
        }
        matches.push({ sentenceIndex: sentence.index, negated, family, kind: pattern.kind });
      }
    }
  }
  return matches;
}

function resultFor(
  definition: FactorDefinition,
  sentences: SourceSentence[],
  text: string,
  familyStroke: MatchInfo[],
): RiskFactorResult {
  const matches = findMatches(definition, sentences);
  let deciding: MatchInfo | null = null;
  let status: RiskFactorResult['status'] = 'not_mentioned';

  if (definition.id === 'family-history') {
    const explicit = matches;
    const presentHit =
      explicit.find((match) => !match.negated) ?? familyStroke.find((match) => !match.negated);
    const absentHit = explicit.find((match) => match.negated);
    if (presentHit) {
      deciding = presentHit;
      status = 'present';
    } else if (absentHit) {
      deciding = absentHit;
      status = 'absent_stated';
    }
  } else {
    const own = matches.filter((match) => !match.family);
    const presentHit = own.find((match) => !match.negated);
    const absentHit = own.find((match) => match.negated);
    if (presentHit) {
      deciding = presentHit;
      status = 'present';
    } else if (absentHit) {
      deciding = absentHit;
      status = 'absent_stated';
    }
  }

  const sentence = deciding ? sentences[deciding.sentenceIndex] : undefined;
  const evidenceSpan = sentence ? sentence.text : null;
  const evidenceValid = evidenceSpan !== null && findVerbatimSpan(text, evidenceSpan) !== null;

  let note: string | null = null;
  if (status === 'present' && sentence) {
    if (definition.id === 'smoking' && /\b(quit|stopped|former|ex[ -]?smoker|berhenti|mantan)\b/i.test(sentence.text)) {
      note = 'Former smoker: a past history still counts in the profile.';
    }
    if (
      (definition.id === 'hypertension' || definition.id === 'diabetes') &&
      /\b(controlled|terkontrol)\b/i.test(sentence.text)
    ) {
      note = 'Stated as controlled in the text.';
    }
    if (definition.id === 'family-history') {
      note = 'Attributed to a family member in the text, not to the patient.';
    }
  }

  return {
    factor: definition.id,
    label: definition.label,
    status,
    evidenceSpan,
    evidenceSentenceIndex: sentence ? sentence.index : null,
    evidenceValid,
    note,
  };
}

/**
 * Extract the fixed 10 factor risk profile from a history text. Pure.
 * The result always contains all 10 factors, each with a status and,
 * where stated, an exact evidence quote from the text.
 */
export function extractRiskProfile(text: string): RiskExtraction {
  const sentences = splitIntoSentences(text);
  const strokeDefinition = RISK_FACTORS.find((factor) => factor.id === 'prior-stroke-tia');
  const familyStroke = strokeDefinition
    ? findMatches(strokeDefinition, sentences).filter((match) => match.family)
    : [];
  const results = RISK_FACTORS.map((definition) =>
    resultFor(definition, sentences, text, familyStroke),
  );
  return {
    results,
    notMentioned: results
      .filter((result) => result.status === 'not_mentioned')
      .map((result) => result.factor),
    sentences,
  };
}
