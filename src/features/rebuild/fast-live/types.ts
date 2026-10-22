// Session data types for the FAST Live Check.
//
// A stage outcome is one of four honest endings: measured (with the
// numbers the devices actually produced), could-not (a measurement was
// attempted and the signal was not good enough, with a specific
// reason), skipped (the person chose not to record it, written on the
// sheet as "Not recorded"), or example (the guided example was watched
// instead of being measured). There is no fifth ending and no default
// value standing in for a measurement that never happened.

/** One point of a per-side angle series, time in seconds from hold start. */
export interface ArmPoint {
  t: number;
  deg: number;
}

export interface ArmSideSummary {
  startDeg: number;
  endDeg: number;
  /** Signed change, end minus start. Negative means the arm sank. */
  changeDeg: number;
  /** Largest sustained drop from the highest angle reached before it. */
  maxDropDeg: number;
}

export type FaceTaskOutcome =
  | {
      status: 'measured';
      /** Median relative movement per side, display scale 0 to 100. */
      left: number;
      right: number;
      usableSeconds: number;
      excludedSeconds: number;
    }
  | { status: 'could-not'; reason: string }
  | { status: 'example' };

export type FaceStageOutcome =
  | {
      status: 'measured';
      smile: FaceTaskOutcome;
      brow: FaceTaskOutcome;
    }
  | { status: 'could-not'; reason: string; suggestion: string }
  | { status: 'skipped' }
  | { status: 'example' };

export type ArmStageOutcome =
  | {
      status: 'measured';
      left: ArmSideSummary;
      right: ArmSideSummary;
      usableSeconds: number;
      holdSeconds: number;
      leftSeries: ArmPoint[];
      rightSeries: ArmPoint[];
    }
  | { status: 'could-not'; reason: string; suggestion: string }
  | { status: 'skipped' }
  | { status: 'example' };

export type FastWordStatus = 'written' | 'differently' | 'not-heard' | 'extra';

export interface FastWordEntry {
  target: string | null;
  heard: string | null;
  status: FastWordStatus;
}

export type SpeechStageOutcome =
  | {
      status: 'measured';
      /** recognizer: transcribed from speech. typed: typed by hand. */
      mode: 'recognizer' | 'typed';
      /** The raw text exactly as received, never edited. */
      transcript: string;
      entries: FastWordEntry[];
      correctCount: number;
      targetCount: number;
      extraWords: string[];
    }
  | { status: 'could-not'; reason: string; suggestion: string }
  | { status: 'skipped' }
  | { status: 'example' };

/** The whole session, one outcome per stage, in FAST order. */
export interface FastSession {
  face?: FaceStageOutcome;
  arm?: ArmStageOutcome;
  speech?: SpeechStageOutcome;
}
