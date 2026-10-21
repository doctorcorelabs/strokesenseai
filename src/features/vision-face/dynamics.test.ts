import { describe, expect, it } from 'vitest';
import { syntheticFace } from './geometry';
import {
  DYNAMICS_TASKS,
  createSession,
  currentTask,
  faceSignals,
  formatChange,
  isComplete,
  measuredTrace,
  performerLandmarks,
  recordMeasured,
  recordSelfReport,
  setBaseline,
  skipTask,
  summarizeSession,
  syntheticTrace,
  traceBounds,
  tracePath,
  zeroLineY,
} from './dynamics';

function sessionWithBaseline() {
  return setBaseline(createSession(), syntheticFace({}));
}

describe('face signals', () => {
  it('measures a neutral face', () => {
    const signals = faceSignals(syntheticFace({}));
    expect(signals.mouthWidth).toBeCloseTo(0.85, 4);
    expect(signals.browHeight).toBeCloseTo(0.375, 4);
    expect(signals.eyeOpening).toBeCloseTo(0.044 / 0.13, 4);
    expect(signals.lipOpening).toBeCloseTo(0.175, 4);
  });

  it('sees mouth width rise in a smile and eye opening fall in eye close', () => {
    const neutral = faceSignals(syntheticFace({}));
    expect(faceSignals(performerLandmarks('smile', 1)).mouthWidth).toBeGreaterThan(neutral.mouthWidth);
    expect(faceSignals(performerLandmarks('eye-close', 1)).eyeOpening).toBeLessThan(
      neutral.eyeOpening * 0.2,
    );
    expect(faceSignals(performerLandmarks('brow-raise', 1)).browHeight).toBeGreaterThan(
      neutral.browHeight,
    );
    expect(faceSignals(performerLandmarks('cheek-puff', 1)).lipOpening).toBeLessThan(
      neutral.lipOpening,
    );
  });
});

describe('session flow', () => {
  it('starts with the smile task pending', () => {
    const session = createSession();
    expect(session.records).toHaveLength(DYNAMICS_TASKS.length);
    expect(currentTask(session)?.id).toBe('smile');
    expect(isComplete(session)).toBe(false);
  });

  it('refuses to record a measurement without a baseline', () => {
    const session = createSession();
    const after = recordMeasured(session, performerLandmarks('smile', 1));
    expect(after).toBe(session);
  });

  it('records a measured smile against the baseline', () => {
    const session = recordMeasured(sessionWithBaseline(), performerLandmarks('smile', 1));
    const record = session.records[0];
    expect(record?.status).toBe('recorded');
    expect(record?.source).toBe('measured');
    expect(record?.change).not.toBeNull();
    expect(record?.change ?? 0).toBeGreaterThan(0.1);
    expect(currentTask(session)?.id).toBe('brow-raise');
  });

  it('records self reports and skips, then completes', () => {
    let session = sessionWithBaseline();
    session = recordMeasured(session, performerLandmarks('smile', 1));
    session = recordSelfReport(session, 'felt easy');
    expect(session.records[1]?.source).toBe('self-report');
    expect(session.records[1]?.note).toBe('felt easy');
    session = skipTask(session);
    expect(session.records[2]?.status).toBe('skipped');
    session = recordMeasured(session, performerLandmarks('cheek-puff', 1));
    expect(isComplete(session)).toBe(true);
    expect(currentTask(session)).toBeNull();
    const summary = summarizeSession(session);
    expect(summary).toEqual({ recorded: 3, measured: 2, selfReported: 1, skipped: 1, pending: 0 });
  });

  it('keeps the original session immutable', () => {
    const session = sessionWithBaseline();
    recordMeasured(session, performerLandmarks('smile', 1));
    expect(session.records[0]?.status).toBe('pending');
  });
});

describe('synthetic reference traces', () => {
  it('is deterministic and returns to baseline at both ends', () => {
    const a = syntheticTrace('smile');
    const b = syntheticTrace('smile');
    expect(a).toEqual(b);
    expect(a).toHaveLength(11);
    expect(a[0]?.value).toBeCloseTo(0, 6);
    expect(a[a.length - 1]?.value).toBeCloseTo(0, 6);
    expect(Math.max(...a.map((point) => point.value))).toBeGreaterThan(0.1);
  });

  it('eye close trace moves down', () => {
    const trace = syntheticTrace('eye-close');
    expect(Math.min(...trace.map((point) => point.value))).toBeLessThan(-0.2);
  });

  it('builds a measured trace from frames', () => {
    const baseline = faceSignals(syntheticFace({}));
    const trace = measuredTrace(
      'smile',
      [performerLandmarks('smile', 0), performerLandmarks('smile', 1)],
      baseline,
    );
    expect(trace[0]?.value).toBeCloseTo(0, 6);
    expect(trace[1]?.value).toBeGreaterThan(0.1);
    expect(measuredTrace('smile', [], baseline)).toEqual([]);
  });
});

describe('chart helpers', () => {
  it('bounds always include zero and the path stays in the box', () => {
    const trace = syntheticTrace('brow-raise');
    const bounds = traceBounds([trace]);
    expect(bounds.min).toBeLessThan(0);
    expect(bounds.max).toBeGreaterThan(0);
    const path = tracePath(trace, 640, 220, bounds);
    expect(path.startsWith('M')).toBe(true);
    const ys = [...path.matchAll(/,(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(220);
    }
    expect(zeroLineY(220, bounds)).toBeGreaterThan(0);
    expect(zeroLineY(220, bounds)).toBeLessThan(220);
  });

  it('formats changes for display', () => {
    expect(formatChange(null)).toBe('not measured');
    expect(formatChange(0.18)).toBe('+0.180');
    expect(formatChange(-0.05)).toBe('-0.050');
  });
});
