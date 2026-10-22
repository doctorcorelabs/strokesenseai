import { describe, expect, it } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  computeBrowMovement,
  computeCheekMovement,
  computeSmileMovement,
  relativeMovement,
  subjectSideOfBlendshape,
  type BlendshapeInput,
} from './signals';

// Synthetic faces in raw camera image coordinates. The face looks at
// the camera, so the SUBJECT's left side sits at the larger image x:
// landmark 291 (image-right mouth corner) and brow group B around
// landmark 263 are the subject's left; landmark 61 and brow group A
// around landmark 33 are the subject's right. Every one-sided case
// below moves only the subject's left and expects the left reading to
// win, which is what proves the sides are not swapped.

type Point = { x: number; y: number };

const BASE_POINTS: Record<number, Point> = {
  33: { x: 0.38, y: 0.45 }, // eye A (image left)
  263: { x: 0.62, y: 0.45 }, // eye B (image right)
  0: { x: 0.5, y: 0.6 }, // top of the lips
  17: { x: 0.5, y: 0.65 }, // bottom of the lips
  61: { x: 0.41, y: 0.62 }, // mouth corner, image left (subject right)
  291: { x: 0.59, y: 0.62 }, // mouth corner, image right (subject left)
  // Brow group A around eye 33
  70: { x: 0.33, y: 0.36 },
  63: { x: 0.36, y: 0.35 },
  105: { x: 0.38, y: 0.345 },
  66: { x: 0.4, y: 0.35 },
  107: { x: 0.42, y: 0.36 },
  // Brow group B around eye 263
  336: { x: 0.58, y: 0.36 },
  296: { x: 0.6, y: 0.35 },
  334: { x: 0.62, y: 0.345 },
  293: { x: 0.64, y: 0.35 },
  300: { x: 0.67, y: 0.36 },
};

function makeLandmarks(overrides: Record<number, Point> = {}): NormalizedLandmark[] {
  const points: NormalizedLandmark[] = Array.from({ length: 478 }, () => ({
    x: 0.5,
    y: 0.52,
    z: 0,
    visibility: 1,
  }));
  for (const [index, point] of Object.entries({ ...BASE_POINTS, ...overrides })) {
    points[Number(index)] = { x: point.x, y: point.y, z: 0, visibility: 1 };
  }
  return points;
}

const NEUTRAL_BLENDSHAPES: BlendshapeInput = {
  mouthSmileLeft: 0.04,
  mouthSmileRight: 0.04,
  browOuterUpLeft: 0.05,
  browOuterUpRight: 0.05,
  cheekSquintLeft: 0.03,
  cheekSquintRight: 0.03,
  cheekPuff: 0.02,
};

describe('subjectSideOfBlendshape', () => {
  it('maps paired categories to the subject side in their name', () => {
    expect(subjectSideOfBlendshape('mouthSmileLeft')).toBe('left');
    expect(subjectSideOfBlendshape('browOuterUpRight')).toBe('right');
  });

  it('returns null for unpaired categories', () => {
    expect(subjectSideOfBlendshape('cheekPuff')).toBeNull();
    expect(subjectSideOfBlendshape('jawOpen')).toBeNull();
  });
});

describe('relativeMovement', () => {
  it('subtracts the baseline and never goes negative', () => {
    expect(relativeMovement(70, 10)).toBe(60);
    expect(relativeMovement(10, 70)).toBe(0);
    expect(relativeMovement(0, 0)).toBe(0);
  });

  it('caps the result at 100', () => {
    expect(relativeMovement(140, 10)).toBe(100);
  });
});

describe('computeSmileMovement', () => {
  it('reads a neutral face as low and even', () => {
    const result = computeSmileMovement(NEUTRAL_BLENDSHAPES, makeLandmarks());
    expect(result.left).toBe(result.right);
    expect(result.left).toBeLessThan(15);
  });

  it('credits a one-sided smile to the subject side that moved', () => {
    const landmarks = makeLandmarks({
      // Subject's left corner (image right) lifts and pulls outward.
      291: { x: 0.615, y: 0.565 },
    });
    const result = computeSmileMovement(
      { ...NEUTRAL_BLENDSHAPES, mouthSmileLeft: 0.85 },
      landmarks,
    );
    expect(result.left).toBeGreaterThan(result.right + 40);
  });

  it('reads a symmetric smile as high and even', () => {
    const landmarks = makeLandmarks({
      61: { x: 0.385, y: 0.565 },
      291: { x: 0.615, y: 0.565 },
    });
    const result = computeSmileMovement(
      { mouthSmileLeft: 0.8, mouthSmileRight: 0.8 },
      landmarks,
    );
    expect(Math.abs(result.left - result.right)).toBeLessThanOrEqual(2);
    expect(result.left).toBeGreaterThanOrEqual(60);
  });

  it('works from blendshapes alone, including Map input', () => {
    const fromRecord = computeSmileMovement({ mouthSmileLeft: 0.5, mouthSmileRight: 0.25 });
    expect(fromRecord).toEqual({ left: 50, right: 25 });
    const fromMap = computeSmileMovement(
      new Map([
        ['mouthSmileLeft', 0.5],
        ['mouthSmileRight', 0.25],
      ]),
    );
    expect(fromMap).toEqual({ left: 50, right: 25 });
  });
});

describe('computeBrowMovement', () => {
  it('reads a neutral brow as even', () => {
    const result = computeBrowMovement(NEUTRAL_BLENDSHAPES, makeLandmarks());
    expect(result.left).toBe(result.right);
  });

  it('credits a one-sided brow raise to the subject side that moved', () => {
    const raised = Object.fromEntries(
      [336, 296, 334, 293, 300].map((index) => {
        const point = BASE_POINTS[index];
        return [index, { x: point.x, y: point.y - 0.045 }];
      }),
    );
    const result = computeBrowMovement(
      { ...NEUTRAL_BLENDSHAPES, browOuterUpLeft: 0.75 },
      makeLandmarks(raised),
    );
    expect(result.left).toBeGreaterThan(result.right + 30);
  });
});

describe('computeCheekMovement', () => {
  it('keeps the sides separate through the squint scores', () => {
    const result = computeCheekMovement({
      cheekSquintLeft: 0.6,
      cheekSquintRight: 0.1,
      cheekPuff: 0.5,
    });
    expect(result.left).toBeGreaterThan(result.right);
  });

  it('never lets the shared cheekPuff score create a difference', () => {
    const result = computeCheekMovement({ cheekPuff: 1 });
    expect(result.left).toBe(result.right);
    expect(result.left).toBe(35);
  });
});
