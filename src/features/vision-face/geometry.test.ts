import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PRESETS,
  analyzeFace,
  computeMetrics,
  headRollDeg,
  interEyeDistance,
  jitterLandmarks,
  qualityGate,
  summarizeCaptures,
  summarizeValues,
  syntheticFace,
  yawProxy,
} from './geometry';

function preset(id: string) {
  const found = SYNTHETIC_PRESETS.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing preset ${id}`);
  return found;
}

function analyzePreset(id: string) {
  const entry = preset(id);
  return analyzeFace({
    faceCount: 1,
    landmarks: syntheticFace(entry.spec),
    sharpness: entry.sharpness,
    lightingBalance: entry.lightingBalance,
  });
}

describe('synthetic face geometry', () => {
  it('builds a neutral face with equal geometry on both sides', () => {
    const lm = syntheticFace({});
    expect(interEyeDistance(lm)).toBeCloseTo(0.2, 6);
    expect(headRollDeg(lm)).toBeCloseTo(0, 6);
    expect(yawProxy(lm)).toBeCloseTo(0, 6);
    const metrics = computeMetrics(lm);
    expect(metrics.mouthCornerDelta).toBeCloseTo(0, 6);
    expect(metrics.eyeApertureRatio).toBeCloseTo(1, 6);
    expect(metrics.browHeightDelta).toBeCloseTo(0, 6);
  });

  it('recovers the known ground truth of the one-sided teaching sample', () => {
    const metrics = computeMetrics(syntheticFace(preset('one-sided').spec));
    expect(metrics.mouthCornerDelta).toBeCloseTo(-0.09, 4);
    expect(metrics.eyeApertureRatio).toBeCloseTo(0.72, 4);
    expect(metrics.browHeightDelta).toBeCloseTo(-0.05, 4);
  });

  it('keeps a smiling face level between the corners', () => {
    const metrics = computeMetrics(syntheticFace({ smile: 1 }));
    expect(metrics.mouthCornerDelta).toBeCloseTo(0, 6);
  });

  it('is deterministic for the same spec', () => {
    expect(syntheticFace({ smile: 0.5, rollDeg: 3 })).toEqual(
      syntheticFace({ smile: 0.5, rollDeg: 3 }),
    );
  });
});

describe('quality gate', () => {
  it('passes the neutral teaching face as good', () => {
    const result = analyzePreset('neutral');
    expect(result.status).toBe('good');
    if (result.status !== 'cannot') {
      expect(result.metrics.mouthCornerDelta).toBeCloseTo(0, 6);
    }
  });

  it('refuses a tilted head instead of measuring it', () => {
    const result = analyzePreset('head-tilt');
    expect(result.status).toBe('cannot');
    expect(result.report.checks.some((c) => c.id === 'roll' && c.level === 'fail')).toBe(true);
  });

  it('refuses a turned head', () => {
    const result = analyzePreset('turned');
    expect(result.status).toBe('cannot');
    expect(result.report.checks.some((c) => c.id === 'yaw' && c.level === 'fail')).toBe(true);
  });

  it('refuses uneven lighting', () => {
    const result = analyzePreset('uneven-light');
    expect(result.status).toBe('cannot');
    expect(result.report.checks.some((c) => c.id === 'lighting' && c.level === 'fail')).toBe(true);
  });

  it('refuses a face that is too small', () => {
    const result = analyzePreset('small-face');
    expect(result.status).toBe('cannot');
    expect(result.report.checks.some((c) => c.id === 'face-size' && c.level === 'fail')).toBe(true);
  });

  it('refuses zero faces and multiple faces', () => {
    expect(qualityGate({ faceCount: 0, landmarks: null }).status).toBe('cannot');
    expect(qualityGate({ faceCount: 2, landmarks: syntheticFace({}) }).status).toBe('cannot');
  });

  it('refuses missing landmarks', () => {
    expect(qualityGate({ faceCount: 1, landmarks: null }).status).toBe('cannot');
  });

  it('refuses implausible landmark placement', () => {
    const lm = syntheticFace({});
    lm.mouthTop = { ...lm.mouthTop, y: 0.3 };
    const report = qualityGate({ faceCount: 1, landmarks: lm });
    expect(report.status).toBe('cannot');
    expect(report.checks.some((c) => c.id === 'plausibility' && c.level === 'fail')).toBe(true);
  });

  it('refuses a blurry photo via the sharpness check', () => {
    const report = qualityGate({
      faceCount: 1,
      landmarks: syntheticFace({}),
      sharpness: 12,
      lightingBalance: 0.95,
    });
    expect(report.status).toBe('cannot');
  });

  it('downgrades borderline pose to low confidence, not failure', () => {
    const report = qualityGate({
      faceCount: 1,
      landmarks: syntheticFace({ rollDeg: 8 }),
      sharpness: 230,
      lightingBalance: 0.93,
    });
    expect(report.status).toBe('low');
  });
});

describe('repeated captures', () => {
  it('summarizes values with a mean and an observed spread', () => {
    const range = summarizeValues([0.1, 0.2, 0.3]);
    expect(range?.mean).toBeCloseTo(0.2, 6);
    expect(range?.spread).toBeCloseTo(0.1, 6);
    expect(range?.count).toBe(3);
    expect(summarizeValues([])).toBeNull();
  });

  it('jitter is deterministic per seed and stays small', () => {
    const base = syntheticFace({});
    const a = jitterLandmarks(base, 42);
    const b = jitterLandmarks(base, 42);
    expect(a).toEqual(b);
    expect(Math.abs(a.noseTip.x - base.noseTip.x)).toBeLessThan(0.003);
  });

  it('summarizes captures per metric', () => {
    const ranges = summarizeCaptures([
      computeMetrics(syntheticFace({})),
      computeMetrics(syntheticFace(preset('one-sided').spec)),
    ]);
    expect(ranges.mouthCornerDelta?.count).toBe(2);
    expect(ranges.mouthCornerDelta?.min).toBeCloseTo(-0.09, 4);
    expect(ranges.mouthCornerDelta?.max).toBeCloseTo(0, 4);
  });
});
