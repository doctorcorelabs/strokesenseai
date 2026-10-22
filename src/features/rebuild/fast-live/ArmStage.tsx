// Arm stage of the FAST Live Check.
//
// The clinical FAST position (arms raised forwards) cannot be
// measured honestly from one front camera, because the arm points at
// the lens and its angle collapses in the picture. This stage says so
// on screen and uses the camera-adapted position instead: both arms
// raised out to the sides, palms down, where the projected angle is
// real. Angles come from the Movement Lab angle module (the shared
// contract); frames where an arm is not clearly visible are recorded
// as gaps, never filled in. A side that is missing for more than a
// third of the hold ends the stage as could-not-be-measured with a
// reason that names the side.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedLandmark, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { getLandmarker, ModelLoadError } from '../../../ml/engine';
import PermissionPrime, { PermissionDenied } from '../../../components/PermissionPrime';
import { armProjectedAngle, smoothSeries } from '../movement-lab/angles';
import { useCameraStream } from './camera';
import { ArmChart } from './bits';
import { HOLD_SECONDS, armStageOutcome, describeArmHold } from './session-logic';
import type { ArmPoint, ArmStageOutcome } from './types';

type Phase = 'prime' | 'starting' | 'framing' | 'position' | 'hold' | 'card';

const VISIBILITY_MIN = 0.6;
const FRAME_HOLD_MS = 1000;
const POSITION_HOLD_MS = 500;
const DETECT_EVERY_MS = 60;
const SMOOTH_WINDOW = 5;

const POSITION_NOTE =
  'Camera-adapted position: arms out to the sides, so the camera can measure the angle. The usual FAST position raises the arms forwards, which a single camera cannot measure honestly.';

const HOW_IT_WORKS =
  'The camera estimates 33 body points and measures each arm angle in the picture, many times per second. It cannot measure depth or strength.';

const ARM_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
};

const ALL_GATE_INDEX = [
  ARM_INDEX.leftShoulder,
  ARM_INDEX.rightShoulder,
  ARM_INDEX.leftElbow,
  ARM_INDEX.rightElbow,
  ARM_INDEX.leftWrist,
  ARM_INDEX.rightWrist,
  ARM_INDEX.leftHip,
  ARM_INDEX.rightHip,
];

function visible(landmarks: NormalizedLandmark[], index: number): boolean {
  const point = landmarks[index];
  return point !== undefined && (point.visibility ?? 0) >= VISIBILITY_MIN;
}

function sideVisible(landmarks: NormalizedLandmark[], side: 'left' | 'right'): boolean {
  return side === 'left'
    ? visible(landmarks, ARM_INDEX.leftShoulder) &&
        visible(landmarks, ARM_INDEX.leftWrist) &&
        visible(landmarks, ARM_INDEX.leftHip)
    : visible(landmarks, ARM_INDEX.rightShoulder) &&
        visible(landmarks, ARM_INDEX.rightWrist) &&
        visible(landmarks, ARM_INDEX.rightHip);
}

const EXAMPLE_LEFT: ArmPoint[] = [
  { t: 0, deg: 88 },
  { t: 2.5, deg: 87 },
  { t: 5, deg: 86 },
  { t: 7.5, deg: 86 },
  { t: 10, deg: 85 },
];
const EXAMPLE_RIGHT: ArmPoint[] = [
  { t: 0, deg: 90 },
  { t: 2.5, deg: 87 },
  { t: 5, deg: 83 },
  { t: 7.5, deg: 79 },
  { t: 10, deg: 76 },
];

interface HoldSample {
  t: number;
  left: number | null;
  right: number | null;
}

export default function ArmStage({
  guided,
  onFinish,
}: {
  guided: boolean;
  onFinish: (outcome: ArmStageOutcome) => void;
}) {
  const [mode, setMode] = useState<'camera' | 'guided'>(guided ? 'guided' : 'camera');
  const [phase, setPhase] = useState<Phase>('prime');
  const [guidance, setGuidance] = useState('Step back until both arms fit in the frame.');
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [liveSamples, setLiveSamples] = useState<HoldSample[]>([]);
  const [modelError, setModelError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ArmStageOutcome | null>(null);
  const [guidedStep, setGuidedStep] = useState(0);

  const camera = useCameraStream();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('prime');
  const accumRef = useRef({
    phaseStart: 0,
    gateSince: 0 as number | null,
    positionSince: 0 as number | null,
    lastDetect: 0,
    lastTs: 0,
    samples: [] as HoldSample[],
    frames: 0,
    leftValid: 0,
    rightValid: 0,
  });

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (guided) setMode('guided');
  }, [guided]);

  const stopLoop = useCallback(() => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  const finishStage = useCallback(
    (next: ArmStageOutcome) => {
      stopLoop();
      camera.stop();
      onFinish(next);
    },
    [camera, onFinish, stopLoop],
  );

  const skip = useCallback(() => finishStage({ status: 'skipped' }), [finishStage]);

  const drawOverlay = useCallback(
    (result: PoseLandmarkerResult) => {
      const canvas = canvasRef.current;
      const video = camera.videoRef.current;
      if (!canvas || !video || video.videoWidth === 0) return;
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const landmarks = result.landmarks?.[0];
      if (!landmarks) return;
      const segments: Array<[number, number]> = [
        [ARM_INDEX.leftShoulder, ARM_INDEX.rightShoulder],
        [ARM_INDEX.leftShoulder, ARM_INDEX.leftElbow],
        [ARM_INDEX.leftElbow, ARM_INDEX.leftWrist],
        [ARM_INDEX.rightShoulder, ARM_INDEX.rightElbow],
        [ARM_INDEX.rightElbow, ARM_INDEX.rightWrist],
        [ARM_INDEX.leftShoulder, ARM_INDEX.leftHip],
        [ARM_INDEX.rightShoulder, ARM_INDEX.rightHip],
        [ARM_INDEX.leftHip, ARM_INDEX.rightHip],
      ];
      ctx.strokeStyle = 'rgba(215, 233, 220, 0.9)';
      ctx.lineWidth = 2;
      for (const [a, b] of segments) {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
        ctx.stroke();
      }
    },
    [camera.videoRef],
  );

  const finishHold = useCallback(() => {
    const accum = accumRef.current;
    const total = Math.max(1, accum.frames);
    const toSeries = (side: 'left' | 'right'): ArmPoint[] => {
      // Smooth the whole timeline with the gap-preserving moving
      // average from the angles module, then keep only the frames
      // where the arm was actually seen. Gaps stay gaps in the series;
      // they are never interpolated into invented angles.
      const smoothed = smoothSeries(
        accum.samples.map((sample) => sample[side]),
        SMOOTH_WINDOW,
      );
      const series: ArmPoint[] = [];
      accum.samples.forEach((sample, index) => {
        const value = smoothed[index];
        if (value !== null && value !== undefined) {
          series.push({ t: sample.t, deg: value });
        }
      });
      return series;
    };
    const result = armStageOutcome(
      toSeries('left'),
      toSeries('right'),
      accum.leftValid / total,
      accum.rightValid / total,
      HOLD_SECONDS,
    );
    setOutcome(result);
    setPhase('card');
  }, []);

  const runLoop = useCallback(() => {
    const landmarker = landmarkerRef.current;
    const video = camera.videoRef.current;
    if (!landmarker || !video) return;

    const tick = (now: number) => {
      const current = phaseRef.current;
      if (current !== 'framing' && current !== 'position' && current !== 'hold') return;
      rafRef.current = requestAnimationFrame(tick);
      const accum = accumRef.current;
      if (now - accum.lastDetect < DETECT_EVERY_MS || video.readyState < 2) return;
      accum.lastDetect = now;
      const ts = Math.max(now, accum.lastTs + 1);
      accum.lastTs = ts;

      let result: PoseLandmarkerResult;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch {
        return;
      }
      drawOverlay(result);
      const landmarks = result.landmarks?.[0];

      if (current === 'framing') {
        if (!landmarks || !ALL_GATE_INDEX.every((index) => visible(landmarks, index))) {
          accum.gateSince = null;
          setGuidance(
            !landmarks || !visible(landmarks, ARM_INDEX.leftShoulder) || !visible(landmarks, ARM_INDEX.rightShoulder)
              ? 'Step back until your shoulders and hips are in the frame.'
              : 'Step back until both arms fit in the frame.',
          );
          return;
        }
        setGuidance('Body found. Keep both arms in the frame.');
        if (accum.gateSince === null) accum.gateSince = now;
        if (now - accum.gateSince >= FRAME_HOLD_MS) {
          accum.positionSince = null;
          setGuidance('Raise both arms out to the sides, palms down.');
          setPhase('position');
        }
        return;
      }

      if (current === 'position') {
        const left = landmarks ? armProjectedAngle(landmarks, 'left') : null;
        const right = landmarks ? armProjectedAngle(landmarks, 'right') : null;
        const inZone = (angle: number | null) => angle !== null && angle >= 60 && angle <= 120;
        if (inZone(left) && inZone(right)) {
          if (accum.positionSince === null) accum.positionSince = now;
          if (now - accum.positionSince >= POSITION_HOLD_MS) {
            accum.phaseStart = now;
            accum.samples = [];
            accum.frames = 0;
            accum.leftValid = 0;
            accum.rightValid = 0;
            setLiveSamples([]);
            setSecondsLeft(HOLD_SECONDS);
            setGuidance('Hold both arms out. Keep holding.');
            setPhase('hold');
          }
        } else {
          accum.positionSince = null;
          setGuidance('Raise both arms out to the sides, palms down.');
        }
        return;
      }

      // Hold: record one sample per detection frame. A side that is not
      // clearly visible records a gap (null), never a guessed angle.
      const t = (now - accum.phaseStart) / 1000;
      const leftOk = landmarks !== undefined && sideVisible(landmarks, 'left');
      const rightOk = landmarks !== undefined && sideVisible(landmarks, 'right');
      const sample: HoldSample = {
        t: Math.min(t, HOLD_SECONDS),
        left: leftOk && landmarks ? armProjectedAngle(landmarks, 'left') : null,
        right: rightOk && landmarks ? armProjectedAngle(landmarks, 'right') : null,
      };
      accum.samples.push(sample);
      accum.frames += 1;
      if (sample.left !== null) accum.leftValid += 1;
      if (sample.right !== null) accum.rightValid += 1;
      setLiveSamples([...accum.samples]);
      setSecondsLeft(Math.max(0, Math.ceil(HOLD_SECONDS - t)));
      if (t >= HOLD_SECONDS) {
        finishHold();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [camera.videoRef, drawOverlay, finishHold]);

  const startCamera = useCallback(async () => {
    setPhase('starting');
    setModelError(null);
    const cameraOk = await camera.start();
    if (!cameraOk) {
      setPhase('prime');
      return;
    }
    try {
      landmarkerRef.current = await getLandmarker('pose');
    } catch (error) {
      setModelError(
        error instanceof ModelLoadError
          ? error.message
          : 'The pose model could not be loaded. Please try again.',
      );
      camera.stop();
      setPhase('prime');
      return;
    }
    accumRef.current.phaseStart = performance.now();
    accumRef.current.gateSince = null;
    setPhase('framing');
    runLoop();
  }, [camera, runLoop]);

  const redo = useCallback(() => {
    stopLoop();
    camera.stop();
    setOutcome(null);
    setLiveSamples([]);
    setSecondsLeft(HOLD_SECONDS);
    setGuidedStep(0);
    setPhase('prime');
  }, [camera, stopLoop]);

  // ---------------------------------------------------------------------
  // Guided example mode (no camera)
  // ---------------------------------------------------------------------
  if (mode === 'guided') {
    const steps = [
      {
        title: 'Arms out to the sides',
        text: 'In the example, the person stands in the guide frame and raises both arms out to the sides, palms down. The check starts by itself once both arms are up.',
      },
      {
        title: 'Hold for 10 seconds',
        text: 'The chart follows each arm angle during the hold. In this teaching example, the right arm slowly sinks while the left arm stays about level. These are example lines, not your arms.',
      },
    ];
    const step = steps[Math.min(guidedStep, steps.length - 1)];
    const isLast = guidedStep >= steps.length - 1;
    return (
      <section className="panel fast-stage" aria-label="Arm stage, guided example">
        <div className="fast-guided-banner" role="note">
          Guided example - not a measurement
        </div>
        <h3 className="section-title">Arm - guided example</h3>
        <p className="muted">{POSITION_NOTE}</p>
        <p className="fast-instruction">{step.title}</p>
        <p>{step.text}</p>
        <ArmChart
          leftSeries={EXAMPLE_LEFT}
          rightSeries={EXAMPLE_RIGHT}
          holdSeconds={HOLD_SECONDS}
          leftStartDeg={88}
          rightStartDeg={90}
        />
        <p className="muted">{HOW_IT_WORKS}</p>
        <div className="fast-actions">
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onFinish({ status: 'example' })}
            >
              Continue to Speech
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setGuidedStep((value) => value + 1)}
            >
              Next step
            </button>
          )}
          <button type="button" className="btn" onClick={skip}>
            Skip this stage
          </button>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------
  // Camera mode
  // ---------------------------------------------------------------------
  const liveLeft: ArmPoint[] = liveSamples
    .filter((sample) => sample.left !== null)
    .map((sample) => ({ t: sample.t, deg: sample.left as number }));
  const liveRight: ArmPoint[] = liveSamples
    .filter((sample) => sample.right !== null)
    .map((sample) => ({ t: sample.t, deg: sample.right as number }));
  const ringFraction = phase === 'hold' ? 1 - secondsLeft / HOLD_SECONDS : 0;
  const ringCircumference = 2 * Math.PI * 34;

  return (
    <section className="panel fast-stage" aria-label="Arm stage">
      <div className="fast-stage-head">
        <h3 className="section-title">Arm</h3>
        {phase !== 'card' ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Skip this stage
          </button>
        ) : null}
      </div>
      <p className="muted">{POSITION_NOTE}</p>

      {phase !== 'card' ? (
        <>
          <div className="fast-video-wrap">
            <video ref={camera.videoRef} className="fast-video" playsInline muted />
            <canvas ref={canvasRef} className="fast-overlay" aria-hidden="true" />
            <p className="fast-lamp" role="status">
              {guidance}
            </p>
          </div>

          {phase === 'hold' ? (
            <div className="fast-hold-row">
              <svg className="fast-ring" viewBox="0 0 84 84" role="img" aria-label={`${secondsLeft} seconds left`}>
                <circle cx="42" cy="42" r="34" className="fast-ring-track" />
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  className="fast-ring-fill"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringCircumference * (1 - ringFraction)}
                />
                <text x="42" y="49" textAnchor="middle" className="fast-ring-text">
                  {secondsLeft}
                </text>
              </svg>
              <ArmChart leftSeries={liveLeft} rightSeries={liveRight} holdSeconds={HOLD_SECONDS} />
            </div>
          ) : null}

          {phase === 'prime' && camera.status !== 'failed' ? (
            <PermissionPrime
              device="camera"
              why="The camera follows points on your body while you hold both arms raised, so the lab can measure each arm angle in the picture."
              onStart={() => void startCamera()}
              exits={[{ label: 'Use the guided example', onSelect: () => setMode('guided') }]}
            />
          ) : null}

          {camera.status === 'failed' && camera.failure ? (
            <PermissionDenied
              device="camera"
              failure={camera.failure}
              onRetry={() => void startCamera()}
              exits={[
                { label: 'Use the guided example', onSelect: () => setMode('guided') },
                { label: 'Skip this stage', onSelect: skip },
              ]}
            />
          ) : null}

          {modelError ? (
            <div className="fast-note" role="alert">
              <p>{modelError}</p>
              <div className="fast-actions">
                <button type="button" className="btn" onClick={() => setMode('guided')}>
                  Use the guided example
                </button>
                <button type="button" className="btn" onClick={skip}>
                  Skip this stage
                </button>
              </div>
            </div>
          ) : null}

          {phase === 'starting' ? (
            <p className="muted">Starting the camera and the pose model...</p>
          ) : null}
        </>
      ) : (
        <div className="fast-stage-card">
          {outcome?.status === 'measured' ? (
            <>
              <p className="fast-card-headline">Your arm stage is recorded.</p>
              <ArmChart
                leftSeries={outcome.leftSeries}
                rightSeries={outcome.rightSeries}
                holdSeconds={outcome.holdSeconds}
                leftStartDeg={outcome.left.startDeg}
                rightStartDeg={outcome.right.startDeg}
              />
              <p>{describeArmHold(outcome.left, outcome.right, outcome.holdSeconds)}</p>
              <p className="muted">{HOW_IT_WORKS}</p>
              <div className="fast-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => finishStage(outcome)}
                >
                  Continue to Speech
                </button>
                <button type="button" className="btn" onClick={redo}>
                  Redo arm stage
                </button>
              </div>
            </>
          ) : outcome?.status === 'could-not' ? (
            <>
              <p className="fast-card-headline">The camera could not measure your arms this time.</p>
              <p>{outcome.reason}</p>
              <p className="muted">{outcome.suggestion}</p>
              <div className="fast-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => finishStage(outcome)}
                >
                  Continue to Speech
                </button>
                <button type="button" className="btn" onClick={redo}>
                  Redo arm stage
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
