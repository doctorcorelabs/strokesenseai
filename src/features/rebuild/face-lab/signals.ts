// Pure face-signal math for Face Lab.
//
// This module turns one frame of MediaPipe Face Landmarker output
// (blendshape scores plus, optionally, the 478 landmarks) into three
// per-side movement readings on a relative 0-100 scale: smile, brow
// raise, and cheek. The functions are pure and deterministic so FAST
// Live Check can reuse exactly the same measurement code, and so the
// side behaviour can be proven with synthetic faces in signals.test.ts.
//
// SIDE CONVENTION - the single source of truth for this lab:
//
// Labels always follow the SUBJECT (the person in front of the
// camera), never the viewer and never the screen. Two different data
// sources need two different mappings, both centralised here:
//
// 1. Blendshapes. The FaceLandmarker result type documents that the
//    *Left and *Right categories "correspond to the subject's face,
//    not the viewer", so mouthSmileLeft is the subject's own left
//    smile. subjectSideOfBlendshape() below is the one place that
//    reads this convention.
// 2. Landmark geometry. Landmarks live in raw image coordinates of
//    the unmirrored camera frame. A person facing the camera has
//    their anatomical left on the image's right side (larger x), so
//    geometry sides are assigned by comparing x against the face
//    midline instead of trusting any fixed landmark index. A corner
//    or brow group is the subject's left exactly when it sits at the
//    larger image x.
//
// The camera preview in Face Lab is displayed mirrored (selfie view),
// and the overlay drawing mirrors landmark x to match, so what the
// person sees lines up with these subject-side labels.
//
// The numbers are RELATIVE movement readings for practice feedback.
// They are not percentages of muscle strength, not symmetry scores,
// and no threshold in this file is a clinical cut-off.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export type BlendshapeInput = Map<string, number> | Record<string, number>;

export interface SideMovement {
  /** Subject's left side, relative scale 0-100. */
  left: number;
  /** Subject's right side, relative scale 0-100. */
  right: number;
}

export interface FaceSignals {
  smile: SideMovement;
  brow: SideMovement;
  cheek: SideMovement;
}

export type SubjectSide = 'left' | 'right';

// Landmark indices (MediaPipe face mesh, 478 points with iris).
const EYE_A = 33; // reference point of the eye paired with brow group A
const EYE_B = 263; // reference point of the eye paired with brow group B
const MOUTH_CORNER_A = 61;
const MOUTH_CORNER_B = 291;
const LIP_TOP = 0;
const LIP_BOTTOM = 17;
const BROW_GROUP_A = [70, 63, 105, 66, 107];
const BROW_GROUP_B = [336, 296, 334, 293, 300];

// Geometry needs the highest index used above to be present.
const MIN_LANDMARKS = 337;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function toScale(value: number): number {
  return Math.round(clamp01(value) * 100);
}

function blendshapeScore(input: BlendshapeInput, name: string): number {
  const raw = input instanceof Map ? input.get(name) : input[name];
  return clamp01(typeof raw === 'number' ? raw : 0);
}

/**
 * The one blendshape-to-subject-side mapping. Returns the subject side
 * a paired blendshape category belongs to, or null for unpaired
 * categories such as cheekPuff. If field testing ever shows the
 * convention inverted on real hardware, this function is the single
 * place to flip.
 */
export function subjectSideOfBlendshape(categoryName: string): SubjectSide | null {
  if (categoryName.endsWith('Left')) return 'left';
  if (categoryName.endsWith('Right')) return 'right';
  return null;
}

/**
 * Movement of `current` relative to a resting `baseline`, on the same
 * 0-100 scale. Never negative: a side that moved less than its own
 * resting reading reports 0, not a negative amount.
 */
export function relativeMovement(current: number, baseline: number): number {
  const delta = (Number.isFinite(current) ? current : 0) - (Number.isFinite(baseline) ? baseline : 0);
  return Math.round(Math.min(100, Math.max(0, delta)));
}

interface FaceGeometry {
  interEye: number;
  midX: number;
  /** Mouth corner on the subject's left (larger image x). */
  mouthLeft: NormalizedLandmark;
  /** Mouth corner on the subject's right (smaller image x). */
  mouthRight: NormalizedLandmark;
  mouthCenterY: number;
  /** Brow-to-eye vertical gap for the subject's left, in inter-eye units. */
  browGapLeft: number;
  /** Brow-to-eye vertical gap for the subject's right, in inter-eye units. */
  browGapRight: number;
}

function browGap(
  landmarks: NormalizedLandmark[],
  group: number[],
  eyeIndex: number,
  interEye: number,
): number {
  const browY = group.reduce((sum, index) => sum + landmarks[index].y, 0) / group.length;
  return (landmarks[eyeIndex].y - browY) / interEye;
}

function faceGeometry(landmarks: NormalizedLandmark[]): FaceGeometry | null {
  if (landmarks.length < MIN_LANDMARKS) return null;
  const eyeA = landmarks[EYE_A];
  const eyeB = landmarks[EYE_B];
  const interEye = Math.hypot(eyeA.x - eyeB.x, eyeA.y - eyeB.y);
  if (!Number.isFinite(interEye) || interEye < 1e-6) return null;
  const midX = (eyeA.x + eyeB.x) / 2;

  const cornerA = landmarks[MOUTH_CORNER_A];
  const cornerB = landmarks[MOUTH_CORNER_B];
  // Subject's left is the corner at the larger image x (see header).
  const mouthLeft = cornerA.x >= cornerB.x ? cornerA : cornerB;
  const mouthRight = cornerA.x >= cornerB.x ? cornerB : cornerA;

  // Brow group A belongs with eye A and group B with eye B in mesh
  // space; whichever pair sits at the larger image x is the subject's
  // left pair.
  const gapA = browGap(landmarks, BROW_GROUP_A, EYE_A, interEye);
  const gapB = browGap(landmarks, BROW_GROUP_B, EYE_B, interEye);
  const aIsSubjectLeft = eyeA.x >= eyeB.x;

  return {
    interEye,
    midX,
    mouthLeft,
    mouthRight,
    mouthCenterY: (landmarks[LIP_TOP].y + landmarks[LIP_BOTTOM].y) / 2,
    browGapLeft: aIsSubjectLeft ? gapA : gapB,
    browGapRight: aIsSubjectLeft ? gapB : gapA,
  };
}

function smileGeometry(corner: NormalizedLandmark, geometry: FaceGeometry): number {
  // Corners lift above the mouth centre line and pull outward when a
  // smile grows. Both parts are measured in inter-eye units so the
  // reading does not depend on how far the face is from the camera.
  const lift = (geometry.mouthCenterY - corner.y) / geometry.interEye;
  const outward = Math.abs(corner.x - geometry.midX) / geometry.interEye;
  return toScale(2.4 * lift + 0.9 * Math.max(0, outward - 0.42));
}

function browGeometry(gap: number): number {
  // A resting brow-to-eye gap sits near 0.3 inter-eye units; raising
  // the brow widens it. The offset is removed later against the
  // person's own baseline by relativeMovement().
  return toScale((gap - 0.28) * 1.8);
}

function usableLandmarks(
  landmarks: NormalizedLandmark[] | undefined,
): NormalizedLandmark[] | null {
  if (!landmarks || landmarks.length < MIN_LANDMARKS) return null;
  return landmarks;
}

/**
 * Smile movement per subject side, relative scale 0-100. Combines the
 * paired smile blendshapes with the geometric lift and stretch of
 * each mouth corner; without landmarks it falls back to the
 * blendshapes alone. Subtract the resting reading with
 * relativeMovement() before showing the value as mission movement.
 */
export function computeSmileMovement(
  blendshapes: BlendshapeInput,
  landmarks?: NormalizedLandmark[],
): SideMovement {
  const blendLeft = toScale(blendshapeScore(blendshapes, 'mouthSmileLeft'));
  const blendRight = toScale(blendshapeScore(blendshapes, 'mouthSmileRight'));
  const usable = usableLandmarks(landmarks);
  if (!usable) return { left: blendLeft, right: blendRight };
  const geometry = faceGeometry(usable);
  if (!geometry) return { left: blendLeft, right: blendRight };
  return {
    left: Math.round((blendLeft + smileGeometry(geometry.mouthLeft, geometry)) / 2),
    right: Math.round((blendRight + smileGeometry(geometry.mouthRight, geometry)) / 2),
  };
}

/**
 * Brow raise movement per subject side, relative scale 0-100.
 * Combines the paired browOuterUp blendshapes with the geometric
 * brow-to-eye gap per side. Note: the blendshape set has only a
 * combined browInnerUp with no per-side version, so the inner brow
 * contributes through geometry only.
 */
export function computeBrowMovement(
  blendshapes: BlendshapeInput,
  landmarks?: NormalizedLandmark[],
): SideMovement {
  const blendLeft = toScale(blendshapeScore(blendshapes, 'browOuterUpLeft'));
  const blendRight = toScale(blendshapeScore(blendshapes, 'browOuterUpRight'));
  const usable = usableLandmarks(landmarks);
  if (!usable) return { left: blendLeft, right: blendRight };
  const geometry = faceGeometry(usable);
  if (!geometry) return { left: blendLeft, right: blendRight };
  return {
    left: Math.round((blendLeft + browGeometry(geometry.browGapLeft)) / 2),
    right: Math.round((blendRight + browGeometry(geometry.browGapRight)) / 2),
  };
}

/**
 * Cheek movement per subject side, relative scale 0-100, from the
 * paired cheekSquint blendshapes. The single shared cheekPuff score
 * is added equally to both sides, so it can raise both readings but
 * can never create a difference between them.
 */
export function computeCheekMovement(blendshapes: BlendshapeInput): SideMovement {
  const puff = blendshapeScore(blendshapes, 'cheekPuff');
  const combine = (squintName: string) =>
    toScale(0.65 * blendshapeScore(blendshapes, squintName) + 0.35 * puff);
  return { left: combine('cheekSquintLeft'), right: combine('cheekSquintRight') };
}

/** All three mission signals for one frame, in one call. */
export function computeFaceSignals(
  blendshapes: BlendshapeInput,
  landmarks?: NormalizedLandmark[],
): FaceSignals {
  return {
    smile: computeSmileMovement(blendshapes, landmarks),
    brow: computeBrowMovement(blendshapes, landmarks),
    cheek: computeCheekMovement(blendshapes),
  };
}
