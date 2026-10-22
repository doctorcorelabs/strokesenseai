// Face stage of the FAST Live Check.
//
// Flow, exactly as planned: prime, quality gate, a 2 second neutral
// baseline, a 4 second smile task, a 3 second brow raise task, then
// the stage card. Frames that fail the head pose gate during a task
// are thrown away and their time is counted, so the sheet can say how
// much was excluded. Per-side movement signals come from the Face Lab
// signal module (the shared contract), converted to the relative
// display scale against the person's own resting face. The stage
// never invents a value: a task with too little usable signal ends as
// could-not-be-measured with its reason attached.
//
// Side labels always mean the person's own left and right. MediaPipe
// blendshapes follow the subject's sides, and the preview is mirrored
// only as a display choice, so the labels stay honest either way.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FaceLandmarker, FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { getLandmarker, ModelLoadError } from '../../../ml/engine';
import PermissionPrime, { PermissionDenied } from '../../../components/PermissionPrime';
import { computeBrowMovement, computeSmileMovement, relativeMovement } from '../face-lab/signals';
import { useCameraStream } from './camera';
import { MovementBars } from './bits';
import {
  BROW_SECONDS,
  SMILE_SECONDS,
  describeFaceTask,
  faceTaskOutcome,
  headPoseFromMatrix,
  medianOf,
  poseWithinTolerance,
  type FaceWindowSample,
} from './session-logic';
import type { FaceStageOutcome, FaceTaskOutcome } from './types';

type Phase =
  | 'prime'
  | 'starting'
  | 'framing'
  | 'baseline'
  | 'smile'
  | 'brow'
  | 'card';

const BASELINE_MS = 2000;
const READY_HOLD_MS = 750;
const DETECT_EVERY_MS = 60;

const HOW_IT_WORKS =
  'The camera tracks 478 points on your face. The bars compare how much each side moved from your resting face. Small differences are common and this demo cannot judge them.';

const EXAMPLE_SMILE = { left: 62, right: 58 };
const EXAMPLE_BROW = { left: 41, right: 44 };

interface Accum {
  phaseStart: number;
  readySince: number | null;
  lastDetect: number;
  lastTs: number;
  baselineAttempts: number;
  smileRaw: { left: number[]; right: number[] };
  browRaw: { left: number[]; right: number[] };
  smileSamples: FaceWindowSample[];
  browSamples: FaceWindowSample[];
  smileUsable: number;
  smileExcluded: number;
  browUsable: number;
  browExcluded: number;
}

function freshAccum(now: number): Accum {
  return {
    phaseStart: now,
    readySince: null,
    lastDetect: 0,
    lastTs: 0,
    baselineAttempts: 0,
    smileRaw: { left: [], right: [] },
    browRaw: { left: [], right: [] },
    smileSamples: [],
    browSamples: [],
    smileUsable: 0,
    smileExcluded: 0,
    browUsable: 0,
    browExcluded: 0,
  };
}

function blendshapeRecord(result: FaceLandmarkerResult): Record<string, number> {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  const record: Record<string, number> = {};
  for (const category of categories) {
    record[category.categoryName] = category.score;
  }
  return record;
}

export default function FaceStage({
  guided,
  onFinish,
}: {
  guided: boolean;
  onFinish: (outcome: FaceStageOutcome) => void;
}) {
  const [mode, setMode] = useState<'camera' | 'guided'>(guided ? 'guided' : 'camera');
  const [phase, setPhase] = useState<Phase>('prime');
  const [lamp, setLamp] = useState('Looking for your face');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [liveBars, setLiveBars] = useState<{ left: number; right: number } | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<{ smile: FaceTaskOutcome; brow: FaceTaskOutcome } | null>(null);
  const [stageFailure, setStageFailure] = useState<{ reason: string; suggestion: string } | null>(
    null,
  );
  const [guidedStep, setGuidedStep] = useState(0);

  const camera = useCameraStream();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<Phase>('prime');
  const accumRef = useRef<Accum>(freshAccum(0));
  const baselineRef = useRef<{
    smile: { left: number; right: number };
    brow: { left: number; right: number };
  } | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (guided) setMode('guided');
  }, [guided]);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  const finishStage = useCallback(
    (outcome: FaceStageOutcome) => {
      stopLoop();
      camera.stop();
      onFinish(outcome);
    },
    [camera, onFinish, stopLoop],
  );

  const drawOverlay = useCallback((result: FaceLandmarkerResult) => {
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
    const landmarks = result.faceLandmarks?.[0];
    if (!landmarks) return;
    ctx.fillStyle = 'rgba(215, 233, 220, 0.85)';
    for (let i = 0; i < landmarks.length; i += 6) {
      const point = landmarks[i];
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [camera.videoRef]);

  const runLoop = useCallback(() => {
    const landmarker = landmarkerRef.current;
    const video = camera.videoRef.current;
    if (!landmarker || !video) return;

    const tick = (now: number) => {
      const current = phaseRef.current;
      if (current !== 'framing' && current !== 'baseline' && current !== 'smile' && current !== 'brow') {
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
      const accum = accumRef.current;
      if (now - accum.lastDetect < DETECT_EVERY_MS || video.readyState < 2) return;
      const dt = Math.min(0.25, (now - accum.lastDetect) / 1000 || 0);
      accum.lastDetect = now;
      const ts = Math.max(now, accum.lastTs + 1);
      accum.lastTs = ts;

      let result: FaceLandmarkerResult;
      try {
        result = landmarker.detectForVideo(video, ts);
      } catch {
        return;
      }
      drawOverlay(result);

      const landmarks = result.faceLandmarks?.[0];
      if (!landmarks || landmarks.length === 0) {
        if (current === 'framing') setLamp('Looking for your face');
        if (current === 'smile') accum.smileExcluded += dt;
        if (current === 'brow') accum.browExcluded += dt;
        accum.readySince = null;
        return;
      }

      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      const poseOk = matrix ? poseWithinTolerance(headPoseFromMatrix(matrix)) : false;
      let minX = Infinity;
      let maxX = -Infinity;
      for (const point of landmarks) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
      }
      const faceWidth = maxX - minX;
      const sizeOk = faceWidth >= 0.2 && faceWidth <= 0.85;
      const gateOk = poseOk && sizeOk;

      if (current === 'framing') {
        if (!poseOk) setLamp('Head turned too far, face the camera');
        else if (!sizeOk) setLamp(faceWidth < 0.2 ? 'Move a little closer' : 'Move a little farther away');
        else setLamp('Face found, hold still');
        if (gateOk) {
          if (accum.readySince === null) accum.readySince = now;
          if (now - accum.readySince >= READY_HOLD_MS) {
            accum.phaseStart = now;
            setLamp('Look at the camera with a relaxed face');
            setPhase('baseline');
          }
        } else {
          accum.readySince = null;
        }
        return;
      }

      const blendshapes = blendshapeRecord(result);

      if (current === 'baseline') {
        if (gateOk) {
          const smile = computeSmileMovement(blendshapes, landmarks);
          const brow = computeBrowMovement(blendshapes, landmarks);
          accum.smileRaw.left.push(smile.left);
          accum.smileRaw.right.push(smile.right);
          accum.browRaw.left.push(brow.left);
          accum.browRaw.right.push(brow.right);
        }
        if (now - accum.phaseStart >= BASELINE_MS) {
          if (accum.smileRaw.left.length >= 5) {
            baselineRef.current = {
              smile: {
                left: medianOf(accum.smileRaw.left),
                right: medianOf(accum.smileRaw.right),
              },
              brow: {
                left: medianOf(accum.browRaw.left),
                right: medianOf(accum.browRaw.right),
              },
            };
            accum.phaseStart = now;
            setLamp('Smile as wide as you can');
            setPhase('smile');
          } else if (accum.baselineAttempts < 1) {
            accum.baselineAttempts += 1;
            accum.smileRaw = { left: [], right: [] };
            accum.browRaw = { left: [], right: [] };
            accum.phaseStart = now;
            setLamp('Hold still a little longer, face the camera');
          } else {
            setStageFailure({
              reason:
                'A steady resting face could not be recorded. The face kept leaving the frame or turning away during the baseline.',
              suggestion:
                'Sit facing the camera in brighter light, hold your head still, and try the face stage again.',
            });
            setPhase('card');
          }
        }
        return;
      }

      // Task windows: smile, then brow. Only gate-passing frames count,
      // and the time of the frames that fail is recorded as excluded.
      const baseline = baselineRef.current;
      if (!baseline) return;
      const isSmile = current === 'smile';
      const raw = isSmile
        ? computeSmileMovement(blendshapes, landmarks)
        : computeBrowMovement(blendshapes, landmarks);
      const rest = isSmile ? baseline.smile : baseline.brow;
      const windowMs = (isSmile ? SMILE_SECONDS : BROW_SECONDS) * 1000;
      if (gateOk) {
        const sample = {
          left: relativeMovement(raw.left, rest.left),
          right: relativeMovement(raw.right, rest.right),
        };
        if (isSmile) {
          accum.smileSamples.push(sample);
          accum.smileUsable += dt;
        } else {
          accum.browSamples.push(sample);
          accum.browUsable += dt;
        }
        const recent = (isSmile ? accum.smileSamples : accum.browSamples).slice(-12);
        setLiveBars({
          left: medianOf(recent.map((sample) => sample.left)),
          right: medianOf(recent.map((sample) => sample.right)),
        });
      } else if (isSmile) {
        accum.smileExcluded += dt;
      } else {
        accum.browExcluded += dt;
      }
      setSecondsLeft(Math.max(0, Math.ceil((windowMs - (now - accum.phaseStart)) / 1000)));

      if (now - accum.phaseStart >= windowMs) {
        if (isSmile) {
          accum.phaseStart = now;
          setLamp('Raise your eyebrows as high as you can');
          setLiveBars(null);
          setPhase('brow');
        } else {
          const smile = faceTaskOutcome(
            'smile task',
            accum.smileSamples,
            accum.smileUsable,
            accum.smileExcluded,
            SMILE_SECONDS,
          );
          const brow = faceTaskOutcome(
            'brow raise task',
            accum.browSamples,
            accum.browUsable,
            accum.browExcluded,
            BROW_SECONDS,
          );
          setTasks({ smile, brow });
          setSecondsLeft(null);
          setPhase('card');
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [camera.videoRef, drawOverlay]);

  const startCamera = useCallback(async () => {
    setPhase('starting');
    setModelError(null);
    const cameraOk = await camera.start();
    if (!cameraOk) {
      setPhase('prime');
      return;
    }
    try {
      landmarkerRef.current = await getLandmarker('face');
    } catch (error) {
      setModelError(
        error instanceof ModelLoadError
          ? error.message
          : 'The face model could not be loaded. Please try again.',
      );
      camera.stop();
      setPhase('prime');
      return;
    }
    accumRef.current = freshAccum(performance.now());
    setLamp('Looking for your face');
    setPhase('framing');
    runLoop();
  }, [camera, runLoop]);

  const redo = useCallback(() => {
    stopLoop();
    camera.stop();
    setTasks(null);
    setStageFailure(null);
    setLiveBars(null);
    setSecondsLeft(null);
    setGuidedStep(0);
    setPhase('prime');
  }, [camera, stopLoop]);

  const skip = useCallback(() => {
    finishStage({ status: 'skipped' });
  }, [finishStage]);

  // ---------------------------------------------------------------------
  // Guided example mode (no camera)
  // ---------------------------------------------------------------------
  if (mode === 'guided') {
    const steps = [
      {
        title: 'Resting face',
        text: 'In the example, the person first looks at the camera with a relaxed face for 2 seconds. That resting face is the reference every later movement is compared with.',
        bars: null,
      },
      {
        title: 'Smile',
        text: 'The person smiles as wide as they can for 4 seconds. These are the example bars from the teaching recording.',
        bars: EXAMPLE_SMILE,
      },
      {
        title: 'Raise eyebrows',
        text: 'The person raises their eyebrows as high as they can for 3 seconds. These are the example bars for that task.',
        bars: EXAMPLE_BROW,
      },
    ];
    const step = steps[Math.min(guidedStep, steps.length - 1)];
    const isLast = guidedStep >= steps.length - 1;
    return (
      <section className="panel fast-stage" aria-label="Face stage, guided example">
        <div className="fast-guided-banner" role="note">
          Guided example - not a measurement
        </div>
        <h3 className="section-title">Face - guided example</h3>
        <p className="fast-instruction">{step.title}</p>
        <p>{step.text}</p>
        {step.bars ? <MovementBars left={step.bars.left} right={step.bars.right} /> : null}
        <p className="muted">{HOW_IT_WORKS}</p>
        <div className="fast-actions">
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onFinish({ status: 'example' })}
            >
              Continue to Arm
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
  const instruction =
    phase === 'baseline'
      ? 'Look at the camera with a relaxed face'
      : phase === 'smile'
        ? 'Smile as wide as you can'
        : phase === 'brow'
          ? 'Raise your eyebrows as high as you can'
          : phase === 'framing'
            ? 'Position your face in the oval'
            : null;

  return (
    <section className="panel fast-stage" aria-label="Face stage">
      <div className="fast-stage-head">
        <h3 className="section-title">Face</h3>
        {phase !== 'card' ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Skip this stage
          </button>
        ) : null}
      </div>

      {phase !== 'card' ? (
        <>
          <div className="fast-video-wrap">
            <video ref={camera.videoRef} className="fast-video" playsInline muted />
            <canvas ref={canvasRef} className="fast-overlay" aria-hidden="true" />
            <div className="fast-oval" aria-hidden="true" />
            <p className="fast-lamp" role="status">
              {lamp}
            </p>
          </div>

          {instruction ? <p className="fast-instruction">{instruction}</p> : null}
          {secondsLeft !== null && (phase === 'smile' || phase === 'brow') ? (
            <p className="fast-countdown" aria-hidden="true">
              {secondsLeft}
            </p>
          ) : null}
          {liveBars && (phase === 'smile' || phase === 'brow') ? (
            <MovementBars left={liveBars.left} right={liveBars.right} />
          ) : null}

          {phase === 'prime' && camera.status !== 'failed' ? (
            <PermissionPrime
              device="camera"
              why="The camera follows points on your face while you smile and raise your brows, so the lab can compare how much each side moved."
              onStart={() => void startCamera()}
              exits={[
                { label: 'Use the guided example', onSelect: () => setMode('guided') },
              ]}
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

          {phase === 'starting' ? <p className="muted">Starting the camera and the face model...</p> : null}
        </>
      ) : (
        <div className="fast-stage-card">
          {stageFailure ? (
            <>
              <p className="fast-card-headline">The camera could not measure your face this time.</p>
              <p>{stageFailure.reason}</p>
              <p className="muted">{stageFailure.suggestion}</p>
              <div className="fast-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => finishStage({ status: 'could-not', ...stageFailure })}
                >
                  Continue to Arm
                </button>
                <button type="button" className="btn" onClick={redo}>
                  Redo face stage
                </button>
              </div>
            </>
          ) : tasks ? (
            <>
              <p className="fast-card-headline">Your face stage is recorded.</p>
              {tasks.smile.status === 'measured' ? (
                <>
                  <h4>Smile</h4>
                  <MovementBars left={tasks.smile.left} right={tasks.smile.right} />
                  <p>{describeFaceTask(tasks.smile.left, tasks.smile.right)}</p>
                </>
              ) : (
                <p>Smile task: could not be measured. {tasks.smile.status === 'could-not' ? tasks.smile.reason : ''}</p>
              )}
              {tasks.brow.status === 'measured' ? (
                <>
                  <h4>Raise eyebrows</h4>
                  <MovementBars left={tasks.brow.left} right={tasks.brow.right} />
                  <p>{describeFaceTask(tasks.brow.left, tasks.brow.right)}</p>
                </>
              ) : (
                <p>Brow raise task: could not be measured. {tasks.brow.status === 'could-not' ? tasks.brow.reason : ''}</p>
              )}
              <p className="muted">{HOW_IT_WORKS}</p>
              <div className="fast-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => finishStage({ status: 'measured', smile: tasks.smile, brow: tasks.brow })}
                >
                  Continue to Arm
                </button>
                <button type="button" className="btn" onClick={redo}>
                  Redo face stage
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
