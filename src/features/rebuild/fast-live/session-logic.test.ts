// Unit tests for the FAST Live Check pure logic: window aggregation,
// head pose gating, arm hold summaries, the speech word map, and the
// observation sheet text. Device and model code live in the stage
// components; everything asserted here is deterministic.

import { describe, expect, it } from 'vitest';
import {
  armStageOutcome,
  buildObservationSheetText,
  buildWordMap,
  describeArmHold,
  describeFaceTask,
  faceTaskOutcome,
  headPoseFromMatrix,
  medianOf,
  poseWithinTolerance,
  summarizeArmSide,
  TARGET_SENTENCE,
  type FaceWindowSample,
} from './session-logic';
import type { FastSession } from './types';

describe('medianOf', () => {
  it('returns the middle value for odd counts', () => {
    expect(medianOf([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even counts', () => {
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
  });

  it('returns 0 for an empty list', () => {
    expect(medianOf([])).toBe(0);
  });
});

describe('headPoseFromMatrix', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  it('reads an identity matrix as a straight head', () => {
    const pose = headPoseFromMatrix(identity);
    expect(pose.yawDeg).toBeCloseTo(0);
    expect(pose.pitchDeg).toBeCloseTo(0);
    expect(pose.rollDeg).toBeCloseTo(0);
    expect(poseWithinTolerance(pose)).toBe(true);
  });

  it('reads a yaw rotation about the vertical axis', () => {
    // Ry(20deg), column-major.
    const rad = (20 * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const matrix = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    const pose = headPoseFromMatrix(matrix);
    expect(pose.yawDeg).toBeCloseTo(20, 0);
    expect(poseWithinTolerance(pose)).toBe(false);
  });

  it('reads a roll rotation and fails the tolerance on it', () => {
    // Rz(15deg), column-major.
    const rad = (15 * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const matrix = [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const pose = headPoseFromMatrix(matrix);
    expect(pose.rollDeg).toBeCloseTo(15, 0);
    expect(poseWithinTolerance(pose)).toBe(false);
  });
});

describe('faceTaskOutcome', () => {
  const samples: FaceWindowSample[] = [
    { left: 60, right: 55 },
    { left: 62, right: 58 },
    { left: 64, right: 57 },
  ];

  it('reports medians when at least half the window was usable', () => {
    const outcome = faceTaskOutcome('smile task', samples, 3.6, 0.4, 4);
    expect(outcome.status).toBe('measured');
    if (outcome.status === 'measured') {
      expect(outcome.left).toBe(62);
      expect(outcome.right).toBe(57);
      expect(outcome.usableSeconds).toBe(3.6);
    }
  });

  it('reports could-not when most of the window was excluded', () => {
    const outcome = faceTaskOutcome('smile task', samples, 1.2, 2.8, 4);
    expect(outcome.status).toBe('could-not');
  });

  it('reports could-not when there are no samples at all', () => {
    const outcome = faceTaskOutcome('brow raise task', [], 0, 3, 3);
    expect(outcome.status).toBe('could-not');
  });
});

describe('describeFaceTask', () => {
  it('describes near-equal sides without judging them', () => {
    expect(describeFaceTask(62, 58)).toContain('slightly larger');
    expect(describeFaceTask(50, 52)).toContain('about the same amount');
  });

  it('describes very little movement plainly', () => {
    expect(describeFaceTask(2, 1)).toContain('Very little movement');
  });
});

describe('arm summaries', () => {
  const steady = [
    { t: 0, deg: 88 },
    { t: 0.4, deg: 89 },
    { t: 3, deg: 87 },
    { t: 6, deg: 86 },
    { t: 9.6, deg: 85 },
    { t: 10, deg: 85 },
  ];
  const sinking = [
    { t: 0, deg: 90 },
    { t: 0.4, deg: 90 },
    { t: 3, deg: 86 },
    { t: 6, deg: 82 },
    { t: 9.6, deg: 76 },
    { t: 10, deg: 76 },
  ];

  it('summarizes start, end, change, and the largest sustained drop', () => {
    const summary = summarizeArmSide(sinking, 10);
    expect(summary).not.toBeNull();
    expect(summary?.startDeg).toBe(90);
    expect(summary?.endDeg).toBe(76);
    expect(summary?.changeDeg).toBe(-14);
    expect(summary?.maxDropDeg).toBe(14);
  });

  it('builds a measured stage outcome when both arms stayed visible', () => {
    const outcome = armStageOutcome(steady, sinking, 0.95, 0.9, 10);
    expect(outcome.status).toBe('measured');
    if (outcome.status === 'measured') {
      expect(outcome.left.changeDeg).toBe(-3.5);
      expect(outcome.right.changeDeg).toBe(-14);
      expect(outcome.usableSeconds).toBe(9);
    }
  });

  it('fails the stage and names the side that left the frame', () => {
    const outcome = armStageOutcome(steady, sinking, 0.4, 0.95, 10);
    expect(outcome.status).toBe('could-not');
    if (outcome.status === 'could-not') {
      expect(outcome.reason).toContain('left arm');
    }
  });

  it('describes the hold with magnitudes and decrease notes', () => {
    const text = describeArmHold(
      { startDeg: 88, endDeg: 85, changeDeg: -3, maxDropDeg: 3 },
      { startDeg: 90, endDeg: 76, changeDeg: -14, maxDropDeg: 14 },
      10,
    );
    expect(text).toContain("left arm's angle changed by 3 degrees");
    expect(text).toContain("right arm's by 14 degrees");
    expect(text).toContain('in the camera picture');
  });
});

describe('buildWordMap', () => {
  it('marks a perfect reading as fully written', () => {
    const map = buildWordMap(TARGET_SENTENCE, 'The sky is clear and blue today');
    expect(map.targetCount).toBe(7);
    expect(map.correctCount).toBe(7);
    expect(map.entries.every((entry) => entry.status === 'written')).toBe(true);
  });

  it('marks a substituted word as heard differently, with the heard word', () => {
    const map = buildWordMap(TARGET_SENTENCE, 'The sky is dear and blue today');
    expect(map.correctCount).toBe(6);
    const entry = map.entries.find((item) => item.target === 'clear');
    expect(entry?.status).toBe('differently');
    expect(entry?.heard).toBe('dear');
  });

  it('marks a missing word as not heard and collects extra words', () => {
    const map = buildWordMap(TARGET_SENTENCE, 'The sky is clear and blue uh today');
    const missing = map.entries.find((item) => item.status === 'not-heard');
    expect(missing).toBeUndefined();
    expect(map.extraWords).toContain('uh');
  });

  it('marks a skipped word as not heard', () => {
    const map = buildWordMap(TARGET_SENTENCE, 'The sky is clear and today');
    const entry = map.entries.find((item) => item.target === 'blue');
    expect(entry?.status).toBe('not-heard');
  });
});

describe('buildObservationSheetText', () => {
  const when = new Date('2026-10-22T07:30:00');
  const full: FastSession = {
    face: {
      status: 'measured',
      smile: { status: 'measured', left: 62, right: 58, usableSeconds: 3.6, excludedSeconds: 0.4 },
      brow: { status: 'measured', left: 41, right: 44, usableSeconds: 3, excludedSeconds: 0 },
    },
    arm: {
      status: 'measured',
      left: { startDeg: 88, endDeg: 85, changeDeg: -3, maxDropDeg: 3 },
      right: { startDeg: 90, endDeg: 76, changeDeg: -14, maxDropDeg: 14 },
      usableSeconds: 9.5,
      holdSeconds: 10,
      leftSeries: [],
      rightSeries: [],
    },
    speech: {
      status: 'measured',
      mode: 'recognizer',
      transcript: 'The sky is dear and blue today',
      entries: [],
      correctCount: 6,
      targetCount: 7,
      extraWords: [],
    },
  };

  it('renders the planned format for a full measured session', () => {
    const text = buildObservationSheetText(full, when);
    expect(text).toContain('FAST Check - Observation Sheet');
    expect(text).toContain('call 119 immediately');
    expect(text).toContain('Left side movement (relative): 62    Right side: 58');
    expect(text).toContain('Quality notes: 0.4 seconds were excluded because the head turned.');
    expect(text).toContain('Right arm angle: started 90 deg, ended 76 deg (change 14 deg)');
    expect(text).toContain('(camera-adapted position: arms out to the sides)');
    expect(text).toContain('Transcribed as: "The sky is dear and blue today"');
    expect(text).toContain('Word map: 6 of 7 words transcribed exactly as written.');
    expect(text).toContain('Mode: transcribed by the browser speech recognizer.');
    expect(text).toContain('Nothing on this sheet is a score.');
  });

  it('writes skipped stages as Not recorded and examples as not measured', () => {
    const partial: FastSession = {
      face: { status: 'skipped' },
      arm: { status: 'example' },
      speech: { status: 'skipped' },
    };
    const text = buildObservationSheetText(partial, when);
    expect(text).toContain('Face stage: Not recorded.');
    expect(text).toContain('Arm stage: Watched the guided example (not measured).');
    expect(text).toContain('Speech stage: Not recorded.');
  });

  it('writes could-not stages with their reasons, and typed speech honestly', () => {
    const session: FastSession = {
      face: {
        status: 'could-not',
        reason: 'A steady resting face could not be recorded.',
        suggestion: 'Try again in brighter light.',
      },
      arm: { status: 'skipped' },
      speech: {
        status: 'measured',
        mode: 'typed',
        transcript: 'The sky is clear and blue today',
        entries: [],
        correctCount: 7,
        targetCount: 7,
        extraWords: [],
      },
    };
    const text = buildObservationSheetText(session, when);
    expect(text).toContain('Face stage: Could not be measured. A steady resting face');
    expect(text).toContain('Mode: typed from memory, not transcribed from speech.');
    expect(text).not.toContain('Transcribed as');
  });
});
