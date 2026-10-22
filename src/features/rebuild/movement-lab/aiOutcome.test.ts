import { describe, expect, it } from 'vitest';
import { mapAiResult, photoNoteForTask, uploadFileKind } from './aiOutcome';

const FALLBACK_HEADLINE = 'The AI described your upload.';
const FALLBACK_REASON = 'The AI could not see enough in these frames.';

describe('uploadFileKind', () => {
  it('maps still images to the photo kind', () => {
    expect(uploadFileKind({ type: 'image/jpeg' })).toBe('photo');
    expect(uploadFileKind({ type: 'image/png' })).toBe('photo');
  });

  it('maps videos to the video kind', () => {
    expect(uploadFileKind({ type: 'video/mp4' })).toBe('video');
    expect(uploadFileKind({ type: 'video/webm' })).toBe('video');
  });
});

describe('photoNoteForTask', () => {
  it('tells the arm stage that position change over time was not judged', () => {
    expect(photoNoteForTask('arm-video')).toBe(
      'This was one still photo, so how the arm position changed or held over time could not be judged. Only the position visible in this single moment was described.',
    );
  });

  it('tells the hand stage that the tapping rhythm was not judged', () => {
    expect(photoNoteForTask('hand-video')).toBe(
      'This was one still photo, so the tapping rhythm could not be judged. Only the hand position visible in this single moment was described.',
    );
  });
});

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
