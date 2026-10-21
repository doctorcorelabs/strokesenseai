import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_POINTS_9,
  MAX_CALIBRATION_ERROR,
  applyMap,
  canCalibrate,
  fitLinearMap,
  meanCalibrationError,
  median,
  pursuitTargetAt,
  samplingRateHz,
  scoreHolding,
  scorePursuit,
  scoreSaccades,
  syntheticCalibrationSamples,
  syntheticPursuitTrace,
  zoneMap,
} from './gaze';

describe('gaze calibration', () => {
  it('fits the identity map from perfect readings', () => {
    const samples = CALIBRATION_POINTS_9.map((target) => ({ target, reading: { ...target } }));
    const map = fitLinearMap(samples);
    expect(map.ax).toBeCloseTo(1, 6);
    expect(map.bx).toBeCloseTo(0, 6);
    expect(meanCalibrationError(map, samples)).toBeCloseTo(0, 6);
    expect(applyMap(map, { x: 0.3, y: 0.7 })).toEqual({ x: 0.3, y: 0.7 });
  });

  it('recovers a scaled and shifted reading transform', () => {
    const samples = CALIBRATION_POINTS_9.map((target) => ({
      target,
      reading: { x: 0.1 + target.x * 0.8, y: 0.05 + target.y * 0.9 },
    }));
    const map = fitLinearMap(samples);
    expect(meanCalibrationError(map, samples)).toBeCloseTo(0, 6);
    const mapped = applyMap(map, { x: 0.1 + 0.5 * 0.8, y: 0.05 + 0.5 * 0.9 });
    expect(mapped.x).toBeCloseTo(0.5, 6);
    expect(mapped.y).toBeCloseTo(0.5, 6);
  });

  it('accepts steady synthetic calibration and reports its error', () => {
    const samples = syntheticCalibrationSamples(CALIBRATION_POINTS_9, 42, 'steady');
    const map = fitLinearMap(samples);
    const error = meanCalibrationError(map, samples);
    expect(error).toBeGreaterThan(0);
    expect(error).toBeLessThan(MAX_CALIBRATION_ERROR);
    expect(canCalibrate(error)).toBe(true);
  });

  it('rejects calibration when the error is too large', () => {
    expect(canCalibrate(MAX_CALIBRATION_ERROR + 0.01)).toBe(false);
    expect(canCalibrate(Number.POSITIVE_INFINITY)).toBe(false);
    expect(meanCalibrationError(fitLinearMap([]), [])).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('gaze scoring', () => {
  it('scores a perfect pursuit recording with zero error', () => {
    const gaze = [];
    for (let t = 0; t <= 4000; t += 50) gaze.push({ ...pursuitTargetAt(t), t });
    const score = scorePursuit(gaze, 4000);
    expect(score.meanError).toBeCloseTo(0, 6);
    expect(score.sampleCount).toBe(gaze.length);
  });

  it('detects the built in lag of a synthetic pursuit trace', () => {
    const gaze = syntheticPursuitTrace(7, 6000, { noise: 0.005, lagMs: 200 });
    const score = scorePursuit(gaze, 6000);
    expect(score.estimatedLagMs).toBeGreaterThanOrEqual(120);
    expect(score.estimatedLagMs).toBeLessThanOrEqual(280);
    expect(score.meanErrorAfterLag).toBeLessThan(score.meanError);
  });

  it('scores saccade trials with hits inside the window only', () => {
    const score = scoreSaccades([
      { jumpAtMs: 0, responseAtMs: 300 },
      { jumpAtMs: 1000, responseAtMs: 900 },
      { jumpAtMs: 2000, responseAtMs: null },
      { jumpAtMs: 3000, responseAtMs: 3400 },
      { jumpAtMs: 4000, responseAtMs: 6000 },
    ]);
    expect(score.trials).toBe(5);
    expect(score.hits).toBe(2);
    expect(score.hitRate).toBeCloseTo(0.4, 6);
    expect(score.medianLatencyMs).toBe(350);
  });

  it('scores gaze holding drift as RMS distance from the fixation point', () => {
    const samples = [
      { x: 0.5, y: 0.5, t: 0 },
      { x: 0.53, y: 0.54, t: 100 },
      { x: 0.47, y: 0.5, t: 200 },
    ];
    const score = scoreHolding(samples, { x: 0.5, y: 0.5 });
    expect(score.sampleCount).toBe(3);
    expect(score.maxDrift).toBeCloseTo(0.05, 6);
    expect(score.rmsDrift).toBeGreaterThan(0);
    expect(score.rmsDrift).toBeLessThan(score.maxDrift);
  });

  it('buckets points into the 3 by 3 zone map', () => {
    const zones = zoneMap([
      { x: 0.1, y: 0.1 },
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.9 },
    ]);
    expect(zones[0]).toMatchObject({ label: 'upper left', count: 2, share: 0.5 });
    expect(zones[4]).toMatchObject({ label: 'center', count: 1 });
    expect(zones[8]).toMatchObject({ label: 'lower right', count: 1 });
    expect(zones.reduce((sum, zone) => sum + zone.count, 0)).toBe(4);
  });

  it('computes median and sampling rate', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(0);
    const samples = [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 500 },
      { x: 0, y: 0, t: 1000 },
    ];
    expect(samplingRateHz(samples)).toBeCloseTo(2, 6);
    expect(samplingRateHz([])).toBe(0);
  });
});
