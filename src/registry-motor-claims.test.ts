import { describe, expect, it } from 'vitest';
import { FEATURES } from '../shared/registry';

// P0 contract: the Motor AI registry copy may not claim camera-based
// measurement the features do not perform. The tagline, summary, and
// models fields of every Motor AI entry are checked for capability
// claims of "pose tracking", "hand landmark", or "camera". A mention in
// a denial context (for example "no camera is used") is honest copy and
// is not a claim, so an occurrence shortly after a negation word is
// ignored.

const CLAIM_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'pose tracking', pattern: /pose tracking/gi },
  { label: 'hand landmark', pattern: /hand landmark/gi },
  { label: 'camera', pattern: /camera/gi },
];

const NEGATION_BEFORE =
  /\b(no|not|never|without|none|isn't|aren't|doesn't|don't|won't|cannot|can't)\b/i;

const NEGATION_WINDOW_CHARS = 40;

function capabilityClaims(text: string): string[] {
  const claims: string[] = [];
  for (const { label, pattern } of CLAIM_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const before = text.slice(Math.max(0, start - NEGATION_WINDOW_CHARS), start);
      if (NEGATION_BEFORE.test(before)) continue;
      claims.push(label);
    }
  }
  return claims;
}

describe('Motor AI registry claims', () => {
  const motorFeatures = FEATURES.filter((feature) => feature.group === 'Motor AI');

  it('covers all four Motor AI features', () => {
    expect(motorFeatures.map((feature) => feature.id).sort()).toEqual([
      'arm-drift',
      'balance-lab',
      'fast-vision-check',
      'finger-tapping',
    ]);
  });

  it('makes no pose tracking, hand landmark, or camera capability claim', () => {
    const offenders: string[] = [];
    for (const feature of motorFeatures) {
      const fields: [string, string][] = [
        ['tagline', feature.tagline],
        ['summary', feature.summary],
        ['models', feature.models],
      ];
      for (const [field, text] of fields) {
        for (const claim of capabilityClaims(text)) {
          offenders.push(`${feature.id} ${field} claims "${claim}": ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
