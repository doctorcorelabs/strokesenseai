// Pure logic for the FAST Live Check: head pose gating math, window
// aggregation for the face tasks, arm hold summaries, the speech word
// map, descriptive sentences, and the observation sheet text.
//
// Everything here is deterministic and free of device or model code so
// it can be unit tested directly. Nothing in this file produces a
// score, a verdict, or a diagnosis. The outputs describe what was
// measured, in the words the planning document prescribes.

import { alignWords } from '../../speech-core/analysis';
import type {
  ArmPoint,
  ArmSideSummary,
  ArmStageOutcome,
  FaceStageOutcome,
  FaceTaskOutcome,
  FastSession,
  FastWordEntry,
  SpeechStageOutcome,
} from './types';

export const TARGET_SENTENCE = 'The sky is clear and blue today.';
export const SMILE_SECONDS = 4;
export const BROW_SECONDS = 3;
export const HOLD_SECONDS = 10;

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

/** Median of a list of numbers. Empty list gives 0. */
export function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Head pose from the facial transformation matrix
// ---------------------------------------------------------------------------

export interface HeadPose {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/**
 * Extract yaw, pitch, and roll in degrees from a MediaPipe facial
 * transformation matrix (4x4, column-major, length 16). The matrix is
 * treated as the rotation Ry(yaw) * Rx(pitch) * Rz(roll); the values
 * are used only as a signal quality gate, never as a result.
 */
export function headPoseFromMatrix(data: ArrayLike<number>): HeadPose {
  const r = (row: number, col: number) => data[col * 4 + row];
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const clamped = Math.max(-1, Math.min(1, -r(1, 2)));
  return {
    pitchDeg: toDeg(Math.asin(clamped)),
    yawDeg: toDeg(Math.atan2(r(0, 2), r(2, 2))),
    rollDeg: toDeg(Math.atan2(r(1, 0), r(1, 1))),
  };
}

/** Engineering tolerances for a usable face frame, from the planning. */
export const POSE_TOLERANCE = { yawDeg: 10, pitchDeg: 10, rollDeg: 8 };

export function poseWithinTolerance(pose: HeadPose): boolean {
  return (
    Math.abs(pose.yawDeg) <= POSE_TOLERANCE.yawDeg &&
    Math.abs(pose.pitchDeg) <= POSE_TOLERANCE.pitchDeg &&
    Math.abs(pose.rollDeg) <= POSE_TOLERANCE.rollDeg
  );
}

// ---------------------------------------------------------------------------
// Face task windows
// ---------------------------------------------------------------------------

export interface FaceWindowSample {
  left: number;
  right: number;
}

/**
 * Turn the samples of one face task window into its outcome. Samples
 * are the per-frame relative movement values from the frames that
 * passed the pose gate. A task whose usable time covers less than half
 * its window is reported as could-not-be-measured, never averaged into
 * a plausible-looking number.
 */
export function faceTaskOutcome(
  taskLabel: string,
  samples: FaceWindowSample[],
  usableSeconds: number,
  excludedSeconds: number,
  windowSeconds: number,
): FaceTaskOutcome {
  if (samples.length === 0 || usableSeconds < windowSeconds * 0.5) {
    return {
      status: 'could-not',
      reason: `Too much of the ${taskLabel} was excluded because the head moved out of position, so no value is reported for it.`,
    };
  }
  return {
    status: 'measured',
    left: Math.round(medianOf(samples.map((sample) => sample.left))),
    right: Math.round(medianOf(samples.map((sample) => sample.right))),
    usableSeconds: round1(usableSeconds),
    excludedSeconds: round1(excludedSeconds),
  };
}

/** One descriptive sentence about a measured face task. No verdicts. */
export function describeFaceTask(left: number, right: number): string {
  const diff = left - right;
  if (Math.max(left, right) < 5) {
    return 'Very little movement was recorded on either side in this recording.';
  }
  if (Math.abs(diff) <= 2) {
    return 'Both sides moved by about the same amount in this recording.';
  }
  const side = diff > 0 ? 'left' : 'right';
  const size = Math.abs(diff) > 25 ? 'larger' : 'slightly larger';
  return `Both sides moved; the ${side} side's recorded movement was ${size} in this recording.`;
}

// ---------------------------------------------------------------------------
// Arm hold summaries
// ---------------------------------------------------------------------------

/**
 * Summarize one arm's smoothed angle series over the hold. Start and
 * end are medians of the first and last half second, so a single
 * jittered frame cannot move them. Returns null when there is not
 * enough series to describe.
 */
export function summarizeArmSide(samples: ArmPoint[], holdSeconds: number): ArmSideSummary | null {
  if (samples.length < 3) return null;
  const head = samples.filter((point) => point.t <= 0.5);
  const tail = samples.filter((point) => point.t >= holdSeconds - 0.5);
  const startDeg = head.length > 0 ? medianOf(head.map((point) => point.deg)) : samples[0].deg;
  const endDeg =
    tail.length > 0
      ? medianOf(tail.map((point) => point.deg))
      : samples[samples.length - 1].deg;
  let peak = -Infinity;
  let maxDropDeg = 0;
  for (const point of samples) {
    peak = Math.max(peak, point.deg);
    maxDropDeg = Math.max(maxDropDeg, peak - point.deg);
  }
  return {
    startDeg: round1(startDeg),
    endDeg: round1(endDeg),
    changeDeg: round1(endDeg - startDeg),
    maxDropDeg: round1(maxDropDeg),
  };
}

/**
 * Decide the arm stage outcome from the two smoothed series and the
 * share of the hold in which each arm was actually visible. A side
 * visible for less than two thirds of the hold fails the whole stage
 * with a reason that names the side, per the planning document.
 */
export function armStageOutcome(
  leftSeries: ArmPoint[],
  rightSeries: ArmPoint[],
  leftVisibleFraction: number,
  rightVisibleFraction: number,
  holdSeconds: number = HOLD_SECONDS,
): ArmStageOutcome {
  const threshold = 2 / 3;
  const leftBad = leftVisibleFraction < threshold;
  const rightBad = rightVisibleFraction < threshold;
  if (leftBad || rightBad) {
    const reason =
      leftBad && rightBad
        ? 'Both arms left the frame for most of the hold, so no angle is reported.'
        : `Your ${leftBad ? 'left' : 'right'} arm left the frame for most of the hold, so no angle is reported.`;
    return {
      status: 'could-not',
      reason,
      suggestion:
        'Step back so both raised arms stay inside the frame for the whole hold, then try the arm stage again.',
    };
  }
  const left = summarizeArmSide(leftSeries, holdSeconds);
  const right = summarizeArmSide(rightSeries, holdSeconds);
  if (left === null || right === null) {
    return {
      status: 'could-not',
      reason: 'Too few clear frames of the arms were recorded to describe the hold.',
      suggestion: 'Face the camera in brighter light, keep both arms raised, and try again.',
    };
  }
  return {
    status: 'measured',
    left,
    right,
    usableSeconds: round1(Math.min(leftVisibleFraction, rightVisibleFraction) * holdSeconds),
    holdSeconds,
    leftSeries,
    rightSeries,
  };
}

/** Descriptive sentences for a measured arm hold. Magnitudes, no verdicts. */
export function describeArmHold(
  left: ArmSideSummary,
  right: ArmSideSummary,
  holdSeconds: number,
): string {
  const parts = [
    `Over ${holdSeconds} seconds, the left arm's angle changed by ${Math.round(
      Math.abs(left.changeDeg),
    )} degrees and the right arm's by ${Math.round(
      Math.abs(right.changeDeg),
    )} degrees in the camera picture.`,
  ];
  if (left.changeDeg <= -3) {
    parts.push("The left arm's angle decreased during the hold.");
  }
  if (right.changeDeg <= -3) {
    parts.push("The right arm's angle decreased during the hold.");
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Speech word map
// ---------------------------------------------------------------------------

/**
 * Build the FAST word map from a transcript, reusing the deterministic
 * alignment from the speech tools. Statuses use the FAST words: heard
 * as written, heard differently (with the word that was heard), and not
 * heard. Extra words are collected separately and never punished.
 */
export function buildWordMap(
  targetSentence: string,
  heardText: string,
): { entries: FastWordEntry[]; correctCount: number; targetCount: number; extraWords: string[] } {
  const alignment = alignWords(targetSentence, heardText);
  const entries: FastWordEntry[] = alignment.items.map((item) => {
    switch (item.status) {
      case 'correct':
        return { target: item.target, heard: item.heard, status: 'written' };
      case 'substituted':
        return { target: item.target, heard: item.heard, status: 'differently' };
      case 'missing':
        return { target: item.target, heard: null, status: 'not-heard' };
      case 'extra':
        return { target: null, heard: item.heard, status: 'extra' };
    }
  });
  return {
    entries,
    correctCount: alignment.correctCount,
    targetCount: alignment.targetWordCount,
    extraWords: entries
      .filter((entry) => entry.status === 'extra' && entry.heard !== null)
      .map((entry) => entry.heard as string),
  };
}

// ---------------------------------------------------------------------------
// Observation sheet text (planning document 01, section 8)
// ---------------------------------------------------------------------------

function faceTaskLines(label: string, windowSeconds: number, task: FaceTaskOutcome): string[] {
  if (task.status === 'example') {
    return [`${label}: Watched the guided example (not measured).`];
  }
  if (task.status === 'could-not') {
    return [`${label}: Could not be measured. ${task.reason}`];
  }
  return [
    `${label} (${windowSeconds} seconds, ${task.usableSeconds} usable seconds recorded)`,
    `  Left side movement (relative): ${task.left}    Right side: ${task.right}`,
    `  Recorded description: ${describeFaceTask(task.left, task.right)}`,
  ];
}

function faceSection(face: FaceStageOutcome | undefined, lines: string[]): void {
  lines.push('FACE');
  if (face === undefined || face.status === 'skipped') {
    lines.push('Face stage: Not recorded.');
    return;
  }
  if (face.status === 'example') {
    lines.push('Face stage: Watched the guided example (not measured).');
    return;
  }
  if (face.status === 'could-not') {
    lines.push(`Face stage: Could not be measured. ${face.reason}`);
    return;
  }
  lines.push(...faceTaskLines('Smile task', SMILE_SECONDS, face.smile));
  lines.push(...faceTaskLines('Brow raise task', BROW_SECONDS, face.brow));
  const excluded = [face.smile, face.brow]
    .filter((task) => task.status === 'measured')
    .reduce((sum, task) => sum + (task.status === 'measured' ? task.excludedSeconds : 0), 0);
  if (excluded > 0) {
    lines.push(
      `Quality notes: ${round1(excluded)} seconds were excluded because the head turned.`,
    );
  }
}

function armSection(arm: ArmStageOutcome | undefined, lines: string[]): void {
  lines.push('ARM (camera-adapted position: arms out to the sides)');
  if (arm === undefined || arm.status === 'skipped') {
    lines.push('Arm stage: Not recorded.');
    return;
  }
  if (arm.status === 'example') {
    lines.push('Arm stage: Watched the guided example (not measured).');
    return;
  }
  if (arm.status === 'could-not') {
    lines.push(`Arm stage: Could not be measured. ${arm.reason}`);
    return;
  }
  lines.push(`Hold duration: ${arm.holdSeconds} seconds (${arm.usableSeconds} usable)`);
  lines.push(
    `  Left arm angle: started ${Math.round(arm.left.startDeg)} deg, ended ${Math.round(
      arm.left.endDeg,
    )} deg (change ${Math.round(Math.abs(arm.left.changeDeg))} deg)`,
  );
  lines.push(
    `  Right arm angle: started ${Math.round(arm.right.startDeg)} deg, ended ${Math.round(
      arm.right.endDeg,
    )} deg (change ${Math.round(Math.abs(arm.right.changeDeg))} deg)`,
  );
  lines.push(`  Recorded description: ${describeArmHold(arm.left, arm.right, arm.holdSeconds)}`);
}

function speechSection(speech: SpeechStageOutcome | undefined, lines: string[]): void {
  lines.push('SPEECH');
  if (speech === undefined || speech.status === 'skipped') {
    lines.push('Speech stage: Not recorded.');
    return;
  }
  if (speech.status === 'example') {
    lines.push('Speech stage: Watched the guided example (not measured).');
    return;
  }
  if (speech.status === 'could-not') {
    lines.push(`Speech stage: Could not be measured. ${speech.reason}`);
    return;
  }
  lines.push(`Target sentence: "${TARGET_SENTENCE}"`);
  if (speech.mode === 'recognizer') {
    lines.push(`Transcribed as: "${speech.transcript}"`);
    lines.push(
      `Word map: ${speech.correctCount} of ${speech.targetCount} words transcribed exactly as written.`,
    );
    if (speech.extraWords.length > 0) {
      lines.push(`Extra words heard: ${speech.extraWords.join(', ')}`);
    }
    lines.push('Mode: transcribed by the browser speech recognizer.');
  } else {
    lines.push(`Typed text: "${speech.transcript}"`);
    lines.push(
      `Word map: ${speech.correctCount} of ${speech.targetCount} words typed exactly as written.`,
    );
    if (speech.extraWords.length > 0) {
      lines.push(`Extra words typed: ${speech.extraWords.join(', ')}`);
    }
    lines.push('Mode: typed from memory, not transcribed from speech.');
  }
}

/** Assemble the downloadable observation sheet exactly as planned. */
export function buildObservationSheetText(session: FastSession, when: Date): string {
  const lines: string[] = [
    'FAST Check - Observation Sheet',
    `Date and time: ${when.toLocaleString('en-US')}`,
    'This sheet records what the camera and microphone measured during a',
    'guided practice session. It is not a diagnosis, screening, or medical',
    'assessment, and it cannot rule out stroke. If you have sudden face,',
    'arm, or speech changes now, call 119 immediately.',
    '',
  ];
  faceSection(session.face, lines);
  lines.push('');
  armSection(session.arm, lines);
  lines.push('');
  speechSection(session.speech, lines);
  lines.push('');
  lines.push('Stages skipped or not measurable are listed as "Not recorded" or');
  lines.push('"Could not be measured" with the reason. Nothing on this sheet is a score.');
  return lines.join('\n');
}
