// Uploaded-file analysis and extraction, built on the shared engine.
//
// Two families of helpers live here:
//
// - On-device analysis (analyzeImageFile, analyzeVideoFile): an
//   uploaded photo or video is run through the same MediaPipe
//   landmarkers the live camera features use, and the raw detections
//   are mapped into plain frame data that the existing signal
//   functions in the features consume. The file never leaves the
//   device on this path.
// - Data URL extraction (imageFileToDataUrl, extractVideoFrames):
//   downscaled JPEG data URLs prepared on the device so a feature can
//   send them to the Worker for AI analysis. These two functions are
//   pure extraction: no landmarker is loaded and nothing is measured.
//
// Error policy, chosen deliberately and kept consistent: a media file
// the browser cannot decode (an unreadable photo, a video whose
// duration cannot be read) rejects with a plain Error whose message
// says what is wrong with the file. Model problems keep surfacing as
// ModelLoadError from the engine. Keeping the two apart lets features
// give the right advice: pick a different file, or fix the connection.

import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

import { getImageLandmarker, getLandmarker, type LandmarkerKind } from './engine';

export type FrameResult = {
  tMs: number;
  landmarks: NormalizedLandmark[] | null;
  blendshapes: Record<string, number> | null;
};

export type ImageAnalysis = {
  landmarks: NormalizedLandmark[] | null;
  blendshapes: Record<string, number> | null;
  width: number;
  height: number;
};

export type ExtractedFrame = {
  dataUrl: string;
  tMs: number;
};

export type BlendshapeCategoryLike = {
  categoryName: string;
  score: number;
};

const MAX_VIDEO_FRAMES = 300;
const DEFAULT_SAMPLE_FPS = 10;
const DEFAULT_FRAME_MAX_DIM = 1024;
const JPEG_QUALITY = 0.85;

// The structural slice of a detection result this module reads. The
// three landmarker result types differ in field names, so mapping is
// done against these optional fields instead of importing each type.
type RawDetectResult = {
  faceLandmarks?: NormalizedLandmark[][];
  faceBlendshapes?: Array<{ categories: BlendshapeCategoryLike[] }>;
  landmarks?: NormalizedLandmark[][];
};

type Detector = {
  detect: (image: HTMLImageElement) => RawDetectResult;
  detectForVideo: (frame: HTMLCanvasElement, timestamp: number) => RawDetectResult;
};

/** Map blendshape categories to a plain name to score record. When a
 * name appears twice, the later category wins, matching the record
 * assignment the live face features already use. */
export function blendshapeMap(
  categories: readonly BlendshapeCategoryLike[],
): Record<string, number> {
  const record: Record<string, number> = {};
  for (const category of categories) {
    record[category.categoryName] = category.score;
  }
  return record;
}

function mapResult(
  kind: LandmarkerKind,
  result: RawDetectResult,
): { landmarks: NormalizedLandmark[] | null; blendshapes: Record<string, number> | null } {
  if (kind === 'face') {
    const firstBlendshapes = result.faceBlendshapes?.[0];
    return {
      landmarks: result.faceLandmarks?.[0] ?? null,
      blendshapes:
        firstBlendshapes !== undefined ? blendshapeMap(firstBlendshapes.categories) : null,
    };
  }
  return { landmarks: result.landmarks?.[0] ?? null, blendshapes: null };
}

/** Frame sample times (ms) for on-device video analysis: starts at 0,
 * steps by the requested rate, stays below the duration, never has
 * duplicates, and is thinned evenly when it would exceed maxFrames.
 * An unreadable duration or a non-positive cap yields no times. */
export function sampleTimes(durationMs: number, fps: number, maxFrames: number): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || maxFrames <= 0) {
    return [];
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    return [0];
  }
  const stepMs = 1000 / fps;
  const times: number[] = [];
  for (let t = 0; t < durationMs; t += stepMs) {
    const rounded = Math.round(t);
    if (times.length === 0 || rounded > times[times.length - 1]) {
      times.push(rounded);
    }
  }
  if (times.length === 0) {
    times.push(0);
  }
  if (times.length > maxFrames) {
    const stride = times.length / maxFrames;
    const thinned: number[] = [];
    for (let i = 0; i < maxFrames; i += 1) {
      thinned.push(times[Math.floor(i * stride)]);
    }
    return thinned;
  }
  return times;
}

/** Frame times (ms) for extraction: maxFrames moments spread evenly
 * across the whole duration, the first near the start and the last
 * near the end (each inset by the smaller of 500 ms or 5 percent of
 * the duration, so the first and last frames are real content rather
 * than a black head or tail). Strictly increasing, duplicates dropped.
 * An unreadable duration or a non-positive cap yields no times. */
export function frameTimes(durationMs: number, maxFrames: number): number[] {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || maxFrames <= 0) {
    return [];
  }
  if (maxFrames === 1) {
    return [0];
  }
  const inset = Math.min(500, durationMs * 0.05);
  const start = inset;
  const end = durationMs - inset;
  const times: number[] = [];
  for (let i = 0; i < maxFrames; i += 1) {
    const t = Math.round(start + ((end - start) * i) / (maxFrames - 1));
    if (times.length === 0 || t > times[times.length - 1]) {
      times.push(t);
    }
  }
  return times;
}

/** Fit width and height inside a maximum longest side. Dimensions
 * already inside the limit are returned unchanged: extraction never
 * upscales. */
export function fitWithin(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxDim <= 0) {
    return { width, height };
  }
  const longest = Math.max(width, height);
  if (longest <= maxDim) {
    return { width, height };
  }
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      reject(new Error('That image could not be read. Try a different image file.'));
    };
    image.src = src;
  });
}

function createVideoElement(src: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;
  return video;
}

function waitForVideoMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        new Error('That video could not be read. Try a different video file, such as MP4 or WebM.'),
      );
    };
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

function seekVideoTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  if (video.readyState >= 2 && Math.abs(video.currentTime - seconds) < 0.01) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        new Error('That video could not be read. Try a different video file, such as MP4 or WebM.'),
      );
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = seconds;
  });
}

function videoDurationMs(video: HTMLVideoElement): number {
  const durationMs = Math.round(video.duration * 1000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    // Some screen recordings report an endless or missing duration.
    // Sampling such a file would silently produce wrong frame times,
    // so it is rejected instead.
    throw new Error(
      'The length of that video could not be read. Try a different recording, such as MP4 or WebM.',
    );
  }
  return durationMs;
}

function releaseVideo(video: HTMLVideoElement, url: string): void {
  video.removeAttribute('src');
  video.load();
  URL.revokeObjectURL(url);
}

function drawToJpegDataUrl(
  source: HTMLImageElement | HTMLVideoElement,
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number,
): string {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('This browser could not prepare the image. Try a different browser.');
  }
  context.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Analyze one uploaded image on the device. Nothing detected is a
 * normal result (landmarks null), never an error. */
export async function analyzeImageFile(
  kind: LandmarkerKind,
  file: File,
): Promise<ImageAnalysis> {
  const landmarker = (await getImageLandmarker(kind)) as unknown as Detector;
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(url);
    const mapped = mapResult(kind, landmarker.detect(image));
    return {
      landmarks: mapped.landmarks,
      blendshapes: mapped.blendshapes,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Analyze one uploaded video on the device by sampling frames at
 * sampleFps (default 10, at most 300 frames). Frames with no
 * detection are kept with landmarks null, so gaps stay visible to the
 * caller's signal functions instead of being silently dropped. */
export async function analyzeVideoFile(
  kind: LandmarkerKind,
  file: File,
  opts?: { sampleFps?: number; onProgress?: (ratio: number) => void },
): Promise<{ frames: FrameResult[]; durationMs: number; width: number; height: number }> {
  const landmarker = (await getLandmarker(kind)) as unknown as Detector;
  const url = URL.createObjectURL(file);
  const video = createVideoElement(url);
  try {
    await waitForVideoMetadata(video);
    const durationMs = videoDurationMs(video);
    const width = video.videoWidth;
    const height = video.videoHeight;
    const times = sampleTimes(durationMs, opts?.sampleFps ?? DEFAULT_SAMPLE_FPS, MAX_VIDEO_FRAMES);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('This browser could not read video frames. Try a different browser.');
    }
    const frames: FrameResult[] = [];
    opts?.onProgress?.(0);
    for (let i = 0; i < times.length; i += 1) {
      await seekVideoTo(video, times[i] / 1000);
      context.drawImage(video, 0, 0, width, height);
      // The synthetic timestamp only has to rise monotonically for the
      // VIDEO landmarker; frame index times 100 guarantees that even
      // when the element's currentTime lands imprecisely.
      const mapped = mapResult(kind, landmarker.detectForVideo(canvas, i * 100));
      frames.push({ tMs: times[i], landmarks: mapped.landmarks, blendshapes: mapped.blendshapes });
      opts?.onProgress?.((i + 1) / times.length);
    }
    return { frames, durationMs, width, height };
  } finally {
    releaseVideo(video, url);
  }
}

/** Downscale an uploaded image to a JPEG data URL whose longest side
 * is at most maxDim (default 1024), ready to send to the Worker.
 * Images already small enough keep their size. Pure extraction: no
 * landmarker is involved. */
export async function imageFileToDataUrl(file: File, maxDim: number = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(url);
    return drawToJpegDataUrl(image, image.naturalWidth, image.naturalHeight, maxDim);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Extract up to maxFrames (default 6) JPEG data URLs spread evenly
 * across an uploaded video, each downscaled to a 1024 longest side,
 * with the frame time in milliseconds. Pure extraction: no
 * landmarker is involved. */
export async function extractVideoFrames(
  file: File,
  maxFrames: number = 6,
): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(file);
  const video = createVideoElement(url);
  try {
    await waitForVideoMetadata(video);
    const durationMs = videoDurationMs(video);
    const times = frameTimes(durationMs, maxFrames);
    const extracted: ExtractedFrame[] = [];
    for (const tMs of times) {
      await seekVideoTo(video, tMs / 1000);
      extracted.push({
        dataUrl: drawToJpegDataUrl(video, video.videoWidth, video.videoHeight, DEFAULT_FRAME_MAX_DIM),
        tMs,
      });
    }
    return extracted;
  } finally {
    releaseVideo(video, url);
  }
}
