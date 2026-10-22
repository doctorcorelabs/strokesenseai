// Movement Lab: two movement practices in one lab, three sources.
//
// The default source is an upload: the person picks a video they
// already have, the browser takes a few frames out of it locally, and
// only those frames go to the AI service, only when the person
// presses "Analyze with AI" (see upload.tsx). The AI describes what
// it can see; it does not measure.
//
// The second source is the live camera, measured on this device:
// Arm Raise follows each arm's projected angle (Pose Landmarker)
// while both arms are held out to the sides for 10 seconds, and Hand
// Lab counts real thumb-to-index taps (Hand Landmarker) for 10
// seconds per hand. Camera video is never uploaded or stored.
//
// The third source is a labelled demo that replays synthetic landmark
// series through the same calculations when no camera is available,
// and it never presents itself as a measurement.
//
// The pure math lives in angles.ts and tapping.ts; this file is the
// camera lifecycle, the live overlays, and the result sheets.

import { useEffect, useRef, useState } from 'react';
import type {
  HandLandmarker,
  NormalizedLandmark,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';
import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet } from '../../../shell';
import { EmergencyBanner } from '../../../components/ui';
import PermissionPrime, {
  PermissionDenied,
  permissionFailureFromError,
  type PermissionFailure,
} from '../../../components/PermissionPrime';
import { getLandmarker, ModelLoadError } from '../../../ml/engine';
import MovementUploadAnalyze, { AI_FRAMING_LINE } from './upload';
import { armProjectedAngle, smoothSeries, type ArmSide } from './angles';
import {
  detectTaps,
  normalizedPinchDistance,
  TAP_CLOSE_THRESHOLD,
  TAP_OPEN_THRESHOLD,
  type TapDetection,
  type TapSample,
} from './tapping';
import './movement-lab.css';

const HOLD_MS = 10_000;
const DEMO_LABEL = 'Demo data - not a measurement';

type Mode = 'arm' | 'hand';
type Source = 'camera' | 'demo';

interface ArmSideSummary {
  startDeg: number;
  endDeg: number;
  /** Start minus the lowest point reached, in degrees. */
  dropDeg: number;
  dippedBelow: boolean;
}

type Outcome =
  | {
      kind: 'arm';
      source: Source;
      headline: string;
      practiceLine: number;
      timesMs: number[];
      leftSeries: (number | null)[];
      rightSeries: (number | null)[];
      left: ArmSideSummary;
      right: ArmSideSummary;
    }
  | {
      kind: 'hand';
      source: Source;
      headline: string;
      durationMs: number;
      hands: Partial<Record<ArmSide, TapDetection>>;
    }
  | { kind: 'ai'; headline: string; observations: string[] }
  | { kind: 'emergency' }
  | { kind: 'cannot'; headline: string; reason: string; suggestion: string };

/** The three ways a mode can be fed: an uploaded video analyzed by
 * the AI (the default), the live camera measured on this device, or
 * the labelled demo. */
type DataSource = 'upload' | 'camera' | 'demo';

function SourceTabs({
  source,
  onSelect,
  label,
}: {
  source: DataSource;
  onSelect: (next: DataSource) => void;
  label: string;
}) {
  const options: { id: DataSource; text: string }[] = [
    { id: 'upload', text: 'Upload a video' },
    { id: 'camera', text: 'Use the camera' },
    { id: 'demo', text: 'Watch a demo' },
  ];
  return (
    <div className="mlab-tabs" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={source === option.id}
          className={`mlab-tab${source === option.id ? ' is-active' : ''}`}
          onClick={() => onSelect(option.id)}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

interface ArmSample {
  timeMs: number;
  left: number | null;
  right: number | null;
}

/** Deterministic pseudo random generator, so the demo is the same on
 * every visit and its numbers can be reasoned about in tests. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeSide(
  series: readonly (number | null)[],
  practiceLine: number,
): ArmSideSummary | null {
  const values = series.filter((value): value is number => value !== null);
  if (values.length < 5) return null;
  const startDeg = mean(values.slice(0, 5));
  const endDeg = mean(values.slice(-5));
  const lowest = Math.min(...values);
  return {
    startDeg,
    endDeg,
    dropDeg: startDeg - lowest,
    dippedBelow: lowest < practiceLine,
  };
}

function armHeadline(left: ArmSideSummary, right: ArmSideSummary): string {
  if (left.dippedBelow && right.dippedBelow) {
    return 'Both arms lowered below your practice line during this hold.';
  }
  if (left.dippedBelow) {
    return 'Your left arm lowered below your practice line; your right arm stayed above it.';
  }
  if (right.dippedBelow) {
    return 'Your right arm lowered below your practice line; your left arm stayed above it.';
  }
  return 'Both arms stayed above your practice line for the full hold.';
}

/** Turn raw hold samples into a finished arm outcome, applying the
 * honesty rule: if more than a third of the window is invalid, the
 * outcome is cannot-analyze with the specific side that was lost. */
function armOutcomeFromSamples(
  samples: ArmSample[],
  practiceLine: number,
  source: Source,
): Outcome {
  const total = samples.length;
  const missingLeft = samples.filter((sample) => sample.left === null).length;
  const missingRight = samples.filter((sample) => sample.right === null).length;
  const invalid = samples.filter(
    (sample) => sample.left === null || sample.right === null,
  ).length;
  if (total === 0 || invalid > total / 3) {
    const worseIsLeft = missingLeft >= missingRight;
    const missing = worseIsLeft ? missingLeft : missingRight;
    return {
      kind: 'cannot',
      headline: 'The camera could not follow both arms for the full hold.',
      reason: `Your ${worseIsLeft ? 'left' : 'right'} arm was out of view or not clear enough in ${missing} of ${total} sampled moments, so its angle was missing too often to describe honestly.`,
      suggestion:
        'Step back until both raised arms fit inside the frame, face a light source, and try again.',
    };
  }
  const leftSeries = smoothSeries(
    samples.map((sample) => sample.left),
    9,
  );
  const rightSeries = smoothSeries(
    samples.map((sample) => sample.right),
    9,
  );
  const left = summarizeSide(leftSeries, practiceLine);
  const right = summarizeSide(rightSeries, practiceLine);
  if (left === null || right === null) {
    return {
      kind: 'cannot',
      headline: 'The camera could not follow both arms for the full hold.',
      reason:
        'Too few clear moments were recorded to describe either arm honestly.',
      suggestion:
        'Step back until both raised arms fit inside the frame, face a light source, and try again.',
    };
  }
  return {
    kind: 'arm',
    source,
    headline: armHeadline(left, right),
    practiceLine,
    timesMs: samples.map((sample) => sample.timeMs),
    leftSeries,
    rightSeries,
    left,
    right,
  };
}

/** Synthetic arm hold for the demo: the left arm stays near its start,
 * the right arm slowly lowers and crosses a 75 degree practice line. */
function demoArmSamples(): ArmSample[] {
  const rand = mulberry32(20261022);
  const samples: ArmSample[] = [];
  for (let t = 0; t <= HOLD_MS; t += 50) {
    const sec = t / 1000;
    samples.push({
      timeMs: t,
      left: 88 - sec * 0.35 + (rand() - 0.5) * 2,
      right: 90 - sec * sec * 0.22 + (rand() - 0.5) * 2,
    });
  }
  return samples;
}

function seriesPath(
  timesMs: readonly number[],
  values: readonly (number | null)[],
  width: number,
  height: number,
  maxDeg: number,
  durationMs: number,
): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i];
    if (value === null) {
      pen = false;
      continue;
    }
    const x = (timesMs[i] / durationMs) * width;
    const y = height - (Math.min(value, maxDeg) / maxDeg) * height;
    d += pen
      ? ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      : ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Two-line angle chart with the practice line drawn dashed. */
function ArmChart({
  timesMs,
  left,
  right,
  practiceLine,
  durationMs = HOLD_MS,
}: {
  timesMs: readonly number[];
  left: readonly (number | null)[];
  right: readonly (number | null)[];
  practiceLine: number;
  durationMs?: number;
}) {
  const width = 320;
  const height = 170;
  const maxDeg = 120;
  const lineY = height - (practiceLine / maxDeg) * height;
  return (
    <svg
      className="mlab-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Chart of the left and right arm angles during the hold"
    >
      <line
        x1={0}
        y1={lineY}
        x2={width}
        y2={lineY}
        stroke="#814c1c"
        strokeWidth={1.5}
        strokeDasharray="6 5"
      />
      <path
        d={seriesPath(timesMs, left, width, height, maxDeg, durationMs)}
        fill="none"
        stroke="#126454"
        strokeWidth={2.5}
      />
      <path
        d={seriesPath(timesMs, right, width, height, maxDeg, durationMs)}
        fill="none"
        stroke="#b45309"
        strokeWidth={2.5}
      />
    </svg>
  );
}

/** One row of dots per hand on a shared time axis: the rhythm strip. */
function RhythmStrip({
  rows,
  durationMs,
}: {
  rows: { label: string; tapTimesMs: number[] }[];
  durationMs: number;
}) {
  const width = 320;
  const rowHeight = 38;
  const height = rows.length * rowHeight + 6;
  return (
    <svg
      className="mlab-strip"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Rhythm strip of counted taps for each hand"
    >
      {rows.map((row, rowIndex) => {
        const y = rowIndex * rowHeight + rowHeight / 2;
        return (
          <g key={row.label}>
            <line x1={0} y1={y} x2={width} y2={y} stroke="#e2e8e2" strokeWidth={2} />
            {row.tapTimesMs.map((tapMs, tapIndex) => (
              <circle
                key={tapIndex}
                cx={(tapMs / durationMs) * width}
                cy={y}
                r={5}
                fill={rowIndex === 0 ? '#126454' : '#b45309'}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function stopStream(stream: MediaStream | null): void {
  if (stream === null) return;
  for (const track of stream.getTracks()) track.stop();
}

/* ------------------------------------------------------------------ */
/* Arm Raise mode                                                      */
/* ------------------------------------------------------------------ */

const POSE_INDEX = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24 },
} as const;

function drawArmOverlay(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | null,
  practiceLine: number,
): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (landmarks === null || w === 0) return;
  ctx.lineWidth = Math.max(2, w * 0.005);
  ctx.lineCap = 'round';
  for (const side of ['left', 'right'] as ArmSide[]) {
    const idx = POSE_INDEX[side];
    const s = landmarks[idx.shoulder];
    const e = landmarks[idx.elbow];
    const wr = landmarks[idx.wrist];
    const hp = landmarks[idx.hip];
    if (!s || !e || !wr || !hp) continue;
    const sx = s.x * w;
    const sy = s.y * h;
    // Torso line, faint.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hp.x * w, hp.y * h);
    ctx.stroke();
    // Arm polyline through the elbow; amber once below the practice line.
    const angle = armProjectedAngle(landmarks, side);
    const below = angle !== null && angle < practiceLine;
    ctx.strokeStyle = below ? '#f5a623' : '#7ee2b8';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(e.x * w, e.y * h);
    ctx.lineTo(wr.x * w, wr.y * h);
    ctx.stroke();
    // Practice line: the torso direction rotated toward the arm by the
    // practice angle, drawn dashed.
    const torsoAng = Math.atan2(hp.y - s.y, hp.x - s.x);
    const armAng = Math.atan2(wr.y - s.y, wr.x - s.x);
    let diff = armAng - torsoAng;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const dir = diff >= 0 ? 1 : -1;
    const practiceAng = torsoAng + dir * ((practiceLine * Math.PI) / 180);
    const armPx = Math.hypot((wr.x - s.x) * w, (wr.y - s.y) * h);
    const radius = Math.max(30, armPx * 1.1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(practiceAng) * radius, sy + Math.sin(practiceAng) * radius);
    ctx.stroke();
    ctx.setLineDash([]);
    // The measured arc between the torso line and the arm.
    ctx.beginPath();
    ctx.arc(sx, sy, radius * 0.55, torsoAng, torsoAng + diff, diff < 0);
    ctx.stroke();
  }
}

type ArmView = 'prime' | 'starting' | 'live' | 'demo';

function ArmRaiseMode({
  demoOnly,
  onOutcome,
}: {
  demoOnly: boolean;
  onOutcome: (outcome: Outcome) => void;
}) {
  const [view, setView] = useState<ArmView>(demoOnly ? 'demo' : 'prime');
  const [source, setSource] = useState<DataSource>(demoOnly ? 'demo' : 'upload');
  const [failure, setFailure] = useState<PermissionFailure | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [practiceLine, setPracticeLine] = useState(75);
  const [holding, setHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_MS / 1000);
  const [readout, setReadout] = useState<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });
  const [demoCount, setDemoCount] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef(0);
  const startTokenRef = useRef(0);
  const samplesRef = useRef<ArmSample[]>([]);
  const holdingRef = useRef(false);
  const holdStartRef = useRef(0);
  const lastSampleRef = useRef(0);
  const lastReadoutRef = useRef(0);
  const practiceLineRef = useRef(practiceLine);
  practiceLineRef.current = practiceLine;
  const demoTimerRef = useRef<number | null>(null);
  const demoSamplesRef = useRef<ArmSample[]>([]);

  function stopCamera(): void {
    cancelAnimationFrame(rafRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    holdingRef.current = false;
    setHolding(false);
  }

  useEffect(() => {
    return () => {
      stopCamera();
      if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishHold(): void {
    holdingRef.current = false;
    setHolding(false);
    onOutcome(armOutcomeFromSamples(samplesRef.current, practiceLineRef.current, 'camera'));
  }

  function runLoop(): void {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (video !== null && canvas !== null && landmarker !== null) {
      if (video.videoWidth > 0 && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result.landmarks?.[0] ?? null;
          drawArmOverlay(canvas, landmarks, practiceLineRef.current);
          const left = landmarks ? armProjectedAngle(landmarks, 'left') : null;
          const right = landmarks ? armProjectedAngle(landmarks, 'right') : null;
          const now = performance.now();
          if (now - lastReadoutRef.current > 150) {
            lastReadoutRef.current = now;
            setReadout({ left, right });
          }
          if (holdingRef.current && now - lastSampleRef.current >= 50) {
            lastSampleRef.current = now;
            samplesRef.current.push({ timeMs: now - holdStartRef.current, left, right });
            const elapsed = now - holdStartRef.current;
            setSecondsLeft(Math.max(0, Math.ceil((HOLD_MS - elapsed) / 1000)));
            if (elapsed >= HOLD_MS) finishHold();
          }
        } catch {
          // A skipped frame is a tracking gap, never a reason to crash.
        }
      }
    }
    rafRef.current = requestAnimationFrame(runLoop);
  }

  async function startSequence(token: number): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailure('unavailable');
      setView('prime');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (error) {
      if (startTokenRef.current !== token) return;
      setFailure(permissionFailureFromError(error));
      setView('prime');
      return;
    }
    if (startTokenRef.current !== token) {
      stopStream(stream);
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = stream;
      await video.play().catch(() => undefined);
    }
    try {
      landmarkerRef.current = await getLandmarker('pose');
    } catch (error) {
      if (startTokenRef.current !== token) return;
      stopCamera();
      setModelError(
        error instanceof ModelLoadError
          ? error.message
          : 'The vision model could not be loaded. Please try again.',
      );
      setView('prime');
      return;
    }
    if (startTokenRef.current !== token) return;
    setView('live');
    rafRef.current = requestAnimationFrame(runLoop);
  }

  function requestStart(): void {
    setFailure(null);
    setModelError(null);
    setView('starting');
    startTokenRef.current += 1;
    const token = startTokenRef.current;
    // Let the stage render so the video element exists, then start.
    requestAnimationFrame(() => {
      void startSequence(token);
    });
  }

  function beginHold(): void {
    samplesRef.current = [];
    holdStartRef.current = performance.now();
    lastSampleRef.current = 0;
    holdingRef.current = true;
    setSecondsLeft(HOLD_MS / 1000);
    setHolding(true);
  }

  function playDemo(): void {
    stopCamera();
    setView('demo');
    const samples = demoArmSamples();
    demoSamplesRef.current = samples;
    setDemoCount(0);
    setDemoPlaying(true);
    if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    let shown = 0;
    demoTimerRef.current = window.setInterval(() => {
      shown += 4;
      if (shown >= samples.length) {
        shown = samples.length;
        if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
        setDemoPlaying(false);
        onOutcome(armOutcomeFromSamples(samples, practiceLineRef.current, 'demo'));
      }
      setDemoCount(shown);
    }, 50);
  }

  function stopDemo(): void {
    if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
    setDemoPlaying(false);
  }

  function goDemo(): void {
    setSource('demo');
    playDemo();
  }

  function selectSource(next: DataSource): void {
    if (next === source) return;
    if (next === 'demo') {
      goDemo();
      return;
    }
    stopDemo();
    if (next === 'camera') {
      setSource('camera');
      setView('prime');
    } else {
      stopCamera();
      setSource('upload');
    }
  }

  const tabs = (
    <SourceTabs source={source} onSelect={selectSource} label="How to provide the arm hold" />
  );

  if (source === 'upload') {
    return (
      <div>
        {tabs}
        <MovementUploadAnalyze
          task="arm-video"
          uploadLabel="Upload a video of the arm hold"
          hint="Record from the front: raise both arms out to the sides and hold for about 10 seconds"
          fallbackHeadline="The AI described the arm hold in your upload."
          onOutcome={onOutcome}
        />
      </div>
    );
  }

  if (view === 'demo') {
    const samples = demoSamplesRef.current;
    const shown = samples.slice(0, demoCount);
    return (
      <div>
        {tabs}
        <span className="mlab-chip is-demo">{DEMO_LABEL}</span>
        <p>
          A recorded example session, played through the same angle calculations as a
          live hold. The right arm slowly lowers and crosses the practice line.
        </p>
        {shown.length > 0 ? (
          <ArmChart
            timesMs={shown.map((sample) => sample.timeMs)}
            left={shown.map((sample) => sample.left)}
            right={shown.map((sample) => sample.right)}
            practiceLine={practiceLine}
          />
        ) : null}
        <p className="muted">
          <span style={{ color: '#126454', fontWeight: 700 }}>Left arm</span>{' '}
          <span style={{ color: '#b45309', fontWeight: 700 }}>Right arm</span>{' '}
          <span style={{ color: '#814c1c' }}>- - practice line</span>
        </p>
        <div className="mlab-actions">
          <button type="button" className="btn btn-primary" onClick={playDemo}>
            {demoPlaying ? 'Restart the demo' : 'Play the demo'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {tabs}
      {failure !== null ? (
        <PermissionDenied
          device="camera"
          failure={failure}
          onRetry={requestStart}
          exits={[{ label: 'Watch a demo instead', onSelect: goDemo }]}
        />
      ) : modelError !== null ? (
        <div role="alert">
          <p>
            <strong>The arm tracking model could not start.</strong>
          </p>
          <p className="muted">{modelError}</p>
          <div className="mlab-actions">
            <button type="button" className="btn btn-primary" onClick={requestStart}>
              Try again
            </button>
            <button type="button" className="btn" onClick={goDemo}>
              Watch a demo instead
            </button>
          </div>
        </div>
      ) : view === 'prime' ? (
        <PermissionPrime
          device="camera"
          why="The camera follows your shoulders, elbows, and wrists while you hold both arms out, so the lab can chart each arm angle as it happens."
          onStart={requestStart}
          exits={[{ label: 'Watch a demo instead', onSelect: playDemo }]}
        />
      ) : null}

      {(view === 'starting' || view === 'live') && (
        <>
          <div className="mlab-stage">
            <video ref={videoRef} className="mlab-video" playsInline muted />
            <canvas ref={canvasRef} className="mlab-overlay" />
          </div>
          <div className="mlab-slider-row">
            <label htmlFor="mlab-practice-line">
              <strong>Practice line - not a medical limit</strong>: {practiceLine} degrees
            </label>
            <input
              id="mlab-practice-line"
              type="range"
              min={30}
              max={90}
              step={1}
              value={practiceLine}
              disabled={holding}
              onChange={(event) => setPracticeLine(Number(event.target.value))}
            />
          </div>
          <div className="mlab-readouts" aria-live="polite">
            <span
              className={`mlab-chip${readout.left !== null && readout.left < practiceLine ? ' is-below' : ''}`}
            >
              Left arm: {readout.left === null ? 'not in view' : `${Math.round(readout.left)} deg`}
            </span>
            <span
              className={`mlab-chip${readout.right !== null && readout.right < practiceLine ? ' is-below' : ''}`}
            >
              Right arm:{' '}
              {readout.right === null ? 'not in view' : `${Math.round(readout.right)} deg`}
            </span>
            {holding ? (
              <span className="mlab-countdown" aria-label="Seconds left">
                {secondsLeft}
              </span>
            ) : null}
          </div>
          {view === 'starting' ? (
            <p className="muted">Starting the camera and loading the pose model...</p>
          ) : (
            <>
              <p className="muted">
                Stand back until your head, shoulders, and both raised arms fit in the
                picture, then hold both arms out to the sides, palms down.
              </p>
              <div className="mlab-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={beginHold}
                  disabled={holding}
                >
                  {holding ? 'Holding...' : 'Start the 10 second hold'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    stopCamera();
                    setView('prime');
                  }}
                >
                  Stop camera
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hand Lab mode                                                       */
/* ------------------------------------------------------------------ */

const TEST_MS = 10_000;

function drawHandOverlay(
  canvas: HTMLCanvasElement,
  landmarks: NormalizedLandmark[] | null,
  distance: number | null,
): void {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (landmarks === null || w === 0) return;
  // All 21 points as small dots.
  ctx.fillStyle = 'rgba(126, 226, 184, 0.9)';
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * w, point.y * h, Math.max(2.5, w * 0.006), 0, Math.PI * 2);
    ctx.fill();
  }
  // The measured pair: thumb tip to index tip, amber while touching.
  const thumb = landmarks[4];
  const index = landmarks[8];
  if (thumb && index) {
    const touching = distance !== null && distance <= TAP_CLOSE_THRESHOLD;
    ctx.strokeStyle = touching ? '#f5a623' : '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(thumb.x * w, thumb.y * h);
    ctx.lineTo(index.x * w, index.y * h);
    ctx.stroke();
  }
}

/** Synthetic distance series for a set of tap times, run through the
 * same detector as live data so the demo shows real counting. */
function demoTapSamples(tapTimesMs: number[]): TapSample[] {
  const samples: TapSample[] = [];
  for (let t = 0; t <= TEST_MS; t += 40) {
    let distance = 0.95;
    for (const tapMs of tapTimesMs) {
      const bump = Math.exp(-(((t - tapMs) / 70) ** 2) / 2);
      distance = Math.min(distance, 0.95 - 0.78 * bump);
    }
    samples.push({ timeMs: t, distance });
  }
  return samples;
}

const DEMO_LEFT_TAPS = [600, 1400, 2200, 3000, 3800, 4600, 5400, 6200, 7000, 7800, 8600, 9400];
const DEMO_RIGHT_TAPS = [700, 1500, 2500, 3200, 4400, 5200, 6500, 7200, 8500, 9300];

function handHeadline(hands: Partial<Record<ArmSide, TapDetection>>): string {
  const parts: string[] = [];
  if (hands.left) parts.push(`your left hand tapped ${hands.left.count} times`);
  if (hands.right) parts.push(`your right hand tapped ${hands.right.count} times`);
  return `Counted from your hand movements: ${parts.join(', and ')}.`;
}

type HandView = 'prime' | 'starting' | 'live' | 'demo';

function HandLabMode({
  demoOnly,
  onOutcome,
}: {
  demoOnly: boolean;
  onOutcome: (outcome: Outcome) => void;
}) {
  const [view, setView] = useState<HandView>(demoOnly ? 'demo' : 'prime');
  const [source, setSource] = useState<DataSource>(demoOnly ? 'demo' : 'upload');
  const [failure, setFailure] = useState<PermissionFailure | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [chosenHand, setChosenHand] = useState<ArmSide>('left');
  const [hands, setHands] = useState<Partial<Record<ArmSide, TapDetection>>>({});
  const [testing, setTesting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TEST_MS / 1000);
  const [pinch, setPinch] = useState<number | null>(null);
  const [liveCount, setLiveCount] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoPinch, setDemoPinch] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef(0);
  const startTokenRef = useRef(0);
  const testSamplesRef = useRef<TapSample[]>([]);
  const testingRef = useRef(false);
  const testStartRef = useRef(0);
  const lastSampleRef = useRef(0);
  const lastReadoutRef = useRef(0);
  const chosenHandRef = useRef(chosenHand);
  chosenHandRef.current = chosenHand;
  const handsRef = useRef(hands);
  handsRef.current = hands;
  const demoTimerRef = useRef<number | null>(null);

  function stopCamera(): void {
    cancelAnimationFrame(rafRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    testingRef.current = false;
    setTesting(false);
  }

  useEffect(() => {
    return () => {
      stopCamera();
      if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finishTest(): void {
    testingRef.current = false;
    setTesting(false);
    const samples = testSamplesRef.current;
    const total = samples.length;
    const missing = samples.filter((sample) => sample.distance === null).length;
    if (total === 0 || missing > total / 3) {
      if (Object.keys(handsRef.current).length === 0) {
        onOutcome({
          kind: 'cannot',
          headline: 'The camera could not follow your hand for the full test.',
          reason: `Your hand was out of view or not clear enough in ${missing} of ${total} sampled moments, so taps could not be counted honestly.`,
          suggestion:
            'Hold your hand inside the picture, palm facing the camera, with the light in front of you, and try again.',
        });
      } else {
        setInlineError(
          'That hand could not be followed for the full test, so no taps were counted for it. Your other result below is unchanged.',
        );
      }
      return;
    }
    const detection = detectTaps(samples);
    const next = { ...handsRef.current, [chosenHandRef.current]: detection };
    handsRef.current = next;
    setHands(next);
    onOutcome({
      kind: 'hand',
      source: 'camera',
      headline: handHeadline(next),
      durationMs: TEST_MS,
      hands: next,
    });
  }

  function runLoop(): void {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (video !== null && canvas !== null && landmarker !== null) {
      if (video.videoWidth > 0 && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const result = landmarker.detectForVideo(video, performance.now());
          const landmarks = result.landmarks?.[0] ?? null;
          const distance = landmarks ? normalizedPinchDistance(landmarks) : null;
          drawHandOverlay(canvas, landmarks, distance);
          const now = performance.now();
          if (now - lastReadoutRef.current > 100) {
            lastReadoutRef.current = now;
            setPinch(distance);
          }
          if (testingRef.current) {
            if (now - lastSampleRef.current >= 33) {
              lastSampleRef.current = now;
              testSamplesRef.current.push({
                timeMs: now - testStartRef.current,
                distance,
              });
              setLiveCount(detectTaps(testSamplesRef.current).count);
            }
            const elapsed = now - testStartRef.current;
            setSecondsLeft(Math.max(0, Math.ceil((TEST_MS - elapsed) / 1000)));
            if (elapsed >= TEST_MS) finishTest();
          }
        } catch {
          // A skipped frame is a tracking gap, never a reason to crash.
        }
      }
    }
    rafRef.current = requestAnimationFrame(runLoop);
  }

  async function startSequence(token: number): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailure('unavailable');
      setView('prime');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (error) {
      if (startTokenRef.current !== token) return;
      setFailure(permissionFailureFromError(error));
      setView('prime');
      return;
    }
    if (startTokenRef.current !== token) {
      stopStream(stream);
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video !== null) {
      video.srcObject = stream;
      await video.play().catch(() => undefined);
    }
    try {
      landmarkerRef.current = await getLandmarker('hand');
    } catch (error) {
      if (startTokenRef.current !== token) return;
      stopCamera();
      setModelError(
        error instanceof ModelLoadError
          ? error.message
          : 'The vision model could not be loaded. Please try again.',
      );
      setView('prime');
      return;
    }
    if (startTokenRef.current !== token) return;
    setView('live');
    rafRef.current = requestAnimationFrame(runLoop);
  }

  function requestStart(): void {
    setFailure(null);
    setModelError(null);
    setInlineError(null);
    setView('starting');
    startTokenRef.current += 1;
    const token = startTokenRef.current;
    requestAnimationFrame(() => {
      void startSequence(token);
    });
  }

  function beginTest(): void {
    testSamplesRef.current = [];
    testStartRef.current = performance.now();
    lastSampleRef.current = 0;
    testingRef.current = true;
    setLiveCount(0);
    setInlineError(null);
    setSecondsLeft(TEST_MS / 1000);
    setTesting(true);
  }

  function playDemo(): void {
    stopCamera();
    setView('demo');
    setDemoPlaying(true);
    const leftSamples = demoTapSamples(DEMO_LEFT_TAPS);
    const rightSamples = demoTapSamples(DEMO_RIGHT_TAPS);
    if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    let index = 0;
    demoTimerRef.current = window.setInterval(() => {
      index += 2;
      const sample = leftSamples[Math.min(index, leftSamples.length - 1)];
      setDemoPinch(sample ? sample.distance : null);
      if (index >= leftSamples.length) {
        if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
        setDemoPlaying(false);
        const demoHands: Partial<Record<ArmSide, TapDetection>> = {
          left: detectTaps(leftSamples),
          right: detectTaps(rightSamples),
        };
        onOutcome({
          kind: 'hand',
          source: 'demo',
          headline: handHeadline(demoHands),
          durationMs: TEST_MS,
          hands: demoHands,
        });
      }
    }, 40);
  }

  function stopDemo(): void {
    if (demoTimerRef.current !== null) window.clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
    setDemoPlaying(false);
  }

  function goDemo(): void {
    setSource('demo');
    playDemo();
  }

  function selectSource(next: DataSource): void {
    if (next === source) return;
    if (next === 'demo') {
      goDemo();
      return;
    }
    stopDemo();
    if (next === 'camera') {
      setSource('camera');
      setView('prime');
    } else {
      stopCamera();
      setSource('upload');
    }
  }

  const tabs = (
    <SourceTabs source={source} onSelect={selectSource} label="How to provide the hand tapping" />
  );

  if (source === 'upload') {
    return (
      <div>
        {tabs}
        <MovementUploadAnalyze
          task="hand-video"
          uploadLabel="Upload a video of your hand tapping"
          hint="Show one hand close to the camera with the palm facing it, and tap your thumb to your index finger again and again so every tap is easy to see."
          fallbackHeadline="The AI described the hand tapping in your upload."
          onOutcome={onOutcome}
        />
      </div>
    );
  }

  if (view === 'demo') {
    return (
      <div>
        {tabs}
        <span className="mlab-chip is-demo">{DEMO_LABEL}</span>
        <p>
          A recorded example session, counted by the same tap detector as a live test.
          Watch the bar: each time the thumb and index finger meet, the distance drops
          and one tap is counted.
        </p>
        <div className="mlab-pinchbar" aria-hidden="true">
          <div
            className={`mlab-pinchbar-fill${demoPinch !== null && demoPinch <= TAP_CLOSE_THRESHOLD ? ' is-touching' : ''}`}
            style={{
              width: `${Math.min(100, Math.max(0, ((demoPinch ?? 1) / 1.2) * 100))}%`,
            }}
          />
        </div>
        <div className="mlab-actions">
          <button type="button" className="btn btn-primary" onClick={playDemo}>
            {demoPlaying ? 'Restart the demo' : 'Play the demo'}
          </button>
        </div>
      </div>
    );
  }

  const otherHand: ArmSide = chosenHand === 'left' ? 'right' : 'left';

  return (
    <div>
      {tabs}
      {failure !== null ? (
        <PermissionDenied
          device="camera"
          failure={failure}
          onRetry={requestStart}
          exits={[{ label: 'Watch a demo instead', onSelect: goDemo }]}
        />
      ) : modelError !== null ? (
        <div role="alert">
          <p>
            <strong>The hand tracking model could not start.</strong>
          </p>
          <p className="muted">{modelError}</p>
          <div className="mlab-actions">
            <button type="button" className="btn btn-primary" onClick={requestStart}>
              Try again
            </button>
            <button type="button" className="btn" onClick={goDemo}>
              Watch a demo instead
            </button>
          </div>
        </div>
      ) : view === 'prime' ? (
        <PermissionPrime
          device="camera"
          why="The camera follows your thumb and index finger while you tap them together, so the lab can count the taps from your hand itself."
          onStart={requestStart}
          exits={[{ label: 'Watch a demo instead', onSelect: playDemo }]}
        />
      ) : null}

      {(view === 'starting' || view === 'live') && (
        <>
          <div className="mlab-stage">
            <video ref={videoRef} className="mlab-video" playsInline muted />
            <canvas ref={canvasRef} className="mlab-overlay" />
          </div>
          <div className="mlab-readouts" aria-live="polite">
            <span className="mlab-chip">
              Finger distance:{' '}
              {pinch === null ? 'hand not in view' : pinch <= TAP_CLOSE_THRESHOLD ? 'touching' : 'open'}
            </span>
            {testing ? (
              <>
                <span className="mlab-chip">Taps so far: {liveCount}</span>
                <span className="mlab-countdown" aria-label="Seconds left">
                  {secondsLeft}
                </span>
              </>
            ) : null}
          </div>
          <div className="mlab-pinchbar" aria-hidden="true">
            <div
              className={`mlab-pinchbar-fill${pinch !== null && pinch <= TAP_CLOSE_THRESHOLD ? ' is-touching' : ''}`}
              style={{ width: `${Math.min(100, Math.max(0, ((pinch ?? 1) / 1.2) * 100))}%` }}
            />
          </div>
          {inlineError !== null ? (
            <p role="alert">
              <strong>{inlineError}</strong>
            </p>
          ) : null}
          {view === 'starting' ? (
            <p className="muted">Starting the camera and loading the hand model...</p>
          ) : (
            <>
              <p className="muted">
                Rest the device on a table, show one hand to the camera with the palm
                facing it, and tap your thumb to your index finger as fast and as
                steadily as you can.
              </p>
              <div className="mlab-tabs" aria-label="Hand to test">
                {(['left', 'right'] as ArmSide[]).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`mlab-tab${chosenHand === side ? ' is-active' : ''}`}
                    onClick={() => setChosenHand(side)}
                    disabled={testing}
                  >
                    {side === 'left' ? 'Left hand' : 'Right hand'}
                    {hands[side] ? ` (${hands[side]?.count} taps done)` : ''}
                  </button>
                ))}
              </div>
              <div className="mlab-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={beginTest}
                  disabled={testing}
                >
                  {testing
                    ? 'Testing...'
                    : hands[chosenHand]
                      ? `Redo the ${chosenHand} hand test`
                      : `Start the 10 second ${chosenHand} hand test`}
                </button>
                {!testing && hands[chosenHand] && !hands[otherHand] ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setChosenHand(otherHand)}
                  >
                    Test the {otherHand} hand
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    stopCamera();
                    setView('prime');
                  }}
                >
                  Stop camera
                </button>
              </div>
              <p className="muted">
                Fingers count as touching at a distance of {TAP_CLOSE_THRESHOLD} hand
                units or less, and must open past {TAP_OPEN_THRESHOLD} before the next
                tap can count.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Example step and page                                               */
/* ------------------------------------------------------------------ */

const EXAMPLE_TIMES = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const EXAMPLE_ARM_LEFT: (number | null)[] = [88, 88, 87, 87, 86, 86, 85, 85, 85, 84, 84];
const EXAMPLE_ARM_RIGHT: (number | null)[] = [90, 89, 88, 86, 84, 81, 78, 75, 72, 70, 68];

function ChartLegend() {
  return (
    <p className="muted">
      <span style={{ color: '#126454', fontWeight: 700 }}>Left arm (green)</span>{' '}
      <span style={{ color: '#b45309', fontWeight: 700 }}>Right arm (orange)</span>{' '}
      <span style={{ color: '#814c1c' }}>- - practice line</span>
    </p>
  );
}

function StripLegend({
  rows,
}: {
  rows: { label: string; count?: number }[];
}) {
  return (
    <p className="muted">
      {rows.map((row, index) => (
        <span key={row.label}>
          {index > 0 ? ' ' : ''}
          <span style={{ color: index === 0 ? '#126454' : '#b45309', fontWeight: 700 }}>
            {row.label}
          </span>
          {row.count !== undefined ? `: ${row.count} taps` : ''}
        </span>
      ))}
    </p>
  );
}

function MovementExample() {
  return (
    <>
      <h2 className="section-title">See finished examples first</h2>
      <p>
        <strong>Arm Raise.</strong> Both arms are held out to the sides for 10 seconds
        and each arm angle is charted as it happens. In this example the left arm stays
        near its start while the right arm slowly lowers and crosses the practice line.
      </p>
      <span className="mlab-chip">Example result</span>
      <ArmChart
        timesMs={EXAMPLE_TIMES}
        left={EXAMPLE_ARM_LEFT}
        right={EXAMPLE_ARM_RIGHT}
        practiceLine={75}
      />
      <ChartLegend />
      <p className="muted">
        Example result: the left arm stayed close to its starting angle. The right arm
        lowered about 22 degrees and crossed the practice line near the end.
      </p>
      <h3>Hand Lab</h3>
      <p>
        Tap your thumb to your index finger. The camera counts the taps from your hand
        itself, and the result is a rhythm strip: one dot per tap, one row per hand.
      </p>
      <span className="mlab-chip">Example result</span>
      <RhythmStrip
        rows={[
          { label: 'Left hand', tapTimesMs: DEMO_LEFT_TAPS },
          { label: 'Right hand', tapTimesMs: DEMO_RIGHT_TAPS },
        ]}
        durationMs={TEST_MS}
      />
      <StripLegend
        rows={[
          { label: 'Left hand', count: DEMO_LEFT_TAPS.length },
          { label: 'Right hand', count: DEMO_RIGHT_TAPS.length },
        ]}
      />
      <p className="muted">
        Example result: the left hand kept an even rhythm. The right hand tapped fewer
        times and slowed down toward the end.
      </p>
    </>
  );
}

function degrees(value: number): string {
  return `${Math.round(value)} deg`;
}

export default function MovementLab() {
  const feature = getFeature('movement-lab')!;
  const [mode, setMode] = useState<Mode>('arm');
  const [demoOnly, setDemoOnly] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setOutcome(null);
  };

  const tryIt = (
    <section className="panel" aria-label="Movement workspace">
      <div className="mlab-tabs" role="tablist" aria-label="Movement mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'arm'}
          className={`mlab-tab${mode === 'arm' ? ' is-active' : ''}`}
          onClick={() => switchMode('arm')}
        >
          Arm Raise
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'hand'}
          className={`mlab-tab${mode === 'hand' ? ' is-active' : ''}`}
          onClick={() => switchMode('hand')}
        >
          Hand Lab
        </button>
      </div>
      {mode === 'arm' ? (
        <ArmRaiseMode demoOnly={demoOnly} onOutcome={setOutcome} />
      ) : (
        <HandLabMode demoOnly={demoOnly} onOutcome={setOutcome} />
      )}
    </section>
  );

  const result =
    outcome === null ? undefined : outcome.kind === 'cannot' ? (
      <ResultSheet
        headline={outcome.headline}
        limitLine={feature.limitations}
        modeLabel="On this device"
        cannotAnalyze={{ reason: outcome.reason, suggestion: outcome.suggestion }}
      />
    ) : outcome.kind === 'emergency' ? (
      <EmergencyBanner variant="full" />
    ) : outcome.kind === 'ai' ? (
      <ResultSheet
        headline={outcome.headline}
        limitLine={feature.limitations}
        modeLabel="Live AI"
      >
        <p>{AI_FRAMING_LINE}</p>
        {outcome.observations.length > 0 ? (
          <ul>
            {outcome.observations.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        ) : null}
      </ResultSheet>
    ) : outcome.kind === 'arm' ? (
      <ResultSheet
        headline={outcome.headline}
        limitLine={feature.limitations}
        modeLabel={outcome.source === 'demo' ? 'Demo data' : 'On this device'}
      >
        {outcome.source === 'demo' ? (
          <p>
            <span className="mlab-chip is-demo">{DEMO_LABEL}</span>
          </p>
        ) : null}
        <ArmChart
          timesMs={outcome.timesMs}
          left={outcome.leftSeries}
          right={outcome.rightSeries}
          practiceLine={outcome.practiceLine}
        />
        <ChartLegend />
        <p>
          Left arm: started at {degrees(outcome.left.startDeg)}, ended at{' '}
          {degrees(outcome.left.endDeg)}, and its lowest point was{' '}
          {degrees(outcome.left.dropDeg)} below its start. Right arm: started at{' '}
          {degrees(outcome.right.startDeg)}, ended at {degrees(outcome.right.endDeg)},
          and its lowest point was {degrees(outcome.right.dropDeg)} below its start.
          The practice line was set at {outcome.practiceLine} degrees. Practice line -
          not a medical limit.
        </p>
      </ResultSheet>
    ) : (
      <ResultSheet
        headline={outcome.headline}
        limitLine={feature.limitations}
        modeLabel={outcome.source === 'demo' ? 'Demo data' : 'On this device'}
      >
        {outcome.source === 'demo' ? (
          <p>
            <span className="mlab-chip is-demo">{DEMO_LABEL}</span>
          </p>
        ) : null}
        <RhythmStrip
          rows={(['left', 'right'] as ArmSide[])
            .filter((side) => outcome.hands[side])
            .map((side) => ({
              label: side === 'left' ? 'Left hand' : 'Right hand',
              tapTimesMs: outcome.hands[side]?.tapTimesMs ?? [],
            }))}
          durationMs={outcome.durationMs}
        />
        <StripLegend
          rows={(['left', 'right'] as ArmSide[])
            .filter((side) => outcome.hands[side])
            .map((side) => ({
              label: side === 'left' ? 'Left hand' : 'Right hand',
              count: outcome.hands[side]?.count,
            }))}
        />
        {(['left', 'right'] as ArmSide[])
          .filter((side) => outcome.hands[side])
          .map((side) => {
            const detection = outcome.hands[side];
            if (!detection || detection.intervalsMs.length === 0) return null;
            const fastest = Math.min(...detection.intervalsMs);
            const slowest = Math.max(...detection.intervalsMs);
            return (
              <p key={side} className="muted">
                {side === 'left' ? 'Left' : 'Right'} hand: gaps between taps ranged
                from {fastest} ms to {slowest} ms in this recording.
              </p>
            );
          })}
      </ResultSheet>
    );

  return (
    <LabShell
      feature={feature}
      example={<MovementExample />}
      tryIt={tryIt}
      result={result}
      onExampleAlt={() => setDemoOnly(true)}
    />
  );
}
