import { useEffect, useRef, useState } from 'react';
import { CannotAnalyzePanel, UncertaintyNote } from '../../components/ui';
import {
  formatDurationMs,
  summarizeObserverEvents,
  summarizeSitToStand,
  summarizeSway,
} from './balance-logic';
import type { SwaySample } from './balance-logic';

// Sit-to-Stand and Balance Lab (feature id: balance-lab, route #lab/balance-lab).
//
// Two gross motor practice tasks:
// 1. Five timed sit-to-stand repetitions, counted by tapping a large button
//    at each full stand. The lab records the time of every repetition.
// 2. Thirty seconds of quiet standing. When the device offers motion
//    sensors and the person allows them, phone tilt is recorded as a sway
//    proxy. Without sensors, a manual mode lets the person or a companion
//    mark each visible sway or step instead.
//
// Nothing here is a balance score, a fall risk estimate, or a clinical
// test result. Wording stays observational on purpose.

const TARGET_REPS = 5;
const SWAY_DURATION_MS = 30_000;

type StsPhase = 'idle' | 'running' | 'done';
type SwayPhase = 'idle' | 'running' | 'done';
type SwayMode = 'sensor' | 'manual';

interface DeviceMotionPermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

function motionPermissionApi(): DeviceMotionPermissionApi | null {
  if (typeof DeviceMotionEvent === 'undefined') return null;
  return DeviceMotionEvent as unknown as DeviceMotionPermissionApi;
}

function SafetyPanel({ acknowledged, onChange }: { acknowledged: boolean; onChange: (v: boolean) => void }) {
  return (
    <section className="panel" aria-labelledby="balance-safety-title" style={{ borderLeft: '6px solid #b3261e' }}>
      <h2 className="section-title" id="balance-safety-title">
        Read this before you start
      </h2>
      <ul className="step-list">
        <li>
          <strong>Keep support within reach.</strong> Do these tasks next to a sturdy chair or a
          wall that your hand can reach at all times.
        </li>
        <li>
          <strong>Do not do the standing task alone if you feel unsteady.</strong> Have another
          person stand beside you for the whole recording.
        </li>
        <li>
          <strong>Stop at once if you feel dizzy, faint, unwell, or in pain.</strong> Sit down,
          hold your support, and end the session. The stop button is large and always on screen
          while a task runs.
        </li>
        <li>
          <strong>Clear the floor first.</strong> Remove anything you could trip over, and wear
          footwear that does not slip.
        </li>
        <li>
          You can skip either task, or the whole lab. Skipping is always an acceptable choice.
        </li>
      </ul>
      <label className="consent-box">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          I have support within reach, another person beside me for the standing task if I need
          one, and I will stop at once if I feel dizzy or unwell.
        </span>
      </label>
    </section>
  );
}

function SitToStandTask({ enabled }: { enabled: boolean }) {
  const [phase, setPhase] = useState<StsPhase>('idle');
  const [repEnds, setRepEnds] = useState<number[]>([]);
  const [nowMs, setNowMs] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = () => {
    startRef.current = Date.now();
    setRepEnds([]);
    setNowMs(startRef.current);
    setPhase('running');
  };

  const recordStand = () => {
    const next = [...repEnds, Date.now()];
    setRepEnds(next);
    if (next.length >= TARGET_REPS) setPhase('done');
  };

  const stopEarly = () => setPhase('done');
  const reset = () => {
    setRepEnds([]);
    setPhase('idle');
  };

  const summary = summarizeSitToStand(startRef.current, repEnds);
  const elapsedMs = phase === 'running' ? nowMs - startRef.current : summary.totalMs;

  return (
    <section className="panel" aria-labelledby="sts-title">
      <h2 className="section-title" id="sts-title">
        Task 1: Sit to stand, {TARGET_REPS} times
      </h2>
      <p>
        Sit in a sturdy chair with your feet flat on the floor. When you press start, stand up
        fully and sit back down {TARGET_REPS} times at your own pace. Each time you reach a full
        stand, tap the large button (or ask your companion to tap it). The lab records the time
        of every repetition. Rest between repetitions whenever you need to; the timer keeps
        running and that rest is part of the recording.
      </p>

      {phase === 'idle' && (
        <button type="button" className="btn btn-primary" onClick={start} disabled={!enabled}>
          Start the timer
        </button>
      )}
      {!enabled && phase === 'idle' && (
        <p className="muted">Confirm the checklist above first. The start button unlocks after that.</p>
      )}

      {phase === 'running' && (
        <div>
          <p aria-live="polite" style={{ fontSize: '2rem', fontWeight: 700 }}>
            {formatDurationMs(elapsedMs)}
          </p>
          <p>
            Completed stands: <strong>{repEnds.length}</strong> of {TARGET_REPS}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={recordStand}
              style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
            >
              I am fully standing ({repEnds.length + 1} of {TARGET_REPS})
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={stopEarly}
              style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
            >
              Stop now
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div>
          <h3>What was recorded</h3>
          {summary.repDurationsMs.length === 0 ? (
            <p>No completed stand was recorded, so there are no times to show.</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Repetition</th>
                    <th scope="col">Time for this repetition</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.repDurationsMs.map((duration, index) => (
                    <tr key={index}>
                      <td>{index + 1}</td>
                      <td>{formatDurationMs(duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul>
                <li>Repetitions recorded: {summary.repDurationsMs.length} of {TARGET_REPS}</li>
                <li>Total time: {formatDurationMs(summary.totalMs)}</li>
                {summary.averageMs !== null && (
                  <li>Average per repetition: {formatDurationMs(summary.averageMs)}</li>
                )}
                {summary.fastestMs !== null && (
                  <li>Shortest repetition: {formatDurationMs(summary.fastestMs)}</li>
                )}
                {summary.slowestMs !== null && (
                  <li>Longest repetition: {formatDurationMs(summary.slowestMs)}</li>
                )}
              </ul>
              <p className="muted">
                These times describe this session only. They are influenced by the chair height,
                footwear, pain, tiredness, and how the button was tapped, and they are not
                compared with any population value here.
              </p>
            </>
          )}
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Record again
          </button>
        </div>
      )}
    </section>
  );
}

function SwayTask({ enabled }: { enabled: boolean }) {
  const [phase, setPhase] = useState<SwayPhase>('idle');
  const [mode, setMode] = useState<SwayMode>('sensor');
  const [remainingMs, setRemainingMs] = useState(SWAY_DURATION_MS);
  const [sensorNote, setSensorNote] = useState<string | null>(null);
  const [samples, setSamples] = useState<SwaySample[]>([]);
  const [eventStamps, setEventStamps] = useState<number[]>([]);
  const startRef = useRef(0);
  const samplesRef = useRef<SwaySample[]>([]);

  const sensorSupported = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;

  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      const left = SWAY_DURATION_MS - (Date.now() - startRef.current);
      if (left <= 0) {
        setRemainingMs(0);
        setSamples(samplesRef.current);
        setPhase('done');
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running' || mode !== 'sensor') return;
    const handler = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null) return;
      samplesRef.current = [
        ...samplesRef.current,
        { x: acc.x, y: acc.y, tMs: Date.now() - startRef.current },
      ];
    };
    window.addEventListener('devicemotion', handler);
    return () => window.removeEventListener('devicemotion', handler);
  }, [phase, mode]);

  const start = async () => {
    setSensorNote(null);
    samplesRef.current = [];
    setSamples([]);
    setEventStamps([]);
    if (mode === 'sensor') {
      const api = motionPermissionApi();
      if (api?.requestPermission) {
        try {
          const answer = await api.requestPermission();
          if (answer !== 'granted') {
            setSensorNote(
              'Motion sensor access was not granted, so no sensor recording was started. You can use manual mode instead.',
            );
            return;
          }
        } catch {
          setSensorNote(
            'Motion sensor access could not be requested on this device. You can use manual mode instead.',
          );
          return;
        }
      }
    }
    startRef.current = Date.now();
    setRemainingMs(SWAY_DURATION_MS);
    setPhase('running');
  };

  const stopEarly = () => {
    setSamples(samplesRef.current);
    setPhase('done');
  };

  const reset = () => {
    setSamples([]);
    setEventStamps([]);
    setSensorNote(null);
    setPhase('idle');
  };

  const sway = summarizeSway(samples);
  const events = summarizeObserverEvents(startRef.current, eventStamps);
  const recordedSec = Math.max(0, (SWAY_DURATION_MS - remainingMs) / 1000);

  return (
    <section className="panel" aria-labelledby="sway-title">
      <h2 className="section-title" id="sway-title">
        Task 2: Stand still for 30 seconds
      </h2>
      <p>
        Stand still with your support within reach and a companion beside you if you need one.
        In sensor mode, hold the phone flat against your chest or belly so its tilt follows your
        body movement; the recording is a tilt signal from the phone, not a measurement of the
        pressure under your feet. In manual mode, you or your companion taps a button each time
        a visible sway or a step happens.
      </p>

      {phase === 'idle' && (
        <div>
          <div role="radiogroup" aria-label="Recording mode" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label>
              <input
                type="radio"
                name="sway-mode"
                checked={mode === 'sensor'}
                onChange={() => setMode('sensor')}
              />{' '}
              Use motion sensors{sensorSupported ? '' : ' (not offered by this device or browser)'}
            </label>
            <label>
              <input
                type="radio"
                name="sway-mode"
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
              />{' '}
              Manual marking
            </label>
          </div>
          <p>
            <button type="button" className="btn btn-primary" onClick={start} disabled={!enabled}>
              Start the 30 second recording
            </button>
          </p>
          {!enabled && (
            <p className="muted">Confirm the checklist above first. The start button unlocks after that.</p>
          )}
          {sensorNote && <p role="alert">{sensorNote}</p>}
        </div>
      )}

      {phase === 'running' && (
        <div>
          <p aria-live="polite" style={{ fontSize: '2rem', fontWeight: 700 }}>
            {Math.ceil(remainingMs / 1000)} seconds left
          </p>
          {mode === 'manual' ? (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setEventStamps((previous) => [...previous, Date.now()])}
                style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
              >
                Mark a sway or step ({eventStamps.length} marked)
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={stopEarly}
                style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
              >
                Stop now
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger"
              onClick={stopEarly}
              style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
            >
              Stop now
            </button>
          )}
          <p className="muted">
            Stop at once and sit down if you feel dizzy, faint, or unwell. Stopping early is
            recorded as stopping early, nothing more.
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div>
          <h3>What was recorded</h3>
          {mode === 'manual' ? (
            <div>
              <p>
                Marked sways or steps: <strong>{events.count}</strong> during about{' '}
                {recordedSec.toFixed(0)} seconds of standing.
              </p>
              {events.count > 0 && (
                <p className="muted">
                  Marked at: {events.eventTimesSec.map((t) => `${t.toFixed(1)} s`).join(', ')}.
                </p>
              )}
              <p className="muted">
                These are observer taps, not sensor measurements. They record that a sway or step
                was noticed, not how large it was.
              </p>
            </div>
          ) : samples.length === 0 ? (
            <CannotAnalyzePanel
              role="alert"
              reason="The recording finished without any motion sensor samples, so there is no sway signal to describe."
              guidance="This can happen when the browser does not share motion data, the phone was not held against the body, or sensor access was withdrawn. Try manual mode, or check the browser permission for motion sensors and record again."
            />
          ) : (
            <ul>
              <li>Sensor samples recorded: {sway.sampleCount}</li>
              <li>Recording length: {formatDurationMs(sway.durationMs)}</li>
              <li>Tilt path length: {sway.pathLength.toFixed(1)} units</li>
              <li>Spread around your own average tilt (RMS): {sway.rmsSpread.toFixed(2)} units</li>
              <li>Average tilt speed: {sway.meanSpeed.toFixed(2)} units per second</li>
              <li>Largest tilt from your average: {sway.maxExcursion.toFixed(2)} units</li>
            </ul>
          )}
          {mode === 'sensor' && samples.length > 0 && (
            <p className="muted">
              Phone tilt is a rough proxy for body movement. It is not your center of mass and
              not the pressure under your feet, and these numbers are not compared with any
              population value here.
            </p>
          )}
          <button type="button" className="btn btn-ghost" onClick={reset}>
            Record again
          </button>
        </div>
      )}
    </section>
  );
}

export default function BalanceLab() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="page-stack">
      <SafetyPanel acknowledged={acknowledged} onChange={setAcknowledged} />
      <SitToStandTask enabled={acknowledged} />
      <SwayTask enabled={acknowledged} />
      <section className="panel" aria-labelledby="balance-limits-title">
        <h2 className="section-title" id="balance-limits-title">
          What this lab cannot do
        </h2>
        <p>
          A phone or a 2D camera cannot measure the pressure under your feet, and phone tilt is
          not your true center of mass. This lab produces no balance score and no estimate of
          fall risk, and it is not the Berg Balance Scale, a Romberg test, or any other clinical
          assessment. Timings and tilt numbers describe one practice session under one set of
          conditions, and a session that looks unremarkable here cannot rule out a balance
          problem.
        </p>
        <UncertaintyNote>
          If standing or rising from a chair is difficult for you in daily life, or you have
          fallen, discuss it with your clinician or physiotherapist rather than relying on any
          practice tool. If you suddenly cannot stand or walk as usual, treat that as an
          emergency and call 119 in Indonesia.
        </UncertaintyNote>
      </section>
    </div>
  );
}
