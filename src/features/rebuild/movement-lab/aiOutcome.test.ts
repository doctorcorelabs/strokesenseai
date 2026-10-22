import { describe, expect, it } from 'vitest';
import { mapAiResult } from './aiOutcome';

const FALLBACK_HEADLINE = 'The AI described your upload.';
const FALLBACK_REASON = 'The AI could not see enough in these frames.';

describe('mapAiResult', () => {
  it('lets an emergency answer win over a normal-looking answer', () => {
    const mapped = mapAiResult(
      {
        headline: 'Looks fine',
        observations: ['Both arms are raised.'],
        cannotAnalyze: false,
        reason: null,
        emergency: true,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({ kind: 'emergency' });
  });

  it('lets an emergency answer win over a cannot-analyze answer', () => {
    const mapped = mapAiResult(
      {
        headline: '',
        observations: [],
        cannotAnalyze: true,
        reason: 'The frames describe sudden symptoms.',
        emergency: true,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({ kind: 'emergency' });
  });

  it('keeps the model reason for a cannot-analyze answer', () => {
    const mapped = mapAiResult(
      {
        headline: 'Unused',
        observations: ['Unused'],
        cannotAnalyze: true,
        reason: 'Only one arm is visible in the frames.',
        emergency: false,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({
      kind: 'cannot',
      reason: 'Only one arm is visible in the frames.',
    });
  });

  it('falls back to the given reason when the model gives none', () => {
    const mapped = mapAiResult(
      {
        headline: '',
        observations: [],
        cannotAnalyze: true,
        reason: '   ',
        emergency: false,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({ kind: 'cannot', reason: FALLBACK_REASON });
  });

  it('passes a normal answer through with its headline and observations', () => {
    const mapped = mapAiResult(
      {
        headline: 'Your right arm sits lower than your left in the later frames.',
        observations: ['Both arms start out to the sides.', 'The right arm lowers over time.'],
        cannotAnalyze: false,
        reason: null,
        emergency: false,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({
      kind: 'ai',
      headline: 'Your right arm sits lower than your left in the later frames.',
      observations: ['Both arms start out to the sides.', 'The right arm lowers over time.'],
    });
  });

  it('wraps a single-string observation and drops blank lines', () => {
    const mapped = mapAiResult(
      {
        headline: 'Taps are visible.',
        observations: 'The thumb meets the index finger several times.',
        cannotAnalyze: false,
        emergency: false,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({
      kind: 'ai',
      headline: 'Taps are visible.',
      observations: ['The thumb meets the index finger several times.'],
    });
  });

  it('uses the fallback headline when the model headline is blank', () => {
    const mapped = mapAiResult(
      {
        headline: '  ',
        observations: [' ', 'One clear observation.'],
        cannotAnalyze: false,
        emergency: false,
      },
      FALLBACK_HEADLINE,
      FALLBACK_REASON,
    );
    expect(mapped).toEqual({
      kind: 'ai',
      headline: FALLBACK_HEADLINE,
      observations: ['One clear observation.'],
    });
  });
});
