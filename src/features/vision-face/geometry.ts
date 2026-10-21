// Pure geometry for the Face Symmetry Analyzer v2.
//
// Everything in this file is deterministic arithmetic on landmark points.
// There is deliberately no diagnostic output here: the functions describe
// the geometry of an image (distances, ratios, angles) and check whether
// an image is measurable at all. They never classify a face, never label
// a pattern, and never produce a symmetry verdict.
//
// Coordinate convention: points are normalized to the image (0..1 on both
// axes, y pointing down). "Left" and "right" always mean the left and
// right of the image as you look at it, never the person's anatomy.

export interface FacePoint {
  x: number;
  y: number;
}

/** The 16 landmarks this lab works with, all placed or generated locally. */
export interface FaceLandmarks {
  leftEyeOuter: FacePoint;
  leftEyeInner: FacePoint;
  leftEyeTop: FacePoint;
  leftEyeBottom: FacePoint;
  rightEyeOuter: FacePoint;
  rightEyeInner: FacePoint;
  rightEyeTop: FacePoint;
  rightEyeBottom: FacePoint;
  leftBrow: FacePoint;
  rightBrow: FacePoint;
  noseTip: FacePoint;
  mouthLeft: FacePoint;
  mouthRight: FacePoint;
  mouthTop: FacePoint;
  mouthBottom: FacePoint;
  chin: FacePoint;
}

export type LandmarkKey = keyof FaceLandmarks;

export const LANDMARK_KEYS: LandmarkKey[] = [
  'leftEyeOuter',
  'leftEyeInner',
  'leftEyeTop',
  'leftEyeBottom',
  'rightEyeOuter',
  'rightEyeInner',
  'rightEyeTop',
  'rightEyeBottom',
  'leftBrow',
  'rightBrow',
  'noseTip',
  'mouthLeft',
  'mouthRight',
  'mouthTop',
  'mouthBottom',
  'chin',
];

/** Plain-language placement labels, in the order a person places them. */
export const LANDMARK_LABELS: Record<LandmarkKey, string> = {
  leftEyeOuter: 'Outer corner of the eye on the left of the image',
  leftEyeInner: 'Inner corner of the eye on the left of the image',
  leftEyeTop: 'Middle of the upper eyelid, left of the image',
  leftEyeBottom: 'Middle of the lower eyelid, left of the image',
  rightEyeOuter: 'Outer corner of the eye on the right of the image',
  rightEyeInner: 'Inner corner of the eye on the right of the image',
  rightEyeTop: 'Middle of the upper eyelid, right of the image',
  rightEyeBottom: 'Middle of the lower eyelid, right of the image',
  leftBrow: 'Highest point of the brow on the left of the image',
  rightBrow: 'Highest point of the brow on the right of the image',
  noseTip: 'Tip of the nose',
  mouthLeft: 'Corner of the mouth on the left of the image',
  mouthRight: 'Corner of the mouth on the right of the image',
  mouthTop: 'Middle of the upper lip',
  mouthBottom: 'Middle of the lower lip',
  chin: 'Lowest point of the chin',
};

export function distance(a: FacePoint, b: FacePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: FacePoint, b: FacePoint): FacePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Center of one eye, from its four landmarks. */
export function eyeCenter(lm: FaceLandmarks, side: 'left' | 'right'): FacePoint {
  const outer = side === 'left' ? lm.leftEyeOuter : lm.rightEyeOuter;
  const inner = side === 'left' ? lm.leftEyeInner : lm.rightEyeInner;
  const top = side === 'left' ? lm.leftEyeTop : lm.rightEyeTop;
  const bottom = side === 'left' ? lm.leftEyeBottom : lm.rightEyeBottom;
  return { x: (outer.x + inner.x) / 2, y: (top.y + bottom.y) / 2 };
}

/** Vertical opening of one eye divided by its width. Unitless. */
export function eyeAperture(lm: FaceLandmarks, side: 'left' | 'right'): number {
  const outer = side === 'left' ? lm.leftEyeOuter : lm.rightEyeOuter;
  const inner = side === 'left' ? lm.leftEyeInner : lm.rightEyeInner;
  const top = side === 'left' ? lm.leftEyeTop : lm.rightEyeTop;
  const bottom = side === 'left' ? lm.leftEyeBottom : lm.rightEyeBottom;
  const width = distance(outer, inner);
  if (width <= 0) return 0;
  return distance(top, bottom) / width;
}

/** Distance between the two eye centers, as a fraction of image width. */
export function interEyeDistance(lm: FaceLandmarks): number {
  return distance(eyeCenter(lm, 'left'), eyeCenter(lm, 'right'));
}

/** Head roll in degrees: the tilt of the line between the eye centers. */
export function headRollDeg(lm: FaceLandmarks): number {
  const left = eyeCenter(lm, 'left');
  const right = eyeCenter(lm, 'right');
  return (Math.atan2(right.y - left.y, right.x - left.x) * 180) / Math.PI;
}

/**
 * A rough yaw proxy: how far the nose tip sits from the midpoint between
 * the eyes, in units of half the inter-eye distance. 0 means centered.
 * This is a pose description only; it is not a measurement of the head
 * in 3D and it is never used as a finding.
 */
export function yawProxy(lm: FaceLandmarks): number {
  const mid = midpoint(eyeCenter(lm, 'left'), eyeCenter(lm, 'right'));
  const half = interEyeDistance(lm) / 2;
  if (half <= 0) return 0;
  return (lm.noseTip.x - mid.x) / half;
}

// ---------------------------------------------------------------------------
// Quality gate
// ---------------------------------------------------------------------------

export const QUALITY_THRESHOLDS = {
  /** Inter-eye distance below this fraction of image width: cannot analyze. */
  minInterEye: 0.07,
  /** Below this the face is measurable but marked low confidence. */
  lowInterEye: 0.11,
  maxRollDeg: 12,
  lowRollDeg: 6,
  maxYaw: 0.5,
  lowYaw: 0.28,
  /** Laplacian variance of the face region (see imageStats.ts). */
  minSharpness: 60,
  lowSharpness: 140,
  /** min/max mean luminance of the two halves of the face region. */
  minLightingBalance: 0.45,
  lowLightingBalance: 0.65,
} as const;

export interface QualityCheck {
  id: string;
  label: string;
  level: 'pass' | 'low' | 'fail';
  detail: string;
}

export interface QualityReport {
  status: 'good' | 'low' | 'cannot';
  checks: QualityCheck[];
}

export interface AnalysisInput {
  /** How many faces were found or placed. Anything but exactly 1 fails. */
  faceCount: number;
  landmarks: FaceLandmarks | null;
  /** Optional Laplacian variance of the face region (photo and camera). */
  sharpness?: number;
  /** Optional left/right lighting balance ratio, 0..1 (photo and camera). */
  lightingBalance?: number;
}

export type AnalysisResult =
  | { status: 'cannot'; report: QualityReport }
  | { status: 'good' | 'low'; report: QualityReport; metrics: FaceMetrics };

function overallStatus(checks: QualityCheck[]): QualityReport['status'] {
  if (checks.some((check) => check.level === 'fail')) return 'cannot';
  if (checks.some((check) => check.level === 'low')) return 'low';
  return 'good';
}

/** Basic anatomical ordering; nonsense placements fail instead of measuring. */
function plausibilityProblem(lm: FaceLandmarks): string | null {
  const left = eyeCenter(lm, 'left');
  const right = eyeCenter(lm, 'right');
  if (right.x <= left.x) return 'The eye on the right of the image was placed left of the other eye.';
  if (lm.noseTip.y <= Math.max(left.y, right.y)) return 'The nose tip was placed above the eyes.';
  if (lm.mouthTop.y <= lm.noseTip.y) return 'The mouth was placed above the nose tip.';
  if (lm.mouthBottom.y < lm.mouthTop.y) return 'The lower lip was placed above the upper lip.';
  if (lm.chin.y <= lm.mouthBottom.y) return 'The chin was placed above the lower lip.';
  if (lm.leftBrow.y >= left.y || lm.rightBrow.y >= right.y)
    return 'A brow point was placed at or below its eye.';
  return null;
}

/**
 * Run the quality gate. A single failing check means no metrics at all:
 * the caller shows "cannot analyze" with the specific reasons. Borderline
 * checks downgrade the report to low confidence instead of failing.
 */
export function qualityGate(input: AnalysisInput): QualityReport {
  const checks: QualityCheck[] = [];
  const t = QUALITY_THRESHOLDS;

  if (input.faceCount !== 1) {
    checks.push({
      id: 'face-count',
      label: 'Exactly one face',
      level: 'fail',
      detail:
        input.faceCount === 0
          ? 'No face landmarks were provided.'
          : `${input.faceCount} faces were provided; this lab measures one face at a time.`,
    });
    return { status: 'cannot', checks };
  }
  checks.push({
    id: 'face-count',
    label: 'Exactly one face',
    level: 'pass',
    detail: 'One face.',
  });

  const lm = input.landmarks;
  if (!lm) {
    checks.push({
      id: 'landmarks',
      label: 'Landmarks placed',
      level: 'fail',
      detail: 'No landmarks are available for this image yet.',
    });
    return { status: 'cannot', checks };
  }

  const problem = plausibilityProblem(lm);
  checks.push({
    id: 'plausibility',
    label: 'Landmark arrangement',
    level: problem ? 'fail' : 'pass',
    detail: problem ?? 'Landmarks are in a plausible arrangement.',
  });

  const ied = interEyeDistance(lm);
  checks.push({
    id: 'face-size',
    label: 'Face size in the image',
    level: ied < t.minInterEye ? 'fail' : ied < t.lowInterEye ? 'low' : 'pass',
    detail: `Distance between the eyes is ${(ied * 100).toFixed(1)} percent of the image width.`,
  });

  const roll = Math.abs(headRollDeg(lm));
  checks.push({
    id: 'roll',
    label: 'Head tilt (roll)',
    level: roll > t.maxRollDeg ? 'fail' : roll > t.lowRollDeg ? 'low' : 'pass',
    detail: `The eye line tilts about ${roll.toFixed(1)} degrees from horizontal.`,
  });

  const yaw = Math.abs(yawProxy(lm));
  checks.push({
    id: 'yaw',
    label: 'Head turn (yaw estimate)',
    level: yaw > t.maxYaw ? 'fail' : yaw > t.lowYaw ? 'low' : 'pass',
    detail:
      yaw <= t.lowYaw
        ? 'The nose sits close to the center between the eyes.'
        : 'The nose sits noticeably off-center between the eyes, which changes apparent distances.',
  });

  if (typeof input.sharpness === 'number') {
    checks.push({
      id: 'sharpness',
      label: 'Sharpness',
      level:
        input.sharpness < t.minSharpness ? 'fail' : input.sharpness < t.lowSharpness ? 'low' : 'pass',
      detail: `Edge detail score ${Math.round(input.sharpness)} (higher is sharper).`,
    });
  }

  if (typeof input.lightingBalance === 'number') {
    checks.push({
      id: 'lighting',
      label: 'Lighting balance',
      level:
        input.lightingBalance < t.minLightingBalance
          ? 'fail'
          : input.lightingBalance < t.lowLightingBalance
            ? 'low'
            : 'pass',
      detail: `The darker half of the face region is ${Math.round(input.lightingBalance * 100)} percent as bright as the lighter half.`,
    });
  }

  return { status: overallStatus(checks), checks };
}

// ---------------------------------------------------------------------------
// Metrics: three geometric measurements, nothing more
// ---------------------------------------------------------------------------

export interface FaceMetrics {
  /** Distance between the eye centers, as a fraction of image width. */
  interEyeDistance: number;
  /**
   * Vertical offset between the mouth corners, in units of the inter-eye
   * distance. Positive means the corner on the right of the image sits
   * lower. A description of the image, not a finding.
   */
  mouthCornerDelta: number;
  /** Eye opening (height / width) on the left of the image. */
  leftEyeAperture: number;
  /** Eye opening (height / width) on the right of the image. */
  rightEyeAperture: number;
  /** Right aperture divided by left aperture. 1 means equal openings. */
  eyeApertureRatio: number;
  /** Brow height above the eye, left of image, in inter-eye units. */
  leftBrowHeight: number;
  /** Brow height above the eye, right of image, in inter-eye units. */
  rightBrowHeight: number;
  /** Right brow height minus left brow height, in inter-eye units. */
  browHeightDelta: number;
}

export function computeMetrics(lm: FaceLandmarks): FaceMetrics {
  const ied = interEyeDistance(lm);
  const safeIed = ied > 0 ? ied : 1;
  const leftCenter = eyeCenter(lm, 'left');
  const rightCenter = eyeCenter(lm, 'right');
  const leftAperture = eyeAperture(lm, 'left');
  const rightAperture = eyeAperture(lm, 'right');
  const leftBrowHeight = (leftCenter.y - lm.leftBrow.y) / safeIed;
  const rightBrowHeight = (rightCenter.y - lm.rightBrow.y) / safeIed;
  return {
    interEyeDistance: ied,
    mouthCornerDelta: (lm.mouthRight.y - lm.mouthLeft.y) / safeIed,
    leftEyeAperture: leftAperture,
    rightEyeAperture: rightAperture,
    eyeApertureRatio: leftAperture > 0 ? rightAperture / leftAperture : 0,
    leftBrowHeight,
    rightBrowHeight,
    browHeightDelta: rightBrowHeight - leftBrowHeight,
  };
}

/** Gate first; metrics are only produced when the gate does not fail. */
export function analyzeFace(input: AnalysisInput): AnalysisResult {
  const report = qualityGate(input);
  if (report.status === 'cannot' || !input.landmarks) {
    return { status: 'cannot', report };
  }
  return { status: report.status, report, metrics: computeMetrics(input.landmarks) };
}

// ---------------------------------------------------------------------------
// Repeated captures: values are reported with a range, never as one number
// ---------------------------------------------------------------------------

export interface ValueRange {
  mean: number;
  min: number;
  max: number;
  /** Half the observed range; shown to the user as the plus/minus part. */
  spread: number;
  count: number;
}

export function summarizeValues(values: number[]): ValueRange | null {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { mean, min, max, spread: (max - min) / 2, count: values.length };
}

export interface MetricRanges {
  mouthCornerDelta: ValueRange | null;
  eyeApertureRatio: ValueRange | null;
  browHeightDelta: ValueRange | null;
}

export function summarizeCaptures(captures: FaceMetrics[]): MetricRanges {
  return {
    mouthCornerDelta: summarizeValues(captures.map((c) => c.mouthCornerDelta)),
    eyeApertureRatio: summarizeValues(captures.map((c) => c.eyeApertureRatio)),
    browHeightDelta: summarizeValues(captures.map((c) => c.browHeightDelta)),
  };
}

// ---------------------------------------------------------------------------
// Synthetic faces: procedural landmarks with known ground truth
// ---------------------------------------------------------------------------

export interface SyntheticSpec {
  /** 0..1 smile amount: corners rise and the mouth widens. */
  smile?: number;
  /** 0..1 both brows rise. */
  browRaise?: number;
  /** 0..1 both eyes close. */
  eyeClose?: number;
  /** 0..1 cheeks puff: mouth corners move inward, lip opening shrinks. */
  cheekPuff?: number;
  /** Extra vertical offset of the right mouth corner (image units). */
  mouthRightDy?: number;
  /** Multiplier on the right eye aperture. */
  rightEyeApertureScale?: number;
  /** Extra vertical offset of the right brow (image units, + is down). */
  rightBrowDy?: number;
  /** Head roll in degrees. */
  rollDeg?: number;
  /** Yaw proxy target, roughly -1..1. */
  yaw?: number;
  /** Face scale multiplier (1 is the default teaching size). */
  scale?: number;
}

function baseFace(): FaceLandmarks {
  return {
    leftEyeOuter: { x: 0.335, y: 0.42 },
    leftEyeInner: { x: 0.465, y: 0.42 },
    leftEyeTop: { x: 0.4, y: 0.398 },
    leftEyeBottom: { x: 0.4, y: 0.442 },
    rightEyeOuter: { x: 0.665, y: 0.42 },
    rightEyeInner: { x: 0.535, y: 0.42 },
    rightEyeTop: { x: 0.6, y: 0.398 },
    rightEyeBottom: { x: 0.6, y: 0.442 },
    leftBrow: { x: 0.4, y: 0.345 },
    rightBrow: { x: 0.6, y: 0.345 },
    noseTip: { x: 0.5, y: 0.55 },
    mouthLeft: { x: 0.415, y: 0.68 },
    mouthRight: { x: 0.585, y: 0.68 },
    mouthTop: { x: 0.5, y: 0.665 },
    mouthBottom: { x: 0.5, y: 0.7 },
    chin: { x: 0.5, y: 0.86 },
  };
}

function rotate(point: FacePoint, center: FacePoint, deg: number): FacePoint {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

function mapPoints(lm: FaceLandmarks, fn: (point: FacePoint, key: LandmarkKey) => FacePoint): FaceLandmarks {
  const out = {} as FaceLandmarks;
  for (const key of LANDMARK_KEYS) out[key] = fn(lm[key], key);
  return out;
}

/** Build a synthetic face from a spec. Deterministic: same spec, same face. */
export function syntheticFace(spec: SyntheticSpec): FaceLandmarks {
  let lm = baseFace();
  const smile = spec.smile ?? 0;
  const browRaise = spec.browRaise ?? 0;
  const eyeClose = spec.eyeClose ?? 0;
  const puff = spec.cheekPuff ?? 0;

  lm = mapPoints(lm, (point, key) => {
    const next = { ...point };
    if (key === 'mouthLeft') {
      // Smile widens the mouth; a cheek puff narrows it.
      next.x = point.x - 0.018 * smile + 0.014 * puff;
      next.y -= 0.02 * smile;
    }
    if (key === 'mouthRight') {
      next.x = point.x + 0.018 * smile - 0.014 * puff;
      next.y -= 0.02 * smile;
    }
    if (key === 'mouthTop') next.y += 0.012 * puff - 0.004 * smile;
    if (key === 'mouthBottom') next.y += 0.012 * smile - 0.012 * puff;
    if (key === 'leftBrow' || key === 'rightBrow') next.y -= 0.028 * browRaise;
    if (key === 'leftEyeTop' || key === 'rightEyeTop') {
      const centerY = key === 'leftEyeTop' ? lm.leftEyeTop.y + 0.022 : lm.rightEyeTop.y + 0.022;
      next.y = point.y + (centerY - point.y) * eyeClose * 0.92;
    }
    if (key === 'leftEyeBottom' || key === 'rightEyeBottom') {
      const centerY = key === 'leftEyeBottom' ? lm.leftEyeBottom.y - 0.022 : lm.rightEyeBottom.y - 0.022;
      next.y = point.y + (centerY - point.y) * eyeClose * 0.92;
    }
    return next;
  });

  // One-sided teaching offsets are applied before pose so pose stays honest.
  lm.mouthRight = { ...lm.mouthRight, y: lm.mouthRight.y + (spec.mouthRightDy ?? 0) };
  lm.rightBrow = { ...lm.rightBrow, y: lm.rightBrow.y + (spec.rightBrowDy ?? 0) };
  const apertureScale = spec.rightEyeApertureScale ?? 1;
  if (apertureScale !== 1) {
    const centerY = (lm.rightEyeTop.y + lm.rightEyeBottom.y) / 2;
    lm.rightEyeTop = { ...lm.rightEyeTop, y: centerY + (lm.rightEyeTop.y - centerY) * apertureScale };
    lm.rightEyeBottom = {
      ...lm.rightEyeBottom,
      y: centerY + (lm.rightEyeBottom.y - centerY) * apertureScale,
    };
  }

  const yaw = spec.yaw ?? 0;
  if (yaw !== 0) {
    lm.noseTip = { ...lm.noseTip, x: lm.noseTip.x + yaw * 0.05 };
    lm.chin = { ...lm.chin, x: lm.chin.x + yaw * 0.02 };
  }

  const center = { x: 0.5, y: 0.52 };
  const scale = spec.scale ?? 1;
  if (scale !== 1) {
    lm = mapPoints(lm, (point) => ({
      x: center.x + (point.x - center.x) * scale,
      y: center.y + (point.y - center.y) * scale,
    }));
  }
  const roll = spec.rollDeg ?? 0;
  if (roll !== 0) {
    lm = mapPoints(lm, (point) => rotate(point, center, roll));
  }
  return lm;
}

export interface SyntheticPreset {
  id: string;
  label: string;
  description: string;
  spec: SyntheticSpec;
  /** Simulated pixel statistics for the photo quality checks. */
  sharpness: number;
  lightingBalance: number;
  /** What the measurement should find, for teaching comparison. */
  groundTruth: string;
}

export const SYNTHETIC_PRESETS: SyntheticPreset[] = [
  {
    id: 'neutral',
    label: 'Neutral teaching face',
    description: 'A level, front-facing synthetic face with even geometry.',
    spec: {},
    sharpness: 230,
    lightingBalance: 0.93,
    groundTruth: 'Ground truth: mouth corner offset 0.00, eye aperture ratio 1.00, brow height difference 0.00.',
  },
  {
    id: 'smiling',
    label: 'Smiling teaching face',
    description: 'Both mouth corners rise together and the mouth widens.',
    spec: { smile: 1 },
    sharpness: 225,
    lightingBalance: 0.92,
    groundTruth:
      'Ground truth: the mouth corners stay level with each other (offset 0.00) even though both moved up. A smile alone does not create a one-sided offset.',
  },
  {
    id: 'one-sided',
    label: 'One-sided teaching sample (labelled synthetic)',
    description:
      'A synthetic face built with a deliberate one-sided geometry change. It is a teaching sample with known construction, not a picture of a patient.',
    spec: { mouthRightDy: -0.018, rightEyeApertureScale: 0.72, rightBrowDy: 0.01 },
    sharpness: 228,
    lightingBalance: 0.91,
    groundTruth:
      'Ground truth: mouth corner offset about -0.09 (right corner higher), eye aperture ratio about 0.72, brow height difference about -0.05. Compare the measured values with these.',
  },
  {
    id: 'head-tilt',
    label: 'Head tilt (quality gate demo)',
    description: 'The same neutral face rolled 18 degrees. The gate should refuse to measure it.',
    spec: { rollDeg: 18 },
    sharpness: 230,
    lightingBalance: 0.93,
    groundTruth: 'Ground truth: this sample should report cannot analyze because of head tilt.',
  },
  {
    id: 'turned',
    label: 'Head turned (quality gate demo)',
    description: 'The face is turned so the nose sits far off-center. The gate should refuse it.',
    spec: { yaw: 1.3 },
    sharpness: 230,
    lightingBalance: 0.93,
    groundTruth: 'Ground truth: this sample should report cannot analyze because of head turn.',
  },
  {
    id: 'uneven-light',
    label: 'Uneven light (quality gate demo)',
    description: 'Geometry is fine, but one half of the face is simulated as much darker.',
    spec: {},
    sharpness: 210,
    lightingBalance: 0.36,
    groundTruth: 'Ground truth: this sample should report cannot analyze because of lighting balance.',
  },
  {
    id: 'small-face',
    label: 'Face too small (quality gate demo)',
    description: 'The face occupies too little of the frame for landmark distances to be reliable.',
    spec: { scale: 0.3 },
    sharpness: 230,
    lightingBalance: 0.93,
    groundTruth: 'Ground truth: this sample should report cannot analyze because the face is too small.',
  },
];

/** Deterministic small PRNG so demos and tests are reproducible. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A slightly jittered copy of a landmark set, for repeated-capture demos. */
export function jitterLandmarks(lm: FaceLandmarks, seed: number, amount = 0.0025): FaceLandmarks {
  const random = mulberry32(seed);
  return mapPoints(lm, (point) => ({
    x: point.x + (random() - 0.5) * 2 * amount,
    y: point.y + (random() - 0.5) * 2 * amount,
  }));
}
