// Face Lab: automatic face landmarks and three expression missions,
// plus an AI analysis path for an uploaded photo or video.
//
// Step 1 (example) is pure presentation and never mounts this file's
// camera code, because LabShell only renders tryIt after the person
// chooses to start. Step 2 offers two data sources, upload first:
// the upload path prepares frames on the device and, only after an
// explicit Analyze press and a vision consent, sends them to the
// Worker for AI description (visionClient.ts); the camera path runs
// the shared MediaPipe engine (getLandmarker('face')) on the person's
// own camera, records a resting baseline, then measures three
// missions with the pure math in signals.ts. Step 3 is the shared
// ResultSheet.
//
// Honesty rules held here:
// - Every failure (permission, model load, unstable tracking) ends in
//   the cannot-analyze variant with a specific reason. No value is
//   ever substituted for a measurement that could not be made.
// - The guided example path runs no camera and its sheet is labelled
//   as an example, not a measurement.
// - Side labels always follow the subject. The preview is mirrored
//   like a selfie camera and the overlay mirrors landmark x to match;
//   the side math itself lives in signals.ts and nowhere else.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet, UploadPanel } from '../../../shell';
import PermissionPrime, {
  permissionFailureFromError,
} from '../../../components/PermissionPrime';
import { ConsentNotice, EmergencyBanner } from '../../../components/ui';
import { EMERGENCY_TEXT } from '../../../safety';
import { getLandmarker, ModelLoadError } from '../../../ml/engine';
import { extractVideoFrames, imageFileToDataUrl } from '../../../ml/analyze';
import { hasSessionConsent } from '../../../ai/client';
import { analyzeWithAi, type VisionAnalysis } from '../../../ai/visionClient';
import { featureModeLabel } from '../../../ai/featureMode';
import { visionTaskForFile } from './uploadTask';
import {
  computeFaceSignals,
  relativeMovement,
  type FaceSignals,
  type SideMovement,
} from './signals';
import './face-lab.css';

type MissionId = 'smile' | 'brow' | 'cheek';

interface MissionDef {
  id: MissionId;
  label: string;
  instruction: string;
}

const MISSIONS: MissionDef[] = [
  { id: 'smile', label: 'Smile', instruction: 'Smile as wide as you can and hold it.' },
  { id: 'brow', label: 'Raise your eyebrows', instruction: 'Raise your eyebrows as high as you can and hold them up.' },
  { id: 'cheek', label: 'Puff your cheeks', instruction: 'Puff both cheeks full of air and hold.' },
];

interface MissionResult {
  id: MissionId;
  label: string;
  movement: SideMovement;
}

type Outcome =
  | { kind: 'measured'; missions: MissionResult[] }
  | { kind: 'guided' }
  | { kind: 'cannot'; reason: string; suggestion: string }
  | { kind: 'ai'; analysis: VisionAnalysis }
  | { kind: 'ai-cannot'; reason: string };

// The framing line that travels with every AI upload result, so the
// sheet itself never lets a description be mistaken for a measurement.
const AI_FRAMING_LINE =
  'AI analysis of your upload. The AI describes what it can see in the image; it does not measure, and it can misread images.';

// The exact privacy line the upload picker shows on the AI path: the
// on-device default would be untrue here, because frames do leave the
// device (to the AI service, through the Worker) once analysis runs.
const AI_PRIVACY_LINE =
  'Frames from your file are sent to the AI service for analysis. Nothing is stored by this site.';

// Static values used by the example panel and the guided walkthrough.
// They are product illustration data, always labelled as an example.
const EXAMPLE_MISSIONS: MissionResult[] = [
  { id: 'smile', label: 'Smile', movement: { left: 66, right: 58 } },
  { id: 'brow', label: 'Raise your eyebrows', movement: { left: 52, right: 55 } },
  { id: 'cheek', label: 'Puff your cheeks', movement: { left: 60, right: 60 } },
];

const BASELINE_MS = 2000;
const MISSION_MS = 3000;
const MISSION_WALL_LIMIT_MS = 25000;
const MIN_FACE_SPAN = 0.07; // eye distance in frame units; below this the face is too far

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianSignals(samples: FaceSignals[]): FaceSignals {
  const pick = (read: (sample: FaceSignals) => number): number => median(samples.map(read));
  return {
    smile: { left: pick((s) => s.smile.left), right: pick((s) => s.smile.right) },
    brow: { left: pick((s) => s.brow.left), right: pick((s) => s.brow.right) },
    cheek: { left: pick((s) => s.cheek.left), right: pick((s) => s.cheek.right) },
  };
}

function MissionBars({
  title,
  movement,
  leftLabel = 'Left side of your face',
  rightLabel = 'Right side of your face',
}: {
  title: string;
  movement: SideMovement;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="fl-bars">
        <div className="fl-bar-row">
          <span className="fl-bar-label">{leftLabel}</span>
          <div className="fl-bar-track">
            <div className="fl-bar-fill" style={{ width: `${movement.left}%` }} />
          </div>
          <span className="fl-bar-value">{movement.left}</span>
        </div>
        <div className="fl-bar-row">
          <span className="fl-bar-label">{rightLabel}</span>
          <div className="fl-bar-track">
            <div className="fl-bar-fill is-right" style={{ width: `${movement.right}%` }} />
          </div>
          <span className="fl-bar-value">{movement.right}</span>
        </div>
      </div>
    </div>
  );
}

function ExamplePanel() {
  return (
    <section className="panel">
      <h2 className="section-title">See how the result looks first</h2>
      <p>
        Face Lab watches your face with the camera and follows 478 points on it while you do
        three short missions: smile, raise your eyebrows, and puff your cheeks. The bars
        compare how much each side of your face moved, measured against your own resting
        face. This finished example shows the shape of the result before you try anything.
      </p>
      <MissionBars
        title="Smile, in the example"
        movement={{ left: 62, right: 44 }}
        leftLabel="Left side"
        rightLabel="Right side"
      />
      <p className="muted">Example result: both sides moved; the right side moved less.</p>

      <h3>Learn to read it on examples, not on yourself</h3>
      <div className="fl-learn-grid">
        <div className="fl-learn-card">
          <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Example face with an even smile">
            <circle cx="60" cy="60" r="44" fill="#f4faf8" stroke="#126454" strokeWidth="2" />
            <line x1="34" y1="44" x2="52" y2="42" stroke="#153e34" strokeWidth="3" strokeLinecap="round" />
            <line x1="68" y1="42" x2="86" y2="44" stroke="#153e34" strokeWidth="3" strokeLinecap="round" />
            <circle cx="43" cy="54" r="4" fill="#153e34" />
            <circle cx="77" cy="54" r="4" fill="#153e34" />
            <path d="M40 78 Q60 94 80 78" fill="none" stroke="#126454" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h3>Example A: fairly even movement</h3>
          <p className="muted">Both mouth corners lift about the same amount.</p>
          <MissionBars title="Smile" movement={{ left: 58, right: 57 }} leftLabel="Left" rightLabel="Right" />
        </div>
        <div className="fl-learn-card">
          <span className="fl-teaching-tag">Teaching example</span>
          <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Teaching example face with one mouth corner lower">
            <circle cx="60" cy="60" r="44" fill="#f4faf8" stroke="#126454" strokeWidth="2" />
            <line x1="34" y1="44" x2="52" y2="42" stroke="#153e34" strokeWidth="3" strokeLinecap="round" />
            <line x1="68" y1="42" x2="86" y2="44" stroke="#153e34" strokeWidth="3" strokeLinecap="round" />
            <circle cx="43" cy="54" r="4" fill="#153e34" />
            <circle cx="77" cy="54" r="4" fill="#153e34" />
            <path d="M40 82 Q58 90 80 74" fill="none" stroke="#126454" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <h3>Example B: one side moves less</h3>
          <p className="muted">
            Teaching example, not a real patient. Recorded for education. Here the left
            corner stays lower during the smile.
          </p>
          <MissionBars title="Smile" movement={{ left: 34, right: 63 }} leftLabel="Left" rightLabel="Right" />
        </div>
      </div>
      <p className="muted">
        Small left-right differences are normal in every face, including healthy faces. This
        lab describes movement; it never labels a face normal or abnormal.
      </p>
    </section>
  );
}

function GuidedWalkthrough({ onFinish, onReset }: { onFinish: () => void; onReset: () => void }) {
  const [step, setStep] = useState(0);
  const finished = step >= MISSIONS.length;
  return (
    <section className="panel">
      <h2 className="section-title">Guided example</h2>
      <p>
        You are following the recorded example step by step. Nothing about your face is
        measured in this mode, and the result at the end is labelled as an example.
      </p>
      {!finished ? (
        <>
          <div className="fl-mission-head">
            {MISSIONS.map((mission, index) => (
              <span
                key={mission.id}
                className={`fl-chip${index < step ? ' is-done' : index === step ? ' is-active' : ''}`}
              >
                {mission.label}
              </span>
            ))}
          </div>
          <p>
            In the example, the person is asked to: <strong>{MISSIONS[step].instruction}</strong>
          </p>
          <MissionBars
            title={`${MISSIONS[step].label}, example result`}
            movement={EXAMPLE_MISSIONS[step].movement}
            leftLabel="Left side"
            rightLabel="Right side"
          />
          <div className="fl-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (step === MISSIONS.length - 1) onFinish();
                setStep((value) => value + 1);
              }}
            >
              {step === MISSIONS.length - 1 ? 'Finish the guided example' : 'Next mission'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>The example is finished. Your result sheet is below.</p>
          <div className="fl-actions">
            <button type="button" className="btn" onClick={onReset}>
              Start over
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type CameraPhase = 'prime' | 'starting' | 'baseline' | 'mission-ready' | 'mission-active' | 'done';
type SignalQuality = 'searching' | 'found' | 'closer' | 'lost';

const QUALITY_LABELS: Record<SignalQuality, string> = {
  searching: 'Looking for your face',
  found: 'Face found',
  closer: 'Move a little closer',
  lost: 'Face lost, hold still',
};

const KEY_POINTS = new Set([1, 33, 61, 70, 105, 263, 291, 334, 336]);

function CameraWorkspace({
  onOutcome,
  onGuided,
  onReset,
}: {
  onOutcome: (outcome: Outcome) => void;
  onGuided: () => void;
  onReset: () => void;
}) {
  const [phase, setPhase] = useState<CameraPhase>('prime');
  const [missionIndex, setMissionIndex] = useState(0);
  const [quality, setQuality] = useState<SignalQuality>('searching');
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<SideMovement>({ left: 0, right: 0 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const phaseRef = useRef<CameraPhase>('prime');
  const missionIndexRef = useRef(0);
  const lastTsRef = useRef(0);
  const lastFrameTsRef = useRef(0);
  const presenceRef = useRef<boolean[]>([]);
  const samplesRef = useRef<FaceSignals[]>([]);
  const validMsRef = useRef(0);
  const wallStartRef = useRef(0);
  const baselineRef = useRef<FaceSignals | null>(null);
  const resultsRef = useRef<MissionResult[]>([]);
  const lastProgressRef = useRef(0);
  const lastLiveRef = useRef('');

  const setPhaseBoth = (next: CameraPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const stopSession = () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => stopSession, []);

  const failWith = (reason: string, suggestion: string) => {
    stopSession();
    setPhaseBoth('done');
    onOutcome({ kind: 'cannot', reason, suggestion });
  };

  const drawOverlay = (result: FaceLandmarkerResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) return;
    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks) return;
    // Light subset only: every fourth point, with the measurement
    // points drawn larger. X is mirrored to match the selfie preview.
    for (let index = 0; index < landmarks.length; index += 1) {
      const point = landmarks[index];
      const isKey = KEY_POINTS.has(index);
      if (!isKey && index % 4 !== 0) continue;
      ctx.beginPath();
      ctx.arc(
        (1 - point.x) * canvas.width,
        point.y * canvas.height,
        isKey ? 3 : 1.2,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = isKey ? '#153e34' : 'rgba(18, 100, 84, 0.55)';
      ctx.fill();
    }
  };

  const finishMission = () => {
    const mission = MISSIONS[missionIndexRef.current];
    const baseline = baselineRef.current;
    if (!baseline) return;
    const medians = medianSignals(samplesRef.current);
    const current = medians[mission.id];
    const base = baseline[mission.id];
    resultsRef.current = [
      ...resultsRef.current,
      {
        id: mission.id,
        label: mission.label,
        movement: {
          left: relativeMovement(current.left, base.left),
          right: relativeMovement(current.right, base.right),
        },
      },
    ];
    samplesRef.current = [];
    validMsRef.current = 0;
    setProgress(0);
    if (missionIndexRef.current + 1 < MISSIONS.length) {
      missionIndexRef.current += 1;
      setMissionIndex(missionIndexRef.current);
      setPhaseBoth('mission-ready');
    } else {
      const missions = resultsRef.current;
      stopSession();
      setPhaseBoth('done');
      onOutcome({ kind: 'measured', missions });
    }
  };

  const loop = (timestamp: number) => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) return;
    if (timestamp <= lastTsRef.current) return;
    lastTsRef.current = timestamp;

    let result: FaceLandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, timestamp);
    } catch {
      return; // transient engine hiccup on one frame; the next frame retries
    }
    drawOverlay(result);

    const landmarks = result.faceLandmarks?.[0];
    const present = Boolean(landmarks);
    presenceRef.current = [...presenceRef.current.slice(-29), present];
    const presentFraction =
      presenceRef.current.filter(Boolean).length / Math.max(1, presenceRef.current.length);

    let span = 0;
    if (landmarks) {
      span = Math.hypot(landmarks[33].x - landmarks[263].x, landmarks[33].y - landmarks[263].y);
    }
    const usable = present && span >= MIN_FACE_SPAN;
    const nextQuality: SignalQuality = !present
      ? presentFraction > 0.4
        ? 'lost'
        : 'searching'
      : span < MIN_FACE_SPAN
        ? 'closer'
        : 'found';
    setQuality((previous) => (previous === nextQuality ? previous : nextQuality));

    const dt = lastFrameTsRef.current > 0 ? timestamp - lastFrameTsRef.current : 0;
    lastFrameTsRef.current = timestamp;

    const currentPhase = phaseRef.current;
    if (currentPhase !== 'baseline' && currentPhase !== 'mission-active') return;
    if (!landmarks) return;

    const categories = result.faceBlendshapes?.[0]?.categories ?? [];
    const record: Record<string, number> = {};
    for (const category of categories) record[category.categoryName] = category.score;
    const signals = computeFaceSignals(record, landmarks);

    // Live bars: raw smile during baseline, relative mission movement
    // during a mission, so the person sees the signal respond.
    const baseline = baselineRef.current;
    const mission = MISSIONS[missionIndexRef.current];
    const liveMovement: SideMovement =
      currentPhase === 'baseline' || !baseline
        ? signals.smile
        : {
            left: relativeMovement(signals[mission.id].left, baseline[mission.id].left),
            right: relativeMovement(signals[mission.id].right, baseline[mission.id].right),
          };
    const liveKey = `${liveMovement.left}|${liveMovement.right}`;
    if (liveKey !== lastLiveRef.current) {
      lastLiveRef.current = liveKey;
      setLive(liveMovement);
    }

    if (usable) {
      samplesRef.current.push(signals);
      validMsRef.current += dt;
    }

    const target = currentPhase === 'baseline' ? BASELINE_MS : MISSION_MS;
    const nextProgress = Math.min(1, validMsRef.current / target);
    if (Math.abs(nextProgress - lastProgressRef.current) > 0.03 || nextProgress >= 1) {
      lastProgressRef.current = nextProgress;
      setProgress(nextProgress);
    }

    if (currentPhase === 'mission-active' && timestamp - wallStartRef.current > MISSION_WALL_LIMIT_MS) {
      failWith(
        'Too little of the mission was captured with a clear face signal, so this session cannot be measured honestly.',
        'Face a brighter light, hold the device steady at arm length, and keep your whole face in the frame for the full mission.',
      );
      return;
    }

    if (validMsRef.current >= target) {
      if (currentPhase === 'baseline') {
        baselineRef.current = medianSignals(samplesRef.current);
        samplesRef.current = [];
        validMsRef.current = 0;
        setProgress(0);
        lastProgressRef.current = 0;
        setPhaseBoth('mission-ready');
      } else {
        finishMission();
      }
    }
  };

  const start = async () => {
    setPhaseBoth('starting');
    let landmarker: FaceLandmarker;
    try {
      landmarker = await getLandmarker('face');
    } catch (error) {
      const reason =
        error instanceof ModelLoadError
          ? error.message
          : 'The vision model could not be loaded. Please try again.';
      failWith(reason, 'Check your connection and try again, or continue with the guided example instead.');
      return;
    }
    landmarkerRef.current = landmarker;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (error) {
      const failure = permissionFailureFromError(error);
      if (failure === 'denied') {
        failWith(
          'Camera permission was refused, so the lab never received any video.',
          'Allow the camera in your browser site settings and try again, or continue with the guided example instead.',
        );
      } else if (failure === 'unavailable') {
        failWith(
          'No working camera was found on this device.',
          'Try a device with a camera, or continue with the guided example instead.',
        );
      } else {
        failWith(
          'The camera could not be started. It may be busy in another app.',
          'Close other apps that use the camera and try again, or continue with the guided example instead.',
        );
      }
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stopSession();
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      failWith(
        'The camera started but its preview could not play in this browser.',
        'Try a recent version of Chrome, Edge, or Safari, or continue with the guided example instead.',
      );
      return;
    }
    runningRef.current = true;
    lastTsRef.current = 0;
    lastFrameTsRef.current = 0;
    presenceRef.current = [];
    samplesRef.current = [];
    validMsRef.current = 0;
    setProgress(0);
    setPhaseBoth('baseline');
    rafRef.current = requestAnimationFrame(loop);
  };

  const startMission = () => {
    samplesRef.current = [];
    validMsRef.current = 0;
    wallStartRef.current = performance.now();
    setProgress(0);
    lastProgressRef.current = 0;
    setPhaseBoth('mission-active');
  };

  const giveUpSignal = () => {
    failWith(
      'The camera could not keep a clear, steady view of your face, so no part of this measurement could be trusted.',
      'Face a window or a brighter light, hold the device steady at arm length, and keep your whole face inside the frame.',
    );
  };

  if (phase === 'prime' || phase === 'starting') {
    return (
      <section className="panel">
        <h2 className="section-title">Try it with your camera</h2>
        <PermissionPrime
          device="camera"
          why="The camera follows points on your face while you smile, raise your eyebrows, and puff your cheeks, so the lab can compare how much each side moved."
          onStart={() => void start()}
          startLabel={phase === 'starting' ? 'Starting the camera...' : undefined}
          exits={[{ label: 'Use the guided example instead', onSelect: onGuided }]}
        />
        {phase === 'starting' ? (
          <p className="muted">Loading the face model, about 4 MB, the first time only.</p>
        ) : null}
      </section>
    );
  }

  if (phase === 'done') {
    return (
      <section className="panel">
        <h2 className="section-title">Session finished</h2>
        <p>Your result sheet is below. The camera is off and nothing was recorded.</p>
        <div className="fl-actions">
          <button type="button" className="btn" onClick={onReset}>
            Start over
          </button>
        </div>
      </section>
    );
  }

  const mission = MISSIONS[missionIndex];
  return (
    <section className="panel">
      <h2 className="section-title">Your face, measured live</h2>
      <div className="fl-mission-head">
        {MISSIONS.map((item, index) => (
          <span
            key={item.id}
            className={`fl-chip${index < missionIndex ? ' is-done' : index === missionIndex && phase !== 'baseline' ? ' is-active' : ''}`}
          >
            {item.label}
          </span>
        ))}
      </div>
      <div className="fl-stage">
        <video ref={videoRef} className="fl-video" playsInline muted />
        <canvas ref={canvasRef} className="fl-overlay" aria-hidden="true" />
      </div>
      <span className={`fl-quality${quality === 'found' ? '' : ' is-weak'}`}>
        {QUALITY_LABELS[quality]}
      </span>

      {phase === 'baseline' ? (
        <>
          <p>
            First, your resting face. Look at the camera with a relaxed face while the lab
            records your baseline.
          </p>
          <div className="fl-progress">
            <div className="fl-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </>
      ) : null}

      {phase === 'mission-ready' ? (
        <>
          <p>
            Mission {missionIndex + 1} of {MISSIONS.length}: <strong>{mission.instruction}</strong>
          </p>
          <div className="fl-actions">
            <button type="button" className="btn btn-primary" onClick={startMission}>
              Start this mission
            </button>
          </div>
        </>
      ) : null}

      {phase === 'mission-active' ? (
        <>
          <p>
            Hold it: <strong>{mission.instruction}</strong>
          </p>
          <div className="fl-progress">
            <div className="fl-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <MissionBars title="Live movement" movement={live} />
        </>
      ) : null}

      {phase === 'baseline' || phase === 'mission-ready' ? (
        <MissionBars title="Live signal" movement={live} />
      ) : null}

      <div className="fl-actions">
        <button type="button" className="btn" onClick={giveUpSignal}>
          The camera cannot find my face clearly
        </button>
        <button type="button" className="btn" onClick={onGuided}>
          Use the guided example instead
        </button>
      </div>
    </section>
  );
}

type UploadPhase = 'empty' | 'preparing' | 'ready' | 'sending' | 'reading' | 'failed' | 'emergency';

const UPLOAD_STATUS_STEPS = [
  'Preparing your file',
  'Sending frames to the AI',
  'Reading the AI analysis',
] as const;

/**
 * The upload path: the default data source. Frames are prepared on
 * this device (one downscaled image, or up to six frames spread
 * across a video) and shown to the person before anything is sent.
 * Sending happens only on an explicit Analyze press, and only after
 * the vision consent for this session exists or the consent box is
 * ticked. The AI describes; it never measures, and its result sheet
 * says so on the sheet itself.
 */
function UploadWorkspace({
  onOutcome,
  onGuided,
  onReset,
}: {
  onOutcome: (outcome: Outcome | null) => void;
  onGuided: () => void;
  onReset: () => void;
}) {
  const [phase, setPhase] = useState<UploadPhase>('empty');
  const [frames, setFrames] = useState<string[]>([]);
  const [task, setTask] = useState<'face-photo' | 'face-video'>('face-photo');
  const [failStage, setFailStage] = useState<'prepare' | 'send'>('prepare');
  const [errorMessage, setErrorMessage] = useState('');
  const [emergencyText, setEmergencyText] = useState('');
  const [panelKey, setPanelKey] = useState(0);
  const [sessionAgreed, setSessionAgreed] = useState(() => hasSessionConsent('vision'));
  const [consent, setConsent] = useState(false);
  const [consentPrompt, setConsentPrompt] = useState(false);
  const prepIdRef = useRef(0);

  const busy = phase === 'preparing' || phase === 'sending' || phase === 'reading';
  const agreed = sessionAgreed || consent;

  const clearAll = () => {
    prepIdRef.current += 1;
    onOutcome(null);
    setFrames([]);
    setErrorMessage('');
    setEmergencyText('');
    setConsentPrompt(false);
    setPhase('empty');
    setPanelKey((value) => value + 1);
  };

  const prepareFile = async (picked: File) => {
    const prepId = prepIdRef.current + 1;
    prepIdRef.current = prepId;
    onOutcome(null);
    setErrorMessage('');
    setEmergencyText('');
    setConsentPrompt(false);
    const nextTask = visionTaskForFile(picked);
    setTask(nextTask);
    setPhase('preparing');
    try {
      if (nextTask === 'face-photo') {
        const url = await imageFileToDataUrl(picked);
        if (prepIdRef.current !== prepId) return;
        setFrames([url]);
      } else {
        const extracted = await extractVideoFrames(picked, 6);
        if (prepIdRef.current !== prepId) return;
        if (extracted.length === 0) {
          throw new Error('No frames could be read from that video. Try a different recording.');
        }
        setFrames(extracted.map((frame) => frame.dataUrl));
      }
      setPhase('ready');
    } catch (caught) {
      if (prepIdRef.current !== prepId) return;
      setFrames([]);
      setFailStage('prepare');
      setErrorMessage(
        caught instanceof Error ? caught.message : 'That file could not be prepared.',
      );
      setPhase('failed');
    }
  };

  const runAnalysis = async () => {
    if (!agreed) {
      // Agreement is a UI act that must come first; analyzeWithAi only
      // records it. Without it, nothing is prepared for sending and
      // nothing leaves the device.
      setConsentPrompt(true);
      return;
    }
    setConsentPrompt(false);
    setPhase('sending');
    setErrorMessage('');
    try {
      const analysis = await analyzeWithAi({ task, images: frames });
      setSessionAgreed(hasSessionConsent('vision'));
      setPhase('reading');
      // A short beat on the final status step so the person sees the
      // reading stage before the sheet replaces the workspace state.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (analysis.emergency) {
        setEmergencyText(analysis.observations[0] ?? EMERGENCY_TEXT);
        setPhase('emergency');
        return;
      }
      if (analysis.cannotAnalyze) {
        onOutcome({
          kind: 'ai-cannot',
          reason:
            analysis.reason ??
            'The AI could not describe this upload clearly enough to say anything useful about it.',
        });
      } else {
        onOutcome({ kind: 'ai', analysis });
      }
      setPhase('ready');
    } catch (caught) {
      setFailStage('send');
      setErrorMessage(caught instanceof Error ? caught.message : 'Live AI could not respond.');
      setPhase('failed');
    }
  };

  const statusIndex = phase === 'preparing' ? 0 : phase === 'sending' ? 1 : 2;

  return (
    <section className="panel">
      <h2 className="section-title">Upload a photo or video</h2>
      <p>
        Choose a photo or a short video of your face. The frames below are prepared on this
        device and are only sent when you press Analyze, and the AI describes what it can
        see in them. For a video, the clearest result comes from starting with a relaxed
        face, then smiling wide, then raising your eyebrows.
      </p>

      <UploadPanel
        key={panelKey}
        accept="both"
        label="Upload a photo or video of your face"
        hint="A clear, well-lit photo, or a short video: start relaxed, then smile wide, then raise your eyebrows."
        privacyLine={AI_PRIVACY_LINE}
        disabled={busy}
        onFile={(picked) => void prepareFile(picked)}
        onClear={clearAll}
      />

      {busy ? (
        <ol className="fl-status-list" aria-live="polite">
          {UPLOAD_STATUS_STEPS.map((label, index) => {
            const state = index < statusIndex ? 'done' : index === statusIndex ? 'active' : 'todo';
            return (
              <li key={label} className={`fl-status-step is-${state}`}>
                {label}
                {state === 'active' ? '...' : ''}
              </li>
            );
          })}
        </ol>
      ) : null}

      {phase === 'emergency' ? (
        <div className="fl-emergency">
          <EmergencyBanner variant="full" />
          <p>{emergencyText}</p>
          <div className="fl-actions">
            <button type="button" className="btn" onClick={onReset}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'failed' ? (
        <div className="fl-failure" role="alert">
          <h3>The analysis did not finish</h3>
          <p>{errorMessage}</p>
          <div className="fl-actions">
            {failStage === 'send' && frames.length > 0 ? (
              <button type="button" className="btn btn-primary" onClick={() => void runAnalysis()}>
                Try again
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={clearAll}>
                Choose a different file
              </button>
            )}
          </div>
        </div>
      ) : null}

      {frames.length > 0 && phase !== 'preparing' && phase !== 'failed' && phase !== 'emergency' ? (
        <>
          <h3>These frames will be sent to the AI</h3>
          <div className="fl-frames">
            {frames.map((url, index) => (
              <img
                key={index}
                className="fl-frame-thumb"
                src={url}
                alt={`Frame ${index + 1} prepared from your file`}
              />
            ))}
          </div>

          {sessionAgreed ? (
            <p className="muted">AI consent given for this session.</p>
          ) : (
            <ConsentNotice
              scopeLabel="the frames from your uploaded file"
              checked={consent}
              onChange={(checked) => {
                setConsent(checked);
                if (checked) setConsentPrompt(false);
              }}
            />
          )}
          {consentPrompt && !agreed ? (
            <p className="muted">
              One step before the AI sees your frames: tick the agreement box above, then
              press Analyze with AI again.
            </p>
          ) : null}

          <div className="fl-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void runAnalysis()}
            >
              Analyze with AI
            </button>
            <button type="button" className="btn" onClick={onGuided}>
              Use the guided example instead
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function FaceLab() {
  const feature = getFeature('face-lab');
  const [guided, setGuided] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [source, setSource] = useState<'upload' | 'camera'>('upload');

  if (!feature) {
    return (
      <section className="panel">
        <h2 className="section-title">Face Lab is not available</h2>
        <p>This lab is missing from the registry, so it cannot be shown honestly.</p>
      </section>
    );
  }

  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  const modeLabel = featureModeLabel(feature, apiConfigured);

  const reset = () => {
    setOutcome(null);
    setGuided(false);
    setSessionKey((value) => value + 1);
  };

  const tryIt = guided ? (
    <GuidedWalkthrough onFinish={() => setOutcome({ kind: 'guided' })} onReset={reset} />
  ) : (
    <>
      <section className="panel">
        <h2 className="section-title">Choose how to try it</h2>
        <div className="fl-source-row" role="group" aria-label="Data source">
          <button
            type="button"
            className={`btn${source === 'upload' ? ' btn-primary' : ''}`}
            aria-pressed={source === 'upload'}
            onClick={() => setSource('upload')}
          >
            Upload a photo or video
          </button>
          <button
            type="button"
            className={`btn${source === 'camera' ? ' btn-primary' : ''}`}
            aria-pressed={source === 'camera'}
            onClick={() => setSource('camera')}
          >
            Use live camera
          </button>
        </div>
        <p className="muted">
          Upload is the default: frames from your file are described by the AI service. The
          live camera instead measures movement on this device and sends nothing anywhere.
        </p>
      </section>
      {source === 'upload' ? (
        <UploadWorkspace
          key={`upload-${sessionKey}`}
          onOutcome={setOutcome}
          onGuided={() => setGuided(true)}
          onReset={reset}
        />
      ) : (
        <CameraWorkspace
          key={sessionKey}
          onOutcome={setOutcome}
          onGuided={() => setGuided(true)}
          onReset={reset}
        />
      )}
    </>
  );

  let result: ReactNode | undefined;
  if (outcome?.kind === 'ai') {
    result = (
      <ResultSheet
        headline={outcome.analysis.headline}
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
      >
        <ul className="fl-ai-observations">
          {outcome.analysis.observations.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <p className="muted">
          These sentences are the AI describing the frames you approved. Wording about one
          side moving more or less is an impression from the images, not a measurement.
        </p>
      </ResultSheet>
    );
  } else if (outcome?.kind === 'ai-cannot') {
    result = (
      <ResultSheet
        headline="The AI could not describe this upload clearly enough."
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
        cannotAnalyze={{
          reason: outcome.reason,
          suggestion:
            'Try a clearer, brighter photo that shows the whole face, or a short video that starts with a relaxed face, and analyze again.',
        }}
      />
    );
  } else if (outcome?.kind === 'cannot') {
    result = (
      <ResultSheet
        headline="The camera could not measure your face movements this time."
        limitLine="No value was recorded. A measurement that cannot be made is reported, never replaced with a made-up one."
        modeLabel={modeLabel}
        cannotAnalyze={{ reason: outcome.reason, suggestion: outcome.suggestion }}
      />
    );
  } else if (outcome?.kind === 'guided') {
    result = (
      <ResultSheet
        headline="You followed the guided example to the end."
        limitLine="Guided example, not a measurement. Nothing about your face was recorded."
        modeLabel="Guided example"
      >
        {EXAMPLE_MISSIONS.map((mission) => (
          <MissionBars
            key={mission.id}
            title={`${mission.label}, example result`}
            movement={mission.movement}
            leftLabel="Left side"
            rightLabel="Right side"
          />
        ))}
        <p className="muted">Use the camera mode whenever you want to see your own movement bars.</p>
      </ResultSheet>
    );
  } else if (outcome?.kind === 'measured') {
    const smile = outcome.missions.find((mission) => mission.id === 'smile');
    const diff = smile ? smile.movement.left - smile.movement.right : 0;
    const headline = !smile
      ? 'Your three face missions were recorded.'
      : Math.abs(diff) <= 8
        ? 'Both sides of your face moved about the same amount in this recording.'
        : diff > 0
          ? 'Your left side moved more than your right side in this recording.'
          : 'Your right side moved more than your left side in this recording.';
    result = (
      <ResultSheet
        headline={headline}
        limitLine="Practice result from one recording. Small differences are normal in every face, and this lab cannot tell whether a face is healthy."
        modeLabel={modeLabel}
      >
        {outcome.missions.map((mission) => (
          <MissionBars key={mission.id} title={mission.label} movement={mission.movement} />
        ))}
        <p className="muted">
          Bars show relative movement from your own resting face, on a 0 to 100 practice
          scale. They are not percentages of strength and not a symmetry score.
        </p>
      </ResultSheet>
    );
  }

  return (
    <LabShell
      feature={feature}
      example={<ExamplePanel />}
      tryIt={tryIt}
      result={result}
      onExampleAlt={() => setGuided(true)}
    />
  );
}
