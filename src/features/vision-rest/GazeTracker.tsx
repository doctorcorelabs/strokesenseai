// Eye and Gaze Tracker lab (feature id: gaze-tracker, route: #lab/gaze-tracker).
//
// A structured eye movement practice lab. Calibration comes first and can
// honestly fail. The exercises then record a gaze signal and report
// descriptive statistics with data quality markers.
//
// Signal sources in this build:
// - Pointer practice: the pointer stands in for gaze, so the motor task of
//   following, jumping, and holding still can be practiced and scored.
// - Camera preview: the webcam is shown locally only. This build does not
//   run iris landmarks on the video, and the page says so.
// - Synthetic demo: generated traces with known noise and delay, so the
//   scoring can be inspected without any input device.

import { useEffect, useRef, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  CannotAnalyzePanel,
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import ToolCoach from '../../ai/ToolCoach';
import PermissionPrime, {
  PermissionDenied,
  permissionFailureFromError,
} from '../../components/PermissionPrime';
import type { PermissionFailure } from '../../components/PermissionPrime';
import { createRng } from './rng';
import {
  CALIBRATION_POINTS_5,
  CALIBRATION_POINTS_9,
  applyMap,
  canCalibrate,
  fitLinearMap,
  meanCalibrationError,
  pursuitTargetAt,
  samplingRateHz,
  scoreHolding,
  scorePursuit,
  scoreSaccades,
  syntheticCalibrationSamples,
  syntheticPursuitTrace,
  zoneMap,
} from './gaze';
import type {
  CalibrationSample,
  HoldingScore,
  LinearMap,
  NormPoint,
  PursuitScore,
  SaccadeScore,
  TimedPoint,
} from './gaze';

type InputMode = 'pointer' | 'camera' | 'synthetic';
type ExerciseKind = 'pursuit' | 'saccade' | 'holding';

const PURSUIT_MS = 8000;
const HOLDING_MS = 8000;
const SACCADE_JUMPS = 8;
const SACCADE_WINDOW_MS = 1500;

const STAGE_STYLE: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '16 / 10',
  background: '#10151c',
  borderRadius: 12,
  overflow: 'hidden',
  touchAction: 'none',
  userSelect: 'none',
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export default function GazeTracker() {
  const feature = getFeature('gaze-tracker');
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  const [mode, setMode] = useState<InputMode>('pointer');
  const [gridSize, setGridSize] = useState<5 | 9>(9);
  const [steadiness, setSteadiness] = useState<'steady' | 'shaky'>('steady');
  const [calIndex, setCalIndex] = useState(0);
  const [calSamples, setCalSamples] = useState<CalibrationSample[]>([]);
  const [calMap, setCalMap] = useState<LinearMap | null>(null);
  const [calError, setCalError] = useState<number | null>(null);
  const [calFailed, setCalFailed] = useState(false);
  const [cameraFailure, setCameraFailure] = useState<PermissionFailure | null>(null);
  const [cameraLive, setCameraLive] = useState(false);

  const [running, setRunning] = useState<ExerciseKind | null>(null);
  const [saccadeTarget, setSaccadeTarget] = useState<NormPoint | null>(null);
  const [saccadeCount, setSaccadeCount] = useState(0);
  const [pursuit, setPursuit] = useState<PursuitScore | null>(null);
  const [saccades, setSaccades] = useState<SaccadeScore | null>(null);
  const [holding, setHolding] = useState<HoldingScore | null>(null);
  const [lastSamples, setLastSamples] = useState<TimedPoint[]>([]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const targetDotRef = useRef<HTMLDivElement | null>(null);
  const runRef = useRef<{
    kind: ExerciseKind;
    startedAt: number;
    samples: TimedPoint[];
    lastPointer: NormPoint;
    jumps: { at: number; pos: NormPoint; responseAt: number | null }[];
    raf: number;
  } | null>(null);

  const calPoints = gridSize === 9 ? CALIBRATION_POINTS_9 : CALIBRATION_POINTS_5;
  const calibrated = calMap !== null && !calFailed;

  useEffect(() => {
    return () => {
      if (runRef.current) cancelAnimationFrame(runRef.current.raf);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function resetCalibration() {
    setCalIndex(0);
    setCalSamples([]);
    setCalMap(null);
    setCalError(null);
    setCalFailed(false);
  }

  function finishCalibration(samples: CalibrationSample[]) {
    const map = fitLinearMap(samples);
    const error = meanCalibrationError(map, samples);
    setCalError(error);
    if (canCalibrate(error)) {
      setCalMap(map);
      setCalFailed(false);
    } else {
      setCalMap(null);
      setCalFailed(true);
    }
  }

  function stagePoint(event: React.PointerEvent): NormPoint | null {
    const el = stageRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
  }

  function handleCalibrationClick(event: React.PointerEvent) {
    if (calibrated || calFailed || running) return;
    if (mode === 'synthetic') return;
    const point = stagePoint(event);
    if (!point) return;
    const target = calPoints[calIndex];
    const next = [...calSamples, { reading: point, target }];
    setCalSamples(next);
    if (next.length >= calPoints.length) {
      finishCalibration(next);
    } else {
      setCalIndex(calIndex + 1);
    }
  }

  function runSyntheticCalibration() {
    const samples = syntheticCalibrationSamples(calPoints, 1234, steadiness);
    setCalSamples(samples);
    setCalIndex(calPoints.length);
    finishCalibration(samples);
  }

  async function startCamera() {
    setCameraFailure(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraFailure('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraLive(true);
    } catch (caught) {
      setCameraFailure(permissionFailureFromError(caught));
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraLive(false);
  }

  const cameraExits = [
    {
      label: 'Use pointer practice instead',
      onSelect: () => {
        setMode('pointer');
        resetCalibration();
      },
    },
    {
      label: 'Use the synthetic demo instead',
      onSelect: () => {
        setMode('synthetic');
        resetCalibration();
      },
    },
  ];

  function moveTargetDot(point: NormPoint) {
    const dot = targetDotRef.current;
    if (dot) {
      dot.style.left = `${point.x * 100}%`;
      dot.style.top = `${point.y * 100}%`;
    }
  }

  function endRun() {
    const run = runRef.current;
    if (!run) return;
    cancelAnimationFrame(run.raf);
    runRef.current = null;
    setRunning(null);
    setSaccadeTarget(null);
    if (run.kind === 'pursuit') {
      setPursuit(scorePursuit(run.samples, PURSUIT_MS));
      setLastSamples(run.samples);
    } else if (run.kind === 'saccade') {
      setSaccades(
        scoreSaccades(
          run.jumps.map((jump) => ({ jumpAtMs: jump.at, responseAtMs: jump.responseAt })),
          SACCADE_WINDOW_MS,
        ),
      );
      setLastSamples(run.samples);
    } else {
      setHolding(scoreHolding(run.samples, { x: 0.5, y: 0.5 }));
      setLastSamples(run.samples);
    }
  }

  function startExercise(kind: ExerciseKind) {
    if (!calibrated || running) return;
    const rng = createRng(Date.now() % 100000);
    const run = {
      kind,
      startedAt: performance.now(),
      samples: [] as TimedPoint[],
      lastPointer: { x: 0.5, y: 0.5 },
      jumps: [] as { at: number; pos: NormPoint; responseAt: number | null }[],
      raf: 0,
    };
    runRef.current = run;
    setRunning(kind);
    if (kind === 'saccade') {
      const pos = { x: 0.15 + rng() * 0.7, y: 0.15 + rng() * 0.7 };
      run.jumps.push({ at: 0, pos, responseAt: null });
      setSaccadeTarget(pos);
      setSaccadeCount(1);
    }
    const tick = () => {
      const current = runRef.current;
      if (!current || current.kind !== kind) return;
      const elapsed = performance.now() - current.startedAt;
      if (kind === 'pursuit') {
        moveTargetDot(pursuitTargetAt(elapsed));
        current.samples.push({ ...current.lastPointer, t: elapsed });
        if (elapsed >= PURSUIT_MS) {
          endRun();
          return;
        }
      } else if (kind === 'holding') {
        current.samples.push({ ...current.lastPointer, t: elapsed });
        if (elapsed >= HOLDING_MS) {
          endRun();
          return;
        }
      } else {
        current.samples.push({ ...current.lastPointer, t: elapsed });
        const jump = current.jumps[current.jumps.length - 1];
        if (jump && jump.responseAt === null && elapsed - jump.at > SACCADE_WINDOW_MS) {
          advanceSaccade(elapsed);
        }
        if (current.jumps.length >= SACCADE_JUMPS && current.jumps.every((j) => j.responseAt !== null || elapsed - j.at > SACCADE_WINDOW_MS)) {
          endRun();
          return;
        }
      }
      current.raf = requestAnimationFrame(tick);
    };
    run.raf = requestAnimationFrame(tick);
  }

  function advanceSaccade(elapsed: number) {
    const run = runRef.current;
    if (!run) return;
    if (run.jumps.length >= SACCADE_JUMPS) return;
    const rng = createRng(Math.floor(elapsed) + run.jumps.length * 977);
    const pos = { x: 0.12 + rng() * 0.76, y: 0.12 + rng() * 0.76 };
    run.jumps.push({ at: elapsed, pos, responseAt: null });
    setSaccadeTarget(pos);
    setSaccadeCount(run.jumps.length);
  }

  function handleStagePointerMove(event: React.PointerEvent) {
    const point = stagePoint(event);
    if (!point) return;
    const run = runRef.current;
    if (!run) return;
    const gazePoint = calMap ? applyMap(calMap, point) : point;
    run.lastPointer = gazePoint;
    if (run.kind === 'saccade') {
      const jump = run.jumps[run.jumps.length - 1];
      if (jump && jump.responseAt === null) {
        const elapsed = performance.now() - run.startedAt;
        if (Math.hypot(gazePoint.x - jump.pos.x, gazePoint.y - jump.pos.y) < 0.08) {
          jump.responseAt = elapsed;
          if (run.jumps.length < SACCADE_JUMPS) advanceSaccade(elapsed);
        }
      }
    }
  }

  function runSyntheticPursuit() {
    const trace = syntheticPursuitTrace(2024, PURSUIT_MS, { noise: 0.02, lagMs: 160 });
    setPursuit(scorePursuit(trace, PURSUIT_MS));
    setLastSamples(trace);
  }

  const zones = zoneMap(lastSamples);
  const rateHz = samplingRateHz(lastSamples);
  const currentCalPoint = !calibrated && !calFailed ? calPoints[calIndex] : null;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Vision AI</p>
        <h1>Eye and Gaze Tracker</h1>
        <p className="muted">{feature?.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity="lab" />
          <ModeBadge mode={apiConfigured ? 'live' : 'offline'} />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="gaze-about">
        <h2 className="section-title" id="gaze-about">
          What this lab practices
        </h2>
        <p>
          Clinicians examine eye movements by asking a person to follow a moving target, look
          quickly between targets, and hold their gaze to one side. This lab turns those three
          tasks into structured practice with honest scoring. Calibration comes first: if the
          calibration error is too large, the exercises do not start and the lab says why.
        </p>
        <p className="muted">
          {feature?.limitations} In this build the pointer stands in for gaze, the camera preview
          is shown locally and is not analyzed, and no result here describes your eyes or your
          health.
        </p>
      </section>

      <section className="panel" aria-labelledby="gaze-input">
        <h2 className="section-title" id="gaze-input">
          1. Choose an input mode
        </h2>
        <div className="badge-row" role="group" aria-label="Input mode">
          <button
            type="button"
            className={mode === 'pointer' ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setMode('pointer');
              resetCalibration();
            }}
          >
            Pointer practice
          </button>
          <button
            type="button"
            className={mode === 'camera' ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setMode('camera');
              resetCalibration();
            }}
          >
            Camera preview plus pointer
          </button>
          <button
            type="button"
            className={mode === 'synthetic' ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setMode('synthetic');
              resetCalibration();
            }}
          >
            Synthetic demo
          </button>
        </div>
        <p className="muted">
          {mode === 'pointer' &&
            'Click each calibration point as it appears, then follow the targets with your pointer. The pointer position is the stand-in signal.'}
          {mode === 'camera' &&
            'Your webcam preview appears inside the stage so you can position yourself. The video stays on this device and is not analyzed in this build; calibration and scoring still use your pointer.'}
          {mode === 'synthetic' &&
            'Generated readings with a known scale error and noise are calibrated and scored, so you can watch the math work and see the cannot calibrate state when the signal is shaky.'}
        </p>
        {mode === 'camera' &&
          (cameraFailure ? (
            <PermissionDenied
              device="camera"
              failure={cameraFailure}
              onRetry={() => void startCamera()}
              exits={cameraExits}
            />
          ) : cameraLive ? (
            <div className="badge-row">
              <span role="status">Camera preview is on. It stays on this device.</span>
              <button type="button" className="btn" onClick={stopCamera}>
                Stop camera
              </button>
            </div>
          ) : (
            <PermissionPrime
              device="camera"
              why="Your webcam preview appears inside the stage so you can position yourself while you practice; calibration and scoring still use your pointer."
              privacyNote="The video is shown on this device only and is never uploaded, stored, or analyzed."
              onStart={() => void startCamera()}
              exits={cameraExits}
            />
          ))}
        <div className="badge-row" role="group" aria-label="Calibration grid">
          <span>Calibration points:</span>
          <button
            type="button"
            className={gridSize === 5 ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setGridSize(5);
              resetCalibration();
            }}
          >
            5 points
          </button>
          <button
            type="button"
            className={gridSize === 9 ? 'btn btn-primary' : 'btn'}
            onClick={() => {
              setGridSize(9);
              resetCalibration();
            }}
          >
            9 points
          </button>
          {mode === 'synthetic' && (
            <>
              <span>Synthetic signal:</span>
              <button
                type="button"
                className={steadiness === 'steady' ? 'btn btn-primary' : 'btn'}
                onClick={() => setSteadiness('steady')}
              >
                Steady
              </button>
              <button
                type="button"
                className={steadiness === 'shaky' ? 'btn btn-primary' : 'btn'}
                onClick={() => setSteadiness('shaky')}
              >
                Shaky
              </button>
            </>
          )}
        </div>
      </section>

      <section className="panel" aria-labelledby="gaze-stage-title">
        <h2 className="section-title" id="gaze-stage-title">
          2. Calibrate, then practice
        </h2>
        <div
          ref={stageRef}
          style={STAGE_STYLE}
          onPointerDown={handleCalibrationClick}
          onPointerMove={handleStagePointerMove}
          role="group"
          aria-label="Eye movement practice stage"
        >
          {mode === 'camera' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.35,
              }}
            />
          )}
          {currentCalPoint && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${currentCalPoint.x * 100}%`,
                top: `${currentCalPoint.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                border: '3px solid #ffd166',
                background: 'rgba(255, 209, 102, 0.25)',
              }}
            />
          )}
          {running === 'pursuit' && (
            <div
              ref={targetDotRef}
              aria-hidden="true"
              style={{
                position: 'absolute',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: '#7bd88a',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          {running === 'saccade' && saccadeTarget && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${saccadeTarget.x * 100}%`,
                top: `${saccadeTarget.y * 100}%`,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#ffd166',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
          {running === 'holding' && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#f2e7cb',
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              +
            </div>
          )}
        </div>

        {!calibrated && !calFailed && mode !== 'synthetic' && (
          <p>
            Calibration: click the highlighted point ({calIndex + 1} of {calPoints.length}).
          </p>
        )}
        {mode === 'synthetic' && !calibrated && !calFailed && (
          <p>
            <button type="button" className="btn btn-primary" onClick={runSyntheticCalibration}>
              Run synthetic calibration
            </button>
          </p>
        )}
        {calFailed && (
          <>
            <CannotAnalyzePanel
              role="alert"
              reason={`Calibration error was ${calError !== null ? (calError * 100).toFixed(1) : 'unknown'} percent of the stage size, which is above the limit for starting the exercises.`}
              guidance="In a real setup this means repositioning the camera, improving the light, and calibrating again. Here you can switch signal steadiness or mode and retry. No exercise result was produced from a failed calibration."
            />
            <p>
              <button type="button" className="btn" onClick={resetCalibration}>
                Calibrate again
              </button>
            </p>
          </>
        )}
        {calibrated && (
          <>
            <p role="status">
              Calibration accepted. Mean error {(calError ?? 0) * 100 < 1 ? '<1' : ((calError ?? 0) * 100).toFixed(1)}{' '}
              percent of stage size across {calSamples.length} points.
            </p>
            <div className="badge-row" role="group" aria-label="Exercises">
              <button
                type="button"
                className="btn btn-primary"
                disabled={running !== null}
                onClick={() => (mode === 'synthetic' ? runSyntheticPursuit() : startExercise('pursuit'))}
              >
                Smooth pursuit (8 s)
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={running !== null || mode === 'synthetic'}
                onClick={() => startExercise('saccade')}
              >
                Saccade test ({SACCADE_JUMPS} jumps)
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={running !== null || mode === 'synthetic'}
                onClick={() => startExercise('holding')}
              >
                Gaze holding (8 s)
              </button>
              <button type="button" className="btn" onClick={resetCalibration}>
                Recalibrate
              </button>
            </div>
            {running === 'pursuit' && <p>Follow the green dot with your pointer.</p>}
            {running === 'saccade' && (
              <p>
                Move your pointer onto each yellow target as fast as you can. Target {saccadeCount}{' '}
                of {SACCADE_JUMPS}.
              </p>
            )}
            {running === 'holding' && (
              <p>Keep your pointer exactly on the cross and hold it still.</p>
            )}
            {mode === 'synthetic' && (
              <p className="muted">
                Saccade and holding demos need a live signal, so in synthetic mode only the
                pursuit scoring is generated.
              </p>
            )}
          </>
        )}
      </section>

      {(pursuit || saccades || holding) && (
        <section className="panel" aria-labelledby="gaze-results">
          <h2 className="section-title" id="gaze-results">
            3. Session results (descriptive only)
          </h2>
          {pursuit && (
            <p>
              <strong>Smooth pursuit:</strong> mean distance to target{' '}
              {(pursuit.meanError * 100).toFixed(1)} percent of stage width, best matching delay{' '}
              {pursuit.estimatedLagMs} ms, error after that delay{' '}
              {(pursuit.meanErrorAfterLag * 100).toFixed(1)} percent, from {pursuit.sampleCount}{' '}
              samples.
            </p>
          )}
          {saccades && (
            <p>
              <strong>Saccade test:</strong> reached {saccades.hits} of {saccades.trials} targets
              inside the window ({Math.round(saccades.hitRate * 100)} percent), median response
              time{' '}
              {saccades.medianLatencyMs !== null
                ? `${Math.round(saccades.medianLatencyMs)} ms`
                : 'not available'}
              . Pointer movement includes your hand and the device, so these times are coarse
              practice numbers, not clinical latencies.
            </p>
          )}
          {holding && (
            <p>
              <strong>Gaze holding:</strong> typical drift {(holding.rmsDrift * 100).toFixed(1)}{' '}
              percent of stage width, largest drift {(holding.maxDrift * 100).toFixed(1)} percent,
              from {holding.sampleCount} samples.
            </p>
          )}
          {lastSamples.length > 0 && (
            <>
              <p className="muted">
                Sampling rate of the last recording: about {rateHz.toFixed(0)} samples per second.
                A consumer webcam records around 30 frames per second, which is not enough to
                characterize clinical findings such as nystagmus; this marker is shown so the
                limit stays visible next to the numbers.
              </p>
              <h3>Gaze point map by direction</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 6,
                  maxWidth: 420,
                }}
              >
                {zones.map((zone) => (
                  <div
                    key={zone.label}
                    style={{
                      border: '1px solid #3a4353',
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: `rgba(123, 216, 138, ${0.08 + zone.share * 0.5})`,
                    }}
                  >
                    <div>{zone.label}</div>
                    <strong>{Math.round(zone.share * 100)}%</strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <UncertaintyNote>
            These numbers describe one practice session with a stand-in signal. They carry no
            pattern label, and a session that looks typical cannot rule out any eye condition.
          </UncertaintyNote>
        </section>
      )}

      <ToolCoach
        tool="gaze"
        moduleId="gaze-tracker"
        context="Eye and Gaze Tracker lab: calibration with an error limit, then smooth pursuit, saccade, and gaze holding practice with descriptive statistics only."
        fallback="This lab practices the structure of an eye movement examination. Calibration maps the input signal to the screen and must pass an error limit before any exercise starts. Smooth pursuit measures how closely the signal follows a moving target and estimates its delay. The saccade test measures coarse response times to jumping targets. Gaze holding measures drift from a fixed point. All results are descriptive statistics of one session; a consumer camera or pointer cannot characterize clinical eye movement findings, and no pattern label is applied."
      />
    </div>
  );
}
