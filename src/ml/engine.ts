// Shared MediaPipe engine for the R1 rebuild.
//
// This module is only a loader and lifecycle manager. It knows how to
// create a FaceLandmarker, PoseLandmarker, or HandLandmarker from the
// model files this site hosts itself (see MODELS.md next to this file),
// and it guarantees three things:
//
// - Singleton per kind per running mode: asking twice for the same
//   kind and mode returns the same running instance and never loads
//   the model twice. The VIDEO session (getLandmarker) serves the live
//   camera features; the IMAGE session (getImageLandmarker) serves
//   uploaded-file analysis in analyze.ts. The two sessions are
//   separate singletons on purpose, so analyzing an uploaded photo
//   never tears down a camera landmarker, and the reverse.
// - One landmarker active at a time within a session: loading a new
//   kind closes the one that was open, so a phone never runs two
//   vision models for the same input mode at once.
// - Honest failure: if the WASM fileset or a model cannot load, the
//   caller gets a ModelLoadError with a plain reason. Nothing here
//   falls back to fake data, a CDN copy, or a silent retry loop.
//
// Feature measurement logic (face symmetry, arm angles, tap counting)
// does not belong in this file. Features build on the landmarker this
// module hands them.

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';

// The package does not export the fileset type, so derive it from the
// resolver the engine actually calls.
type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

export type LandmarkerKind = 'face' | 'pose' | 'hand';

export type AnyLandmarker = FaceLandmarker | PoseLandmarker | HandLandmarker;

export const MODEL_PATHS: Record<LandmarkerKind, string> = {
  face: '/models/face_landmarker.task',
  pose: '/models/pose_landmarker_lite.task',
  hand: '/models/hand_landmarker.task',
};

const WASM_PATH = '/mediapipe/wasm';

export type ModelLoadErrorReason = 'network' | 'wasm' | 'unsupported' | 'unknown';

const REASON_MESSAGES: Record<ModelLoadErrorReason, string> = {
  network:
    'The vision model could not be downloaded. Check your connection and try again.',
  wasm: 'The vision engine could not start in this browser. Try a recent version of Chrome, Edge, or Safari.',
  unsupported:
    'This browser does not support the technology the vision tools need. Try a recent version of Chrome, Edge, or Safari.',
  unknown: 'The vision model could not be loaded. Please try again.',
};

export class ModelLoadError extends Error {
  readonly reason: ModelLoadErrorReason;

  constructor(reason: ModelLoadErrorReason, cause?: unknown) {
    super(REASON_MESSAGES[reason]);
    this.name = 'ModelLoadError';
    this.reason = reason;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function classifyError(error: unknown): ModelLoadErrorReason {
  if (typeof WebAssembly === 'undefined') {
    return 'unsupported';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network|load failed|404|not found/i.test(message)) {
    return 'network';
  }
  if (/wasm|webassembly|module|simd/i.test(message)) {
    return 'wasm';
  }
  return 'unknown';
}

let wasmFilesetPromise: Promise<WasmFileset> | null = null;

function getWasmFileset(): Promise<WasmFileset> {
  if (wasmFilesetPromise === null) {
    wasmFilesetPromise = FilesetResolver.forVisionTasks(WASM_PATH).catch((error: unknown) => {
      // Do not cache a failure: a later call after the network recovers
      // is allowed to try again.
      wasmFilesetPromise = null;
      throw error;
    });
  }
  return wasmFilesetPromise;
}

type LandmarkerClass = {
  createFromOptions: (
    wasmFileset: WasmFileset,
    options: Record<string, unknown>,
  ) => Promise<AnyLandmarker>;
};

const LANDMARKER_CLASSES: Record<LandmarkerKind, LandmarkerClass> = {
  face: FaceLandmarker as unknown as LandmarkerClass,
  pose: PoseLandmarker as unknown as LandmarkerClass,
  hand: HandLandmarker as unknown as LandmarkerClass,
};

export type RunningMode = 'VIDEO' | 'IMAGE';

function landmarkerOptions(
  kind: LandmarkerKind,
  delegate: 'GPU' | 'CPU',
  runningMode: RunningMode,
): Record<string, unknown> {
  const baseOptions = { modelAssetPath: MODEL_PATHS[kind], delegate };
  switch (kind) {
    case 'face':
      return {
        baseOptions,
        runningMode,
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      };
    case 'pose':
      return { baseOptions, runningMode, numPoses: 1 };
    case 'hand':
      return { baseOptions, runningMode, numHands: 1 };
  }
}

async function createLandmarker(
  kind: LandmarkerKind,
  runningMode: RunningMode,
): Promise<AnyLandmarker> {
  if (typeof WebAssembly === 'undefined') {
    throw new ModelLoadError('unsupported');
  }
  let wasmFileset: WasmFileset;
  try {
    wasmFileset = await getWasmFileset();
  } catch (error) {
    throw new ModelLoadError(classifyError(error), error);
  }
  const landmarkerClass = LANDMARKER_CLASSES[kind];
  try {
    return await landmarkerClass.createFromOptions(
      wasmFileset,
      landmarkerOptions(kind, 'GPU', runningMode),
    );
  } catch (gpuError) {
    // Plenty of devices advertise WebGL but cannot run the GPU delegate.
    // One automatic retry on CPU is a loading strategy, not a data
    // fallback: the measurement itself is identical either way.
    try {
      return await landmarkerClass.createFromOptions(
        wasmFileset,
        landmarkerOptions(kind, 'CPU', runningMode),
      );
    } catch {
      throw new ModelLoadError(classifyError(gpuError), gpuError);
    }
  }
}

// Session state, one bucket per running mode. Inside a bucket,
// `pending` holds the in-flight load per kind so two simultaneous
// calls share one model download, and `active` holds the one resolved
// landmarker currently allowed to run in that mode.
type LandmarkerSession = {
  pending: Map<LandmarkerKind, Promise<AnyLandmarker>>;
  active: { kind: LandmarkerKind; instance: AnyLandmarker } | null;
};

function newSession(): LandmarkerSession {
  return { pending: new Map(), active: null };
}

const videoSession = newSession();
const imageSession = newSession();

function closeQuietly(instance: AnyLandmarker): void {
  try {
    instance.close();
  } catch {
    // Closing is best-effort cleanup; a failed close must not break the
    // feature that is trying to open the next landmarker.
  }
}

function retireOtherKinds(session: LandmarkerSession, keep: LandmarkerKind): void {
  if (session.active !== null && session.active.kind !== keep) {
    closeQuietly(session.active.instance);
    session.active = null;
  }
  for (const [otherKind, load] of [...session.pending.entries()]) {
    if (otherKind === keep) {
      continue;
    }
    session.pending.delete(otherKind);
    // A load that finishes after being retired is closed on arrival so
    // it can never become a second running landmarker.
    void load.then(
      (instance) => {
        if (
          session.active === null ||
          session.active.kind !== otherKind ||
          session.active.instance !== instance
        ) {
          closeQuietly(instance);
        }
      },
      () => undefined,
    );
  }
}

function acquire(
  session: LandmarkerSession,
  kind: LandmarkerKind,
  runningMode: RunningMode,
): Promise<AnyLandmarker> {
  if (session.active !== null && session.active.kind === kind) {
    return Promise.resolve(session.active.instance);
  }
  const existing = session.pending.get(kind);
  if (existing !== undefined) {
    return existing;
  }
  retireOtherKinds(session, kind);
  const load = createLandmarker(kind, runningMode).then(
    (instance) => {
      if (session.pending.get(kind) === load) {
        session.pending.delete(kind);
        session.active = { kind, instance };
      } else {
        // Retired while loading; retireOtherKinds already arranged the
        // close, so do not also adopt this instance as active.
      }
      return instance;
    },
    (error: unknown) => {
      if (session.pending.get(kind) === load) {
        session.pending.delete(kind);
      }
      throw error;
    },
  );
  session.pending.set(kind, load);
  return load;
}

export function getLandmarker(kind: 'face'): Promise<FaceLandmarker>;
export function getLandmarker(kind: 'pose'): Promise<PoseLandmarker>;
export function getLandmarker(kind: 'hand'): Promise<HandLandmarker>;
export function getLandmarker(kind: LandmarkerKind): Promise<AnyLandmarker>;
export function getLandmarker(kind: LandmarkerKind): Promise<AnyLandmarker> {
  return acquire(videoSession, kind, 'VIDEO');
}

// The IMAGE-mode twin of getLandmarker, for analyzing uploaded still
// images through analyzeImageFile. Same loading behaviour, same GPU
// then CPU fallback, same ModelLoadError surface, but its own session
// bucket: it never closes or reuses a VIDEO landmarker.
export function getImageLandmarker(kind: 'face'): Promise<FaceLandmarker>;
export function getImageLandmarker(kind: 'pose'): Promise<PoseLandmarker>;
export function getImageLandmarker(kind: 'hand'): Promise<HandLandmarker>;
export function getImageLandmarker(kind: LandmarkerKind): Promise<AnyLandmarker>;
export function getImageLandmarker(kind: LandmarkerKind): Promise<AnyLandmarker> {
  return acquire(imageSession, kind, 'IMAGE');
}

function closeSession(session: LandmarkerSession): void {
  if (session.active !== null) {
    closeQuietly(session.active.instance);
    session.active = null;
  }
  for (const load of session.pending.values()) {
    void load.then(
      (instance) => closeQuietly(instance),
      () => undefined,
    );
  }
  session.pending.clear();
}

export function closeAllLandmarkers(): void {
  closeSession(videoSession);
  closeSession(imageSession);
}
