import { describe, expect, it } from 'vitest';
import {
  STROKE_CODE_SCENARIOS,
  addMinutesToClock,
  applyChoice,
  computeResults,
  createRun,
  getStrokeCodeScenario,
  replayChoices,
} from './strokeCode';

describe('scenario bank integrity', () => {
  it('has unique scenario, step, and option ids with valid points', () => {
    const scenarioIds = new Set<string>();
    for (const scenario of STROKE_CODE_SCENARIOS) {
      expect(scenarioIds.has(scenario.id)).toBe(false);
      scenarioIds.add(scenario.id);
      const stepIds = new Set<string>();
      for (const step of scenario.steps) {
        expect(stepIds.has(step.id)).toBe(false);
        stepIds.add(step.id);
        expect(step.options.length).toBeGreaterThanOrEqual(3);
        const optionIds = new Set<string>();
        for (const option of step.options) {
          expect(optionIds.has(option.id)).toBe(false);
          optionIds.add(option.id);
          expect(option.points).toBeGreaterThanOrEqual(0);
          expect(option.points).toBeLessThanOrEqual(step.maxPoints);
          expect(option.minutes).toBeGreaterThanOrEqual(0);
          if (option.verdict === 'optimal') expect(option.points).toBe(step.maxPoints);
          if (option.verdict === 'critical') expect(option.points).toBe(0);
        }
      }
    }
  });
});

describe('engine mechanics', () => {
  const classic = getStrokeCodeScenario('scenario-classic');

  it('starts at zero with nothing recorded', () => {
    const run = createRun(classic);
    expect(run.elapsed).toBe(0);
    expect(run.points).toBe(0);
    expect(run.finished).toBe(false);
    expect(run.entries).toEqual([]);
  });

  it('advances time, points, and milestones without mutating the input state', () => {
    const start = createRun(classic);
    const after = applyChoice(classic, start, 'activate');
    expect(start.elapsed).toBe(0);
    expect(start.entries).toHaveLength(0);
    expect(after.elapsed).toBe(5);
    expect(after.stepIndex).toBe(1);
    expect(after.entries).toHaveLength(1);
    expect(after.entries[0]?.startAt).toBe(0);
    expect(after.entries[0]?.endAt).toBe(5);
  });

  it('ignores unknown options and choices after the run is finished', () => {
    const start = createRun(classic);
    expect(applyChoice(classic, start, 'not-a-real-option')).toBe(start);
    const done = replayChoices(classic, [
      'activate',
      'glucose',
      'ct-cta',
      'proceed',
      'both',
      'structured',
    ]);
    expect(done.finished).toBe(true);
    expect(applyChoice(classic, done, 'activate')).toBe(done);
  });

  it('records a milestone only the first time it is reached', () => {
    // MRI option also carries the ct milestone; a later needle choice must
    // not move the ct milestone.
    const run = replayChoices(classic, ['activate', 'glucose', 'mri-first']);
    expect(run.milestones.ct).toBe(42);
  });
});

describe('classic scenario paths', () => {
  const classic = getStrokeCodeScenario('scenario-classic');

  it('optimal path meets every target with a top score', () => {
    const run = replayChoices(classic, [
      'activate',
      'glucose',
      'ct-cta',
      'proceed',
      'both',
      'structured',
    ]);
    const results = computeResults(classic, run);
    expect(run.finished).toBe(true);
    expect(results.doorToCT).toBe(22);
    expect(results.doorToNeedle).toBe(32);
    expect(results.lkwToNeedle).toBe(82);
    expect(results.targetChecks.every((check) => check.met === true)).toBe(true);
    expect(results.critical).toEqual([]);
    expect(results.scorePct).toBe(100);
    expect(results.grade).toContain('Excellent');
    expect(run.flags).toContain('glucose-checked');
    expect(run.flags).toContain('thrombectomy-activated');
  });

  it('a slow path misses the door to needle target', () => {
    const run = replayChoices(classic, [
      'full-exam-first',
      'ecg-first',
      'mri-first',
      'lower-hard',
      'both',
      'brief',
    ]);
    const results = computeResults(classic, run);
    const needle = results.targetChecks.find((check) => check.id === 'd2n');
    expect(results.doorToNeedle).toBe(80);
    expect(needle?.met).toBe(false);
    expect(results.critical).toEqual([]);
  });

  it('a critical choice caps the score and is named in the debrief', () => {
    const run = replayChoices(classic, [
      'wait-labs',
      'glucose',
      'ct-cta',
      'proceed',
      'both',
      'structured',
    ]);
    const results = computeResults(classic, run);
    expect(results.critical).toHaveLength(1);
    expect(results.rawScorePct).toBeGreaterThan(49);
    expect(results.scorePct).toBe(49);
    expect(results.grade).toContain('Unsafe path');
    expect(results.debrief.join(' ')).toContain('critical');
  });

  it('giving aspirin before imaging is critical', () => {
    const run = replayChoices(classic, ['activate', 'aspirin-now']);
    expect(run.critical).toHaveLength(1);
    expect(run.critical[0]).toContain('hemorrhage');
  });

  it('skipping the glucose check is flagged in the debrief', () => {
    const run = replayChoices(classic, [
      'activate',
      'skip-checks',
      'ct-cta',
      'proceed',
      'both',
      'structured',
    ]);
    const results = computeResults(classic, run);
    expect(results.debrief.join(' ')).toContain('glucose was never checked');
  });
});

describe('wake-up scenario paths', () => {
  const wakeup = getStrokeCodeScenario('scenario-wakeup');

  it('optimal path anchors on last known well and reaches puncture in target', () => {
    const run = replayChoices(wakeup, [
      'lkw',
      'activate',
      'glucose',
      'ct-cta',
      'mt-eval',
      'wheels-now',
    ]);
    const results = computeResults(wakeup, run);
    expect(results.critical).toEqual([]);
    expect(results.doorToCT).toBe(24);
    expect(results.doorToGroin).toBe(74);
    expect(results.doorToNeedle).toBeNull();
    expect(results.targetChecks.every((check) => check.met === true)).toBe(true);
    expect(results.scorePct).toBe(100);
  });

  it('anchoring on the discovery time is a critical error', () => {
    const run = replayChoices(wakeup, ['found']);
    expect(run.critical).toHaveLength(1);
    expect(run.critical[0]).toContain('wake-up');
  });

  it('giving IV thrombolysis counted from discovery time is critical', () => {
    const run = replayChoices(wakeup, [
      'lkw',
      'activate',
      'glucose',
      'ct-cta',
      'iv-by-discovery',
      'wheels-now',
    ]);
    const results = computeResults(wakeup, run);
    expect(results.critical).toHaveLength(1);
    expect(results.scorePct).toBeLessThanOrEqual(49);
  });
});

describe('complicated scenario paths', () => {
  const complicated = getStrokeCodeScenario('scenario-complicated');

  it('optimal path avoids the drug and reaches puncture in target', () => {
    const run = replayChoices(complicated, [
      'activate',
      'ask-both',
      'glucose',
      'ct-cta',
      'mt-only-safe',
      'wheels-now',
    ]);
    const results = computeResults(complicated, run);
    expect(results.critical).toEqual([]);
    expect(results.doorToCT).toBe(25);
    expect(results.doorToGroin).toBe(75);
    expect(results.doorToNeedle).toBeNull();
    expect(results.targetChecks.every((check) => check.met === true)).toBe(true);
    expect(results.scorePct).toBe(100);
    expect(run.flags).toContain('contraindications-known');
  });

  it('giving IV thrombolysis despite two contraindications is critical', () => {
    const run = replayChoices(complicated, [
      'activate',
      'ask-both',
      'glucose',
      'ct-cta',
      'iv-lytic',
      'wheels-now',
    ]);
    expect(run.critical).toHaveLength(1);
    expect(run.critical[0]).toContain('contraindications');
  });

  it('reversal followed by thrombolysis is also critical', () => {
    const run = replayChoices(complicated, [
      'activate',
      'ask-both',
      'glucose',
      'ct-cta',
      'reversal-then-lytic',
      'wheels-now',
    ]);
    expect(run.critical).toHaveLength(1);
  });
});

describe('addMinutesToClock', () => {
  it('adds minutes within the day and across midnight', () => {
    expect(addMinutesToClock('09:00', 35)).toBe('09:35');
    expect(addMinutesToClock('09:00', 0)).toBe('09:00');
    expect(addMinutesToClock('23:50', 20)).toBe('00:10');
    expect(addMinutesToClock('07:15', 495)).toBe('15:30');
  });
});
