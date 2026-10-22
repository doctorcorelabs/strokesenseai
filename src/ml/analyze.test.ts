import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mirrors the engine.test.ts approach: the MediaPipe module is
// replaced by an in-memory double whose instances return canned
// detection results, so the result mapping in analyze.ts can be
// verified without a model, a camera, or a network. Image, video, and
// canvas elements are stubbed for the parts jsdom cannot do (image
// decoding from object URLs, media seeking, 2d raster output); the
// pure time and mapping helpers are tested directly.

type FakeLandmarkerInstance = {
  cls: string;
  closed: boolean;
  close: () => void;
  detect: () => unknown;
  detectForVideo: (frame: unknown, timestamp: number) => unknown;
};

const mockState = vi.hoisted(() => ({
  createCalls: [] as Array<{ cls: string; options: Record<string, unknown> }>,
  instances: [] as FakeLandmarkerInstance[],
  imageResult: null as unknown,
  videoResult: null as unknown,
  videoTimestamps: [] as number[],
  canvases: [] as Array<{ width: number; height: number }>,
  reset() {
    this.createCalls.length = 0;
    this.instances.length = 0;
    this.imageResult = null;
    this.videoResult = null;
    this.videoTimestamps.length = 0;
    this.canvases.length = 0;
  },
}));

vi.mock('@mediapipe/tasks-vision', () => {
  const makeClass = (cls: string) => ({
    createFromOptions: async (
      _wasmFileset: unknown,
      options: Record<string, unknown>,
    ): Promise<FakeLandmarkerInstance> => {
      mockState.createCalls.push({ cls, options });
      const instance: FakeLandmarkerInstance = {
        cls,
        closed: false,
        close() {
          this.closed = true;
        },
        detect: () => mockState.imageResult,
        detectForVideo: (_frame: unknown, timestamp: number) => {
          mockState.videoTimestamps.push(timestamp);
          return mockState.videoResult;
        },
      };
      mockState.instances.push(instance);
      return instance;
    },
  });
  return {
    FilesetResolver: {
      forVisionTasks: async () => ({ wasm: 'fake-fileset' }),
    },
    FaceLandmarker: makeClass('face'),
    PoseLandmarker: makeClass('pose'),
    HandLandmarker: makeClass('hand'),
  };
});

class FakeImage {
  static nextWidth = 640;
  static nextHeight = 480;

  naturalWidth = FakeImage.nextWidth;
  naturalHeight = FakeImage.nextHeight;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

class FakeVideo {
  static mode: 'ready' | 'error' = 'ready';
  static nextDuration = 2;
  static nextWidth = 320;
  static nextHeight = 240;

  private listeners = new Map<string, Set<() => void>>();
  private currentTimeValue = 0;

  muted = false;
  playsInline = false;
  preload = '';
  duration = FakeVideo.nextDuration;
  videoWidth = FakeVideo.nextWidth;
  videoHeight = FakeVideo.nextHeight;
  readyState = FakeVideo.mode === 'ready' ? 4 : 0;

  get currentTime(): number {
    return this.currentTimeValue;
  }

  set currentTime(value: number) {
    this.currentTimeValue = value;
    this.emit('seeked');
  }

  set src(_value: string) {
    if (FakeVideo.mode === 'error') {
      queueMicrotask(() => this.emit('error'));
    }
  }

  addEventListener(name: string, fn: () => void): void {
    if (!this.listeners.has(name)) {
      this.listeners.set(name, new Set());
    }
    this.listeners.get(name)?.add(fn);
  }

  removeEventListener(name: string, fn: () => void): void {
    this.listeners.get(name)?.delete(fn);
  }

  removeAttribute(): void {}

  load(): void {}

  private emit(name: string): void {
    for (const fn of [...(this.listeners.get(name) ?? [])]) {
      fn();
    }
  }
}

class FakeCanvas {
  width = 0;
  height = 0;

  getContext(): { drawImage: () => void } {
    return { drawImage: () => undefined };
  }

  toDataURL(): string {
    mockState.canvases.push({ width: this.width, height: this.height });
    return 'data:image/jpeg;base64,FAKE';
  }
}

const revokeObjectUrl = vi.fn();
const originalCreateElement = document.createElement.bind(document);
let createElementSpy: { mockRestore: () => void } | null = null;

async function loadAnalyze() {
  vi.resetModules();
  return import('./analyze');
}

beforeEach(() => {
  mockState.reset();
  FakeImage.nextWidth = 640;
  FakeImage.nextHeight = 480;
  FakeVideo.mode = 'ready';
  FakeVideo.nextDuration = 2;
  FakeVideo.nextWidth = 320;
  FakeVideo.nextHeight = 240;
  revokeObjectUrl.mockClear();
  (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:fake');
  (URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectUrl;
  vi.stubGlobal('Image', FakeImage);
  createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return new FakeVideo();
      }
      if (tagName === 'canvas') {
        return new FakeCanvas();
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
});

afterEach(() => {
  createElementSpy?.mockRestore();
  createElementSpy = null;
  vi.unstubAllGlobals();
  delete (URL as unknown as Record<string, unknown>).createObjectURL;
  delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
});

function fakeFile(name: string, type: string): File {
  return new File(['fake-bytes'], name, { type });
}

describe('sampleTimes', () => {
  it('returns no times for an unreadable or empty duration', async () => {
    const { sampleTimes } = await loadAnalyze();
    expect(sampleTimes(0, 10, 300)).toEqual([]);
    expect(sampleTimes(-100, 10, 300)).toEqual([]);
    expect(sampleTimes(Number.NaN, 10, 300)).toEqual([]);
    expect(sampleTimes(1000, 10, 0)).toEqual([]);
  });

  it('steps from 0 by the requested rate and stays below the duration', async () => {
    const { sampleTimes } = await loadAnalyze();
    const times = sampleTimes(10_000, 10, 300);
    expect(times).toHaveLength(100);
    expect(times[0]).toBe(0);
    expect(times[times.length - 1]).toBe(9900);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('thins evenly when a high rate would exceed the frame cap', async () => {
    const { sampleTimes } = await loadAnalyze();
    const times = sampleTimes(60_000, 1000, 300);
    expect(times).toHaveLength(300);
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('falls back to a single frame at 0 for a non-positive rate', async () => {
    const { sampleTimes } = await loadAnalyze();
    expect(sampleTimes(5000, 0, 300)).toEqual([0]);
  });
});

describe('blendshapeMap', () => {
  it('maps category names to scores', async () => {
    const { blendshapeMap } = await loadAnalyze();
    expect(
      blendshapeMap([
        { categoryName: 'mouthSmileLeft', score: 0.7 },
        { categoryName: 'mouthSmileRight', score: 0.25 },
      ]),
    ).toEqual({ mouthSmileLeft: 0.7, mouthSmileRight: 0.25 });
  });

  it('returns an empty record for no categories', async () => {
    const { blendshapeMap } = await loadAnalyze();
    expect(blendshapeMap([])).toEqual({});
  });

  it('lets the later duplicate name win', async () => {
    const { blendshapeMap } = await loadAnalyze();
    expect(
      blendshapeMap([
        { categoryName: 'jawOpen', score: 0.1 },
        { categoryName: 'jawOpen', score: 0.9 },
      ]),
    ).toEqual({ jawOpen: 0.9 });
  });
});

describe('frameTimes', () => {
  it('returns no times for an unreadable duration or a non-positive cap', async () => {
    const { frameTimes } = await loadAnalyze();
    expect(frameTimes(0, 6)).toEqual([]);
    expect(frameTimes(Number.NaN, 6)).toEqual([]);
    expect(frameTimes(2000, 0)).toEqual([]);
  });

  it('spreads frames evenly, inset from both ends', async () => {
    const { frameTimes } = await loadAnalyze();
    expect(frameTimes(2000, 6)).toEqual([100, 460, 820, 1180, 1540, 1900]);
    expect(frameTimes(2000, 3)).toEqual([100, 1000, 1900]);
  });

  it('returns a single frame at 0 when only one is requested', async () => {
    const { frameTimes } = await loadAnalyze();
    expect(frameTimes(10_000, 1)).toEqual([0]);
  });

  it('stays strictly increasing even for very short durations', async () => {
    const { frameTimes } = await loadAnalyze();
    const times = frameTimes(100, 6);
    expect(times.length).toBeGreaterThan(0);
    expect(times[0]).toBeGreaterThanOrEqual(0);
    expect(times[times.length - 1]).toBeLessThanOrEqual(100);
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

describe('fitWithin', () => {
  it('downscales the longest side to the limit, keeping the ratio', async () => {
    const { fitWithin } = await loadAnalyze();
    expect(fitWithin(2000, 1000, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('never upscales dimensions already inside the limit', async () => {
    const { fitWithin } = await loadAnalyze();
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1024, 1024, 1024)).toEqual({ width: 1024, height: 1024 });
  });
});

describe('analyzeImageFile', () => {
  it('maps the first face and its blendshapes, through an IMAGE landmarker', async () => {
    const point = { x: 0.5, y: 0.5, z: 0 };
    mockState.imageResult = {
      faceLandmarks: [[point]],
      faceBlendshapes: [{ categories: [{ categoryName: 'mouthSmileLeft', score: 0.7 }] }],
    };
    const { analyzeImageFile } = await loadAnalyze();
    const result = await analyzeImageFile('face', fakeFile('face.jpg', 'image/jpeg'));
    expect(result.landmarks).toEqual([point]);
    expect(result.blendshapes).toEqual({ mouthSmileLeft: 0.7 });
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(mockState.createCalls.some((call) => call.options.runningMode === 'IMAGE')).toBe(true);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:fake');
  });

  it('returns null landmarks (not an error) when a pose photo has no detection', async () => {
    mockState.imageResult = { landmarks: [] };
    const { analyzeImageFile } = await loadAnalyze();
    const result = await analyzeImageFile('pose', fakeFile('pose.jpg', 'image/jpeg'));
    expect(result.landmarks).toBeNull();
    expect(result.blendshapes).toBeNull();
  });

  it('maps pose landmarks and never reports blendshapes for non-face kinds', async () => {
    const point = { x: 0.1, y: 0.2, z: 0 };
    mockState.imageResult = { landmarks: [[point]] };
    const { analyzeImageFile } = await loadAnalyze();
    const result = await analyzeImageFile('pose', fakeFile('pose.jpg', 'image/jpeg'));
    expect(result.landmarks).toEqual([point]);
    expect(result.blendshapes).toBeNull();
  });
});

describe('analyzeVideoFile', () => {
  it('samples frames, feeds rising synthetic timestamps, and reports progress to 1', async () => {
    const point = { x: 0.5, y: 0.5, z: 0 };
    mockState.videoResult = { landmarks: [[point]] };
    const progress: number[] = [];
    const { analyzeVideoFile } = await loadAnalyze();
    const result = await analyzeVideoFile('pose', fakeFile('clip.mp4', 'video/mp4'), {
      sampleFps: 2,
      onProgress: (ratio) => progress.push(ratio),
    });
    expect(result.durationMs).toBe(2000);
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(result.frames.map((frame) => frame.tMs)).toEqual([0, 500, 1000, 1500]);
    expect(result.frames.every((frame) => frame.landmarks !== null)).toBe(true);
    expect(mockState.videoTimestamps).toEqual([0, 100, 200, 300]);
    expect(progress[progress.length - 1]).toBe(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:fake');
  });

  it('keeps frames with null landmarks when nothing is detected', async () => {
    mockState.videoResult = { landmarks: [] };
    const { analyzeVideoFile } = await loadAnalyze();
    const result = await analyzeVideoFile('hand', fakeFile('clip.mp4', 'video/mp4'), {
      sampleFps: 2,
    });
    expect(result.frames).toHaveLength(4);
    expect(result.frames.every((frame) => frame.landmarks === null)).toBe(true);
  });

  it('rejects with a clear file error when the video cannot be read', async () => {
    FakeVideo.mode = 'error';
    const { analyzeVideoFile } = await loadAnalyze();
    await expect(
      analyzeVideoFile('pose', fakeFile('bad.mp4', 'video/mp4')),
    ).rejects.toThrow(/could not be read/);
  });
});

describe('imageFileToDataUrl', () => {
  it('encodes a small image at its own size', async () => {
    const { imageFileToDataUrl } = await loadAnalyze();
    const dataUrl = await imageFileToDataUrl(fakeFile('small.jpg', 'image/jpeg'));
    expect(dataUrl).toBe('data:image/jpeg;base64,FAKE');
    expect(mockState.canvases).toEqual([{ width: 640, height: 480 }]);
  });

  it('downscales a large image so the longest side fits the limit', async () => {
    FakeImage.nextWidth = 2000;
    FakeImage.nextHeight = 1000;
    const { imageFileToDataUrl } = await loadAnalyze();
    await imageFileToDataUrl(fakeFile('big.jpg', 'image/jpeg'), 1024);
    expect(mockState.canvases).toEqual([{ width: 1024, height: 512 }]);
  });
});

describe('extractVideoFrames', () => {
  it('extracts the default six frames spread across the duration', async () => {
    const { extractVideoFrames } = await loadAnalyze();
    const frames = await extractVideoFrames(fakeFile('clip.mp4', 'video/mp4'));
    expect(frames.map((frame) => frame.tMs)).toEqual([100, 460, 820, 1180, 1540, 1900]);
    expect(frames.every((frame) => frame.dataUrl === 'data:image/jpeg;base64,FAKE')).toBe(true);
  });

  it('honours a smaller frame budget', async () => {
    const { extractVideoFrames } = await loadAnalyze();
    const frames = await extractVideoFrames(fakeFile('clip.mp4', 'video/mp4'), 3);
    expect(frames.map((frame) => frame.tMs)).toEqual([100, 1000, 1900]);
  });

  it('rejects with a clear file error when the video cannot be read', async () => {
    FakeVideo.mode = 'error';
    const { extractVideoFrames } = await loadAnalyze();
    await expect(extractVideoFrames(fakeFile('bad.mp4', 'video/mp4'))).rejects.toThrow(
      /could not be read/,
    );
  });
});
