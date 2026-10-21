// Pure logic for the Face Dynamics Lab.
//
// A session is a guided sequence of expression tasks. Each task is
// recorded as geometry signals extracted from landmarks, compared with
// the person's own neutral baseline from the same session. The lab never
// labels a pattern in the person's data: it reports what changed, in
// plain geometric units, next to a clearly labelled synthetic reference.
//
// Signals are extracted from the same landmark geometry as the symmetry
// analyzer, so a snapshot measured here means the same thing there.

import {
  eyeAperture,
  interEyeDistance,
  mulberry32,
  syntheticFace,
} from './geometry';
import type { FaceLandmarks } from './geometry';

export interface FaceSignals {
  /** Mouth width in inter-eye units. Rises when smiling. */
  mouthWidth: number;
  /** Average mouth corner height above the eye line, inter-eye units. */
  mouthLift: number;
  /** Average brow height above the eyes, inter-eye units. */
  browHeight: number;
  /** Average eye opening (height / width). Falls when eyes close. */
  eyeOpening: number;
  /** Lip opening (lower lip minus upper lip), inter-eye units. */
  lipOpening: number;
}

export function faceSignals(lm: FaceLandmarks): FaceSignals {
  const ied = interEyeDistance(lm);
  const safe = ied > 0 ? ied : 1;
  const eyeLineY = (lm.leftEyeTop.y + lm.leftEyeBottom.y + lm.rightEyeTop.y + lm.rightEyeBottom.y) / 4;
  return {
    mouthWidth: Math.hypot(lm.mouthRight.x - lm.mouthLeft.x, lm.mouthRight.y - lm.mouthLeft.y) / safe,
    mouthLift: (eyeLineY - (lm.mouthLeft.y + lm.mouthRight.y) / 2) / safe,
    browHeight:
      ((eyeLineY - lm.leftBrow.y) / safe + (eyeLineY - lm.rightBrow.y) / safe) / 2,
    eyeOpening: (eyeAperture(lm, 'left') + eyeAperture(lm, 'right')) / 2,
    lipOpening: (lm.mouthBottom.y - lm.mouthTop.y) / safe,
  };
}

export type DynamicsTaskId = 'smile' | 'brow-raise' | 'eye-close' | 'cheek-puff';

export interface DynamicsTask {
  id: DynamicsTaskId;
  label: string;
  instruction: string;
  /** Which signal describes this task, and in which direction it moves. */
  signal: keyof FaceSignals;
  signalLabel: string;
  expectedDirection: 'up' | 'down';
  /** Plain-language note on why clinicians watch this movement. */
  education: string;
}

export const DYNAMICS_TASKS: DynamicsTask[] = [
  {
    id: 'smile',
    label: 'Smile',
    instruction: 'Smile as if greeting a friend. Show your teeth if that is comfortable.',
    signal: 'mouthWidth',
    signalLabel: 'Mouth width',
    expectedDirection: 'up',
    education:
      'A smile uses muscles on both sides of the face. Comparing the two corners during a moving task shows more than a still photo, because timing and effort become visible.',
  },
  {
    id: 'brow-raise',
    label: 'Raise your brows',
    instruction: 'Raise both eyebrows as high as you can, as if surprised.',
    signal: 'browHeight',
    signalLabel: 'Brow height',
    expectedDirection: 'up',
    education:
      'Brow raising uses the forehead muscle. Clinicians pay attention to forehead movement because it helps them understand which parts of the face pathway are working; this lab only records the geometry of the movement.',
  },
  {
    id: 'eye-close',
    label: 'Close your eyes',
    instruction: 'Close both eyes gently, then squeeze them shut for a moment.',
    signal: 'eyeOpening',
    signalLabel: 'Eye opening',
    expectedDirection: 'down',
    education:
      'Eye closure is part of the standard face examination. Here the eye opening number simply describes how far the eyelids moved in your snapshots.',
  },
  {
    id: 'cheek-puff',
    label: 'Puff your cheeks',
    instruction: 'Fill both cheeks with air and hold, like holding water in your mouth.',
    signal: 'lipOpening',
    signalLabel: 'Lip opening (proxy)',
    expectedDirection: 'down',
    education:
      'Holding air tests lip seal. This lab uses lip opening between the snapshots as a rough proxy only; it cannot measure air pressure or leakage.',
  },
];

export function getTask(id: DynamicsTaskId): DynamicsTask {
  const task = DYNAMICS_TASKS.find((entry) => entry.id === id);
  if (!task) throw new Error(`Unknown dynamics task ${id}`);
  return task;
}

// ---------------------------------------------------------------------------
// Session state (immutable updates, easy to test)
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'recorded' | 'skipped';

export interface TaskRecord {
  taskId: DynamicsTaskId;
  status: TaskStatus;
  /** Signal value measured for this task, when a measurement exists. */
  value: number | null;
  /** The same signal at the neutral baseline. */
  baselineValue: number | null;
  /** value minus baselineValue, when both exist. */
  change: number | null;
  /** How the record was produced: measured landmarks or self report. */
  source: 'measured' | 'self-report' | null;
  note: string;
}

export interface DynamicsSession {
  baseline: FaceSignals | null;
  records: TaskRecord[];
  currentIndex: number;
}

export function createSession(): DynamicsSession {
  return {
    baseline: null,
    records: DYNAMICS_TASKS.map((task) => ({
      taskId: task.id,
      status: 'pending' as TaskStatus,
      value: null,
      baselineValue: null,
      change: null,
      source: null,
      note: '',
    })),
    currentIndex: 0,
  };
}

export function setBaseline(session: DynamicsSession, landmarks: FaceLandmarks): DynamicsSession {
  return { ...session, baseline: faceSignals(landmarks) };
}

export function currentTask(session: DynamicsSession): DynamicsTask | null {
  if (session.currentIndex >= DYNAMICS_TASKS.length) return null;
  return DYNAMICS_TASKS[session.currentIndex] ?? null;
}

export function isComplete(session: DynamicsSession): boolean {
  return session.records.every((record) => record.status !== 'pending');
}

function replaceRecord(session: DynamicsSession, record: TaskRecord): DynamicsSession {
  const records = session.records.map((entry) => (entry.taskId === record.taskId ? record : entry));
  return { ...session, records, currentIndex: session.currentIndex + 1 };
}

/** Record the current task from measured landmarks (needs a baseline). */
export function recordMeasured(
  session: DynamicsSession,
  landmarks: FaceLandmarks,
): DynamicsSession {
  const task = currentTask(session);
  if (!task || !session.baseline) return session;
  const signals = faceSignals(landmarks);
  const value = signals[task.signal];
  const baselineValue = session.baseline[task.signal];
  return replaceRecord(session, {
    taskId: task.id,
    status: 'recorded',
    value,
    baselineValue,
    change: value - baselineValue,
    source: 'measured',
    note: '',
  });
}

/** Record the current task as done without a measurement. */
export function recordSelfReport(session: DynamicsSession, note: string): DynamicsSession {
  const task = currentTask(session);
  if (!task) return session;
  return replaceRecord(session, {
    taskId: task.id,
    status: 'recorded',
    value: null,
    baselineValue: null,
    change: null,
    source: 'self-report',
    note: note.trim(),
  });
}

export function skipTask(session: DynamicsSession): DynamicsSession {
  const task = currentTask(session);
  if (!task) return session;
  return replaceRecord(session, {
    taskId: task.id,
    status: 'skipped',
    value: null,
    baselineValue: null,
    change: null,
    source: null,
    note: '',
  });
}

export interface SessionSummary {
  recorded: number;
  measured: number;
  selfReported: number;
  skipped: number;
  pending: number;
}

export function summarizeSession(session: DynamicsSession): SessionSummary {
  const summary: SessionSummary = { recorded: 0, measured: 0, selfReported: 0, skipped: 0, pending: 0 };
  for (const record of session.records) {
    if (record.status === 'recorded') {
      summary.recorded += 1;
      if (record.source === 'measured') summary.measured += 1;
      if (record.source === 'self-report') summary.selfReported += 1;
    } else if (record.status === 'skipped') {
      summary.skipped += 1;
    } else {
      summary.pending += 1;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Synthetic performer: a labelled teaching reference, never user data
// ---------------------------------------------------------------------------

/** Phase curve for one performed task: rest, rise, hold, release, rest. */
export const PERFORMER_PHASES = [0, 0.3, 0.65, 0.9, 1, 1, 1, 0.85, 0.55, 0.25, 0];

/** Landmarks of the synthetic performer at a given phase of a task. */
export function performerLandmarks(taskId: DynamicsTaskId, phase: number): FaceLandmarks {
  switch (taskId) {
    case 'smile':
      return syntheticFace({ smile: phase });
    case 'brow-raise':
      return syntheticFace({ browRaise: phase });
    case 'eye-close':
      return syntheticFace({ eyeClose: phase });
    case 'cheek-puff':
      return syntheticFace({ cheekPuff: phase });
  }
}

export interface TracePoint {
  phase: number;
  value: number;
}

/**
 * The synthetic reference trace for a task: the task signal, relative to
 * the performer's own neutral baseline, across the phase curve. Small
 * deterministic jitter keeps the curve honest about measurement noise.
 */
export function syntheticTrace(taskId: DynamicsTaskId, seed = 7): TracePoint[] {
  const task = getTask(taskId);
  const baseline = faceSignals(performerLandmarks(taskId, 0))[task.signal];
  const random = mulberry32(seed);
  return PERFORMER_PHASES.map((phase) => {
    const value = faceSignals(performerLandmarks(taskId, phase))[task.signal];
    const jitter = phase > 0 && phase < 1 ? (random() - 0.5) * 0.006 : 0;
    return { phase, value: value - baseline + jitter };
  });
}

/** A measured trace from a list of landmark frames, relative to baseline. */
export function measuredTrace(
  taskId: DynamicsTaskId,
  frames: FaceLandmarks[],
  baseline: FaceSignals,
): TracePoint[] {
  const task = getTask(taskId);
  if (frames.length === 0) return [];
  return frames.map((landmarks, index) => ({
    phase: frames.length === 1 ? 0 : index / (frames.length - 1),
    value: faceSignals(landmarks)[task.signal] - baseline[task.signal],
  }));
}

// ---------------------------------------------------------------------------
// Chart geometry (SVG paths), kept pure so it can be unit tested
// ---------------------------------------------------------------------------

export interface ChartBounds {
  min: number;
  max: number;
}

/** Bounds that always include zero, with a small margin. */
export function traceBounds(traces: TracePoint[][]): ChartBounds {
  let min = 0;
  let max = 0;
  for (const trace of traces) {
    for (const point of trace) {
      if (point.value < min) min = point.value;
      if (point.value > max) max = point.value;
    }
  }
  if (max - min < 0.05) {
    max += 0.025;
    min -= 0.025;
  }
  const margin = (max - min) * 0.1;
  return { min: min - margin, max: max + margin };
}

/** Build an SVG polyline path for a trace inside a width by height box. */
export function tracePath(
  trace: TracePoint[],
  width: number,
  height: number,
  bounds: ChartBounds,
): string {
  if (trace.length === 0) return '';
  const range = bounds.max - bounds.min || 1;
  const points = trace.map((point) => {
    const x = point.phase * width;
    const y = height - ((point.value - bounds.min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${points.join(' L')}`;
}

/** Y position of the zero line inside the chart box. */
export function zeroLineY(height: number, bounds: ChartBounds): number {
  const range = bounds.max - bounds.min || 1;
  return height - ((0 - bounds.min) / range) * height;
}

/** Format a signal change for display, with sign and 3 decimals. */
export function formatChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'not measured';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}
