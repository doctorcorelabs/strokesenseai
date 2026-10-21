// Shared capture building blocks for the vision face labs.
//
// Everything here runs locally in the browser: camera frames, uploaded
// photos, and snapshots live in component state (memory) only, are never
// uploaded, and can be deleted by the person at any time. Landmarks for
// real photos are placed by hand, click by click, because this build does
// not bundle a machine learning landmark model; the UI says so openly.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarks, LandmarkKey } from './geometry';
import { LANDMARK_KEYS } from './geometry';
import { laplacianVariance, lightingBalance, toGrayscale } from './imageStats';

// ---------------------------------------------------------------------------
// FaceSketch: SVG rendering of a landmark set (synthetic faces, overlays)
// ---------------------------------------------------------------------------

const CONNECTIONS: [LandmarkKey, LandmarkKey][] = [
  ['leftEyeOuter', 'leftEyeInner'],
  ['leftEyeTop', 'leftEyeBottom'],
  ['rightEyeOuter', 'rightEyeInner'],
  ['rightEyeTop', 'rightEyeBottom'],
  ['leftBrow', 'leftEyeTop'],
  ['rightBrow', 'rightEyeTop'],
  ['leftEyeInner', 'noseTip'],
  ['rightEyeInner', 'noseTip'],
  ['noseTip', 'mouthTop'],
  ['mouthLeft', 'mouthRight'],
  ['mouthTop', 'mouthBottom'],
  ['mouthLeft', 'mouthBottom'],
  ['mouthRight', 'mouthBottom'],
  ['mouthBottom', 'chin'],
];

export function FaceSketch({
  landmarks,
  showPoints = true,
  label,
}: {
  landmarks: FaceLandmarks;
  showPoints?: boolean;
  label: string;
}) {
  const cx = (landmarks.leftEyeOuter.x + landmarks.rightEyeOuter.x) / 2;
  const cy = (landmarks.chin.y + landmarks.leftBrow.y) / 2 - 0.04;
  const rx = Math.max(0.08, (landmarks.rightEyeOuter.x - landmarks.leftEyeOuter.x) * 0.78);
  const ry = Math.max(0.1, (landmarks.chin.y - landmarks.leftBrow.y) * 0.62);
  return (
    <svg
      className="vf-sketch"
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width="100" height="100" className="vf-sketch-bg" />
      <ellipse cx={cx * 100} cy={cy * 100} rx={rx * 100} ry={ry * 100} className="vf-sketch-outline" />
      {CONNECTIONS.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={landmarks[a].x * 100}
          y1={landmarks[a].y * 100}
          x2={landmarks[b].x * 100}
          y2={landmarks[b].y * 100}
          className="vf-sketch-line"
        />
      ))}
      {showPoints &&
        LANDMARK_KEYS.map((key) => (
          <circle
            key={key}
            cx={landmarks[key].x * 100}
            cy={landmarks[key].y * 100}
            r={1.1}
            className="vf-sketch-point"
          />
        ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// LandmarkPicker: click-to-place landmarks over an image or a blank stage
// ---------------------------------------------------------------------------

export function LandmarkPicker({
  imageUrl,
  placed,
  activeKey,
  onPlace,
}: {
  imageUrl: string | null;
  placed: Partial<Record<LandmarkKey, { x: number; y: number }>>;
  activeKey: LandmarkKey | null;
  onPlace: (key: LandmarkKey, point: { x: number; y: number }) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activeKey || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    onPlace(activeKey, { x, y });
  };

  return (
    <div
      ref={stageRef}
      className="vf-stage"
      onClick={handleClick}
      role="application"
      aria-label={
        activeKey
          ? `Landmark placement stage. Click to place the current landmark.`
          : 'Landmark placement stage. All landmarks placed.'
      }
    >
      {imageUrl ? (
        <img className="vf-stage-img" src={imageUrl} alt="Your captured face, shown locally only" />
      ) : (
        <div className="vf-stage-empty">No image yet. Upload a photo or take a snapshot.</div>
      )}
      <svg className="vf-stage-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {LANDMARK_KEYS.map((key, index) => {
          const point = placed[key];
          if (!point) return null;
          return (
            <g key={key}>
              <circle cx={point.x * 100} cy={point.y * 100} r={1.6} className="vf-stage-point" />
              <text x={point.x * 100 + 2.2} y={point.y * 100 + 1.2} className="vf-stage-point-label">
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pixel statistics for an image URL (upload or snapshot), computed locally
// ---------------------------------------------------------------------------

export interface ImageStats {
  sharpness: number;
  lightingBalance: number;
}

/**
 * Draw the image to an offscreen canvas at reduced size and compute the
 * quality statistics over the central face region. Returns null when the
 * browser cannot provide pixels (the caller then skips those checks and
 * says so). Nothing is uploaded; the canvas never leaves the tab.
 */
export function computeImageStats(imageUrl: string): Promise<ImageStats | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const maxDim = 480;
        const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
        const width = Math.max(3, Math.round(image.width * scale));
        const height = Math.max(3, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height);
        const gray = toGrayscale(pixels.data, width, height);
        resolve({
          sharpness: laplacianVariance(gray),
          lightingBalance: lightingBalance(gray, { x: 0.22, y: 0.12, width: 0.56, height: 0.76 }),
        });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}

// ---------------------------------------------------------------------------
// CameraCapture: live preview with a guide oval, snapshot to a data URL
// ---------------------------------------------------------------------------

export function CameraCapture({ onSnapshot }: { onSnapshot: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not offer camera access here. Use the upload option instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setRunning(true);
    } catch {
      setError('Camera access was not granted. Use the upload option instead; nothing was recorded.');
    }
  };

  const snapshot = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    // Mirror the preview so the snapshot matches what the person saw.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);
    onSnapshot(canvas.toDataURL('image/png'));
    stop();
  };

  return (
    <div className="vf-camera">
      <div className="vf-camera-frame">
        <video ref={videoRef} className="vf-camera-video" playsInline muted aria-label="Camera preview" />
        <div className="vf-camera-guide" aria-hidden="true" />
        {!running && <div className="vf-stage-empty">Camera is off. Your video is never uploaded.</div>}
      </div>
      {error && (
        <p className="vf-note" role="alert">
          {error}
        </p>
      )}
      <div className="vf-actions">
        {!running ? (
          <button type="button" className="btn btn-primary" onClick={start}>
            Start camera
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={snapshot}>
              Take snapshot
            </button>
            <button type="button" className="btn btn-ghost" onClick={stop}>
              Stop camera
            </button>
          </>
        )}
      </div>
      <p className="muted">
        Position your face inside the oval, in even light, looking straight at the camera. The
        snapshot stays in this tab and is processed on this device only.
      </p>
    </div>
  );
}

/** Read an uploaded file into a data URL, locally. Rejects non-images. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('That file is not an image.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}
