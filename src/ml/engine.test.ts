import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real MediaPipe package loads WASM and downloads nothing in tests:
// the whole module is replaced by an in-memory double that records how
// the engine asks for landmarkers, so singleton and lifecycle behaviour
// can be verified without a model, a camera, or a network. The doubles
// mirror the parts of the real API the engine uses: FilesetResolver
// .forVisionTasks and each landmarker class's createFromOptions plus
// close() on the returned instance.

type FakeInstance = {
  cls: string;
  closed: boolean;
  close: () => void;
};

const mockState = vi.hoisted(() => ({
  createCalls: [] as Array<{ cls: string; options: Record<string, unknown> }>,
  instances: [] as FakeInstance[],
  failModes: new Map<string, 'gpu' | 'always'>(),
  filesetPaths: [] as string[],
  reset() {
    this.createCalls.length = 0;
    this.instances.length = 0;
    this.failModes.clear();
    this.filesetPaths.length = 0;
  },
}));

vi.mock('@mediapipe/tasks-vision', () => {
  const makeClass = (cls: string) => ({
    createFromOptions: async (
      _wasmFileset: unknown,
      options: Record<string, unknown>,
    ): Promise<FakeInstance> => {
      mockState.createCalls.push({ cls, options });
      const fail = mockState.failModes.get(cls);
      const delegate = (options.baseOptions as { delegate?: string } | undefined)?.delegate;
      if (fail === 'always' || (fail === 'gpu' && delegate === 'GPU')) {
        throw new Error(`mock load failure for ${cls}`);
      }
      const instance: FakeInstance = {
        cls,
        closed: false,
        close() {
          this.closed = true;
        },
      };
      mockState.instances.push(instance);
      return instance;
    },
  });
  return {
    FilesetResolver: {
      forVisionTasks: async (basePath?: string) => {
        mockState.filesetPaths.push(basePath ?? '');
        return { wasm: 'fake-fileset' };
      },
    },
    FaceLandmarker: makeClass('face'),
    PoseLandmarker: makeClass('pose'),
    HandLandmarker: makeClass('hand'),
  };
});

async function loadEngine() {
  vi.resetModules();
  return import('./engine');
}

beforeEach(() => {
  mockState.reset();
});

describe('MODEL_PATHS', () => {
  it('points every kind at the self-hosted model file for that kind', async () => {
    const { MODEL_PATHS } = await loadEngine();
    expect(MODEL_PATHS).toEqual({
      face: '/models/face_landmarker.task',
      pose: '/models/pose_landmarker_lite.task',
      hand: '/models/hand_landmarker.task',
    });
  });
});

describe('getLandmarker', () => {
  it('resolves the WASM fileset from the self-hosted path, once per session', async () => {
    const { getLandmarker } = await loadEngine();
    await getLandmarker('face');
    await getLandmarker('pose');
    expect(mockState.filesetPaths).toEqual(['/mediapipe/wasm']);
  });

  it('creates the face landmarker with blendshapes and transformation matrices on', async () => {
    const { getLandmarker, MODEL_PATHS } = await loadEngine();
    await getLandmarker('face');
    expect(mockState.createCalls).toHaveLength(1);
    const options = mockState.createCalls[0].options as unknown as {
      baseOptions: { modelAssetPath: string; delegate: string };
      runningMode: string;
      numFaces: number;
      outputFaceBlendshapes: boolean;
      outputFacialTransformationMatrixes: boolean;
    };
    expect(options.baseOptions.modelAssetPath).toBe(MODEL_PATHS.face);
    expect(options.baseOptions.delegate).toBe('GPU');
    expect(options.runningMode).toBe('VIDEO');
    expect(options.numFaces).toBe(1);
    expect(options.outputFaceBlendshapes).toBe(true);
    expect(options.outputFacialTransformationMatrixes).toBe(true);
  });

  it('returns the same instance for repeated calls with the same kind', async () => {
    const { getLandmarker } = await loadEngine();
    const first = await getLandmarker('hand');
    const second = await getLandmarker('hand');
    expect(second).toBe(first);
    expect(mockState.createCalls).toHaveLength(1);
  });

  it('shares one in-flight load between simultaneous calls', async () => {
    const { getLandmarker } = await loadEngine();
    const [a, b] = await Promise.all([getLandmarker('pose'), getLandmarker('pose')]);
    expect(a).toBe(b);
    expect(mockState.createCalls).toHaveLength(1);
  });

  it('closes the previous landmarker when a different kind is loaded', async () => {
    const { getLandmarker } = await loadEngine();
    const face = (await getLandmarker('face')) as unknown as FakeInstance;
    const pose = (await getLandmarker('pose')) as unknown as FakeInstance;
    expect(face.closed).toBe(true);
    expect(pose.closed).toBe(false);
    expect(mockState.createCalls.map((call) => call.cls)).toEqual(['face', 'pose']);
  });

  it('falls back to the CPU delegate when the GPU delegate fails', async () => {
    mockState.failModes.set('face', 'gpu');
    const { getLandmarker } = await loadEngine();
    const instance = (await getLandmarker('face')) as unknown as FakeInstance;
    expect(instance.closed).toBe(false);
    const delegates = mockState.createCalls.map(
      (call) => (call.options.baseOptions as { delegate: string }).delegate,
    );
    expect(delegates).toEqual(['GPU', 'CPU']);
  });

  it('rejects with a ModelLoadError when both delegates fail', async () => {
    mockState.failModes.set('pose', 'always');
    const { getLandmarker, ModelLoadError } = await loadEngine();
    const error: unknown = await getLandmarker('pose').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ModelLoadError);
    expect((error as InstanceType<typeof ModelLoadError>).reason).toBe('unknown');
    expect((error as Error).message).toContain('could not be loaded');
  });
});

describe('getImageLandmarker', () => {
  it('creates the landmarker in IMAGE running mode with the same face options', async () => {
    const { getImageLandmarker, MODEL_PATHS } = await loadEngine();
    await getImageLandmarker('face');
    expect(mockState.createCalls).toHaveLength(1);
    const options = mockState.createCalls[0].options as unknown as {
      baseOptions: { modelAssetPath: string; delegate: string };
      runningMode: string;
      outputFaceBlendshapes: boolean;
    };
    expect(options.baseOptions.modelAssetPath).toBe(MODEL_PATHS.face);
    expect(options.runningMode).toBe('IMAGE');
    expect(options.outputFaceBlendshapes).toBe(true);
  });

  it('returns the same instance for repeated calls with the same kind', async () => {
    const { getImageLandmarker } = await loadEngine();
    const first = await getImageLandmarker('pose');
    const second = await getImageLandmarker('pose');
    expect(second).toBe(first);
    expect(mockState.createCalls).toHaveLength(1);
  });

  it('keeps its own singleton: an IMAGE load does not close the VIDEO instance, and the reverse', async () => {
    const { getLandmarker, getImageLandmarker } = await loadEngine();
    const videoFace = (await getLandmarker('face')) as unknown as FakeInstance;
    const imageFace = (await getImageLandmarker('face')) as unknown as FakeInstance;
    expect(imageFace).not.toBe(videoFace);
    expect(videoFace.closed).toBe(false);
    expect(imageFace.closed).toBe(false);
    expect(mockState.createCalls.map((call) => call.options.runningMode)).toEqual([
      'VIDEO',
      'IMAGE',
    ]);
  });

  it('closes the previous image landmarker when a different image kind is loaded', async () => {
    const { getImageLandmarker } = await loadEngine();
    const face = (await getImageLandmarker('face')) as unknown as FakeInstance;
    const hand = (await getImageLandmarker('hand')) as unknown as FakeInstance;
    expect(face.closed).toBe(true);
    expect(hand.closed).toBe(false);
  });

  it('falls back to the CPU delegate when the GPU delegate fails', async () => {
    mockState.failModes.set('hand', 'gpu');
    const { getImageLandmarker } = await loadEngine();
    await getImageLandmarker('hand');
    const delegates = mockState.createCalls.map(
      (call) => (call.options.baseOptions as { delegate: string }).delegate,
    );
    expect(delegates).toEqual(['GPU', 'CPU']);
  });

  it('rejects with a ModelLoadError when both delegates fail', async () => {
    mockState.failModes.set('face', 'always');
    const { getImageLandmarker, ModelLoadError } = await loadEngine();
    const error: unknown = await getImageLandmarker('face').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ModelLoadError);
  });

  it('is also closed by closeAllLandmarkers', async () => {
    const { getImageLandmarker, closeAllLandmarkers } = await loadEngine();
    const first = (await getImageLandmarker('face')) as unknown as FakeInstance;
    closeAllLandmarkers();
    expect(first.closed).toBe(true);
    const second = (await getImageLandmarker('face')) as unknown as FakeInstance;
    expect(second).not.toBe(first);
    expect(mockState.createCalls).toHaveLength(2);
  });
});

describe('closeAllLandmarkers', () => {
  it('closes the active landmarker and lets the next call load a fresh one', async () => {
    const { getLandmarker, closeAllLandmarkers } = await loadEngine();
    const first = (await getLandmarker('face')) as unknown as FakeInstance;
    closeAllLandmarkers();
    expect(first.closed).toBe(true);
    const second = (await getLandmarker('face')) as unknown as FakeInstance;
    expect(second).not.toBe(first);
    expect(second.closed).toBe(false);
    expect(mockState.createCalls).toHaveLength(2);
  });

  it('is safe to call when nothing is loaded', async () => {
    const { closeAllLandmarkers } = await loadEngine();
    expect(() => closeAllLandmarkers()).not.toThrow();
  });
});
