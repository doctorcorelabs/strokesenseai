// Pure geometry for the Movement Lab arm modes, shared with FAST Live.
//
// Everything here works on plain landmark coordinates, so it can be
// unit tested from synthetic postures without a camera or a model.
// Angles are 2D projections in the camera picture: the angle at the
// shoulder between the arm (shoulder to wrist) and the torso line
// (shoulder to hip) on the same side. Zero degrees means the arm hangs
// along the body; about 90 degrees means the arm points straight out
// to the side. Nothing here knows about depth, strength, or any
// clinical threshold.

/** Minimal structural point, compatible with MediaPipe landmarks. */
export interface PosePoint {
  x: number;
  y: number;
  /** MediaPipe visibility estimate, 0 to 1. Missing means unknown. */
  visibility?: number;
}

export type ArmSide = 'left' | 'right';

/** BlazePose indices for the points this module reads. */
const INDICES: Record<ArmSide, { shoulder: number; wrist: number; hip: number }> = {
  left: { shoulder: 11, wrist: 15, hip: 23 },
  right: { shoulder: 12, wrist: 16, hip: 24 },
};

/** Points below this visibility are treated as not seen. */
export const MIN_VISIBILITY = 0.6;

function usable(point: PosePoint | undefined): point is PosePoint {
  if (point === undefined) return false;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
  if (typeof point.visibility === 'number' && point.visibility < MIN_VISIBILITY) return false;
  return true;
}

/**
 * Projected arm angle in degrees for one side, or null when any of the
 * three points it needs (shoulder, wrist, hip) is missing or not
 * visible enough to trust. A null is a tracking gap and is reported as
 * one; it is never replaced with an invented angle.
 */
export function armProjectedAngle(
  landmarks: readonly PosePoint[],
  side: ArmSide,
): number | null {
  const { shoulder, wrist, hip } = INDICES[side];
  const s = landmarks[shoulder];
  const w = landmarks[wrist];
  const h = landmarks[hip];
  if (!usable(s) || !usable(w) || !usable(h)) return null;

  const armX = w.x - s.x;
  const armY = w.y - s.y;
  const torsoX = h.x - s.x;
  const torsoY = h.y - s.y;
  const armLen = Math.hypot(armX, armY);
  const torsoLen = Math.hypot(torsoX, torsoY);
  if (armLen === 0 || torsoLen === 0) return null;

  const cosine = (armX * torsoX + armY * torsoY) / (armLen * torsoLen);
  const clamped = Math.min(1, Math.max(-1, cosine));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/**
 * Centered moving average that preserves gaps: a null in the input
 * stays null in the output, and each surviving value is averaged with
 * the non-null neighbours inside the window. windowSize below 1 is
 * treated as 1 (a plain copy).
 */
export function smoothSeries(
  values: readonly (number | null)[],
  windowSize: number,
): (number | null)[] {
  const size = Math.max(1, Math.floor(windowSize));
  const half = Math.floor(size / 2);
  return values.map((value, index) => {
    if (value === null) return null;
    const from = Math.max(0, index - half);
    const to = Math.min(values.length, index - half + size);
    let sum = 0;
    let count = 0;
    for (let i = from; i < to; i += 1) {
      const neighbour = values[i];
      if (neighbour !== null && Number.isFinite(neighbour)) {
        sum += neighbour;
        count += 1;
      }
    }
    return count === 0 ? null : sum / count;
  });
}
