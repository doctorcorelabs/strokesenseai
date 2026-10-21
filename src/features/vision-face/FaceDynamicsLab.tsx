// Face Dynamics Lab: guided facial movement tasks, recorded honestly.
//
// A session records a neutral baseline first, then one record per task:
// measured from landmarks (synthetic performer, or a photo or snapshot
// with hand-placed landmarks), self-reported, or skipped. Results are
// changes in plain geometric signals against the person's own baseline.
// The lab never labels a pattern in the person's data; the only curves
// it shows are the person's own recorded points and a synthetic
// reference that is labelled as synthetic everywhere it appears.

import { useMemo, useState } from 'react';
import { CannotAnalyzePanel } from '../../components/ui';
import { LANDMARK_KEYS, LANDMARK_LABELS, syntheticFace } from './geometry';
import type { FaceLandmarks, LandmarkKey } from './geometry';
import {
  DYNAMICS_TASKS,
  createSession,
  currentTask,
  formatChange,
  getTask,
  isComplete,
  performerLandmarks,
  recordMeasured,
  recordSelfReport,
  setBaseline,
  skipTask,
  summarizeSession,
  syntheticTrace,
  traceBounds,
  tracePath,
  zeroLineY,
} from './dynamics';
import type { DynamicsSession, DynamicsTaskId } from './dynamics';
import { CameraCapture, FaceSketch, LandmarkPicker, readFileAsDataUrl } from './capture';
import './vision-face.css';

/** Capture landmarks from an uploaded photo or a camera snapshot. */
function MeasureCapture({
  title,
  onMeasured,
}: {
  title: string;
  onMeasured: (landmarks: FaceLandmarks) => void;
}) {
  const [source, setSource] = useState<'upload' | 'camera'>('upload');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Partial<Record<LandmarkKey, { x: number; y: number }>>>({});
  const [error, setError] = useState<string | null>(null);

  const activeKey = LANDMARK_KEYS.find((key) => !placed[key]) ?? null;

  const confirm = () => {
    const out = {} as FaceLandmarks;
    for (const key of LANDMARK_KEYS) {
      const point = placed[key];
      if (!point) return;
      out[key] = point;
    }
    onMeasured(out);
    setPhotoUrl(null);
    setPlaced({});
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhotoUrl(await readFileAsDataUrl(file));
      setPlaced({});
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The file could not be read.');
    }
  };

  return (
    <div>
      <h3>{title}</h3>
      <div className="vf-tabs" role="group" aria-label="Measurement source">
        <button
          type="button"
          className="vf-tab"
          aria-pressed={source === 'upload'}
          onClick={() => setSource('upload')}
        >
          Upload a photo of the expression
        </button>
        <button
          type="button"
          className="vf-tab"
          aria-pressed={source === 'camera'}
          onClick={() => setSource('camera')}
        >
          Camera snapshot
        </button>
      </div>
      {source === 'upload' ? (
        <label>
          Choose a photo
          <input
            className="vf-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
      ) : (
        <CameraCapture
          onSnapshot={(url) => {
            setPhotoUrl(url);
            setPlaced({});
          }}
        />
      )}
      {error && (
        <p className="vf-note" role="alert">
          {error}
        </p>
      )}
      {photoUrl && (
        <>
          <LandmarkPicker
            imageUrl={photoUrl}
            placed={placed}
            activeKey={activeKey}
            onPlace={(key, point) => setPlaced((prev) => ({ ...prev, [key]: point }))}
          />
          <p>
            {activeKey
              ? `Next point: ${LANDMARK_LABELS[activeKey]}`
              : 'All points placed. Confirm to use this measurement.'}
          </p>
          <div className="vf-actions">
            <button type="button" className="btn btn-primary" disabled={activeKey !== null} onClick={confirm}>
              Use this measurement
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPhotoUrl(null);
                setPlaced({});
              }}
            >
              Discard photo
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReferenceChart({ taskId, userChange }: { taskId: DynamicsTaskId; userChange: number | null }) {
  const width = 640;
  const height = 220;
  const trace = useMemo(() => syntheticTrace(taskId), [taskId]);
  const bounds = useMemo(
    () =>
      traceBounds([
        trace,
        ...(userChange !== null ? [[{ phase: 0.5, value: userChange }]] : []),
      ]),
    [trace, userChange],
  );
  const userY =
    userChange !== null
      ? height - ((userChange - bounds.min) / (bounds.max - bounds.min || 1)) * height
      : null;
  return (
    <div>
      <svg
        className="vf-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Chart comparing the labelled synthetic reference curve with your recorded change"
      >
        <line x1={0} x2={width} y1={zeroLineY(height, bounds)} y2={zeroLineY(height, bounds)} className="vf-chart-zero" />
        <path d={tracePath(trace, width, height, bounds)} className="vf-chart-ref" />
        {userY !== null && <circle cx={width / 2} cy={userY} r={6} className="vf-stage-point" />}
      </svg>
      <p className="vf-legend">
        <span>
          <span className="vf-swatch vf-swatch-ref" /> Synthetic reference (labelled teaching curve,
          not a person)
        </span>
        {userChange !== null && (
          <span>
            <span className="vf-swatch" /> Your recorded change for this task (single point, at the
            held expression)
          </span>
        )}
      </p>
    </div>
  );
}

export default function FaceDynamicsLab() {
  const [session, setSession] = useState<DynamicsSession>(() => createSession());
  const [note, setNote] = useState('');
  const [showMeasure, setShowMeasure] = useState(false);
  const [baselineMeasure, setBaselineMeasure] = useState(false);

  const task = currentTask(session);
  const summary = summarizeSession(session);
  const complete = isComplete(session);
  const lastMeasured = [...session.records]
    .reverse()
    .find((record) => record.status === 'recorded' && record.source === 'measured');

  const restart = () => {
    setSession(createSession());
    setNote('');
    setShowMeasure(false);
    setBaselineMeasure(false);
  };

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="fd-about">
        <h2 className="section-title" id="fd-about">
          Movement, recorded as geometry
        </h2>
        <p>
          This lab guides you through four facial movement tasks and records what changed, in plain
          geometric signals, compared with your own neutral baseline from the same session. Moving
          tasks show more than a still photo: effort and timing become part of the record.
        </p>
        <p>
          <strong>Honesty rules of this lab:</strong> your recordings are never given a pattern
          label, never compared with a hidden norm, and never turned into a score. The only curves
          shown are your own recorded points and a synthetic reference that is labelled as
          synthetic. This is an educational simulation, not an examination and not a diagnosis.
        </p>
      </section>

      {!session.baseline ? (
        <section className="panel" aria-labelledby="fd-baseline">
          <h2 className="section-title" id="fd-baseline">
            Step 1: record a neutral baseline
          </h2>
          <p>
            Sit comfortably, face the camera straight on, relax your face, and look ahead. Every
            task is compared with this baseline, so keep the same seat and lighting for the whole
            session.
          </p>
          <div className="vf-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSession((prev) => setBaseline(prev, syntheticFace({})))}
            >
              Use the synthetic neutral face as baseline
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setBaselineMeasure((v) => !v)}>
              Measure my own neutral photo instead
            </button>
          </div>
          {baselineMeasure && (
            <MeasureCapture
              title="Your neutral expression"
              onMeasured={(landmarks) => {
                setSession((prev) => setBaseline(prev, landmarks));
                setBaselineMeasure(false);
              }}
            />
          )}
          <p className="muted">
            A synthetic baseline pairs with the synthetic performer. If you plan to measure your own
            photos for the tasks, record your own baseline so the comparison is within one person
            and one camera setup.
          </p>
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="fd-tasks">
            <h2 className="section-title" id="fd-tasks">
              Step 2: the tasks
            </h2>
            {task && !complete ? (
              <div>
                <h3>
                  Task {session.currentIndex + 1} of {DYNAMICS_TASKS.length}: {task.label}
                </h3>
                <p>
                  <strong>{task.instruction}</strong>
                </p>
                <p className="muted">{task.education}</p>
                <p>
                  Recorded signal: {task.signalLabel}, expected to move{' '}
                  {task.expectedDirection === 'up' ? 'up' : 'down'} from your baseline when the
                  movement happens. The lab records the change; it does not judge it.
                </p>
                <div className="vf-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setSession((prev) => recordMeasured(prev, performerLandmarks(task.id, 1)));
                      setShowMeasure(false);
                    }}
                  >
                    Perform with the synthetic performer
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowMeasure((v) => !v)}>
                    Measure my photo or snapshot
                  </button>
                </div>
                {showMeasure && (
                  <MeasureCapture
                    title={`Your ${task.label.toLowerCase()} expression`}
                    onMeasured={(landmarks) => {
                      setSession((prev) => recordMeasured(prev, landmarks));
                      setShowMeasure(false);
                    }}
                  />
                )}
                <div>
                  <label>
                    Or mark the task done without measuring, with an optional note
                    <input
                      type="text"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="For example: done, felt effortful on one side"
                    />
                  </label>
                  <div className="vf-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setSession((prev) => recordSelfReport(prev, note));
                        setNote('');
                      }}
                    >
                      Mark done without measuring
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setSession((prev) => skipTask(prev))}
                    >
                      Skip this task
                    </button>
                  </div>
                </div>
                <div className="vf-grid">
                  <div>
                    <h3>Synthetic performer, held expression</h3>
                    <FaceSketch
                      landmarks={performerLandmarks(task.id, 1)}
                      label={`Synthetic performer holding the ${task.label} expression`}
                    />
                  </div>
                  <div>
                    <h3>Reference curve for this task</h3>
                    <ReferenceChart taskId={task.id} userChange={null} />
                  </div>
                </div>
              </div>
            ) : (
              <p>All tasks have a record. The session summary is below.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="fd-results">
            <h2 className="section-title" id="fd-results">
              Session record
            </h2>
            <table className="vf-table">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Status</th>
                  <th scope="col">Signal change vs your baseline</th>
                  <th scope="col">How recorded</th>
                </tr>
              </thead>
              <tbody>
                {session.records.map((record) => {
                  const entry = getTask(record.taskId);
                  return (
                    <tr key={record.taskId}>
                      <td>{entry.label}</td>
                      <td>{record.status}</td>
                      <td>
                        {record.change !== null
                          ? `${entry.signalLabel}: ${formatChange(record.change)}`
                          : 'not measured'}
                        {record.note ? ` Note: ${record.note}` : ''}
                      </td>
                      <td>{record.source ?? 'not recorded'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="muted">
              Recorded {summary.recorded} of {DYNAMICS_TASKS.length} tasks ({summary.measured}{' '}
              measured, {summary.selfReported} self-reported), {summary.skipped} skipped,{' '}
              {summary.pending} still pending.
            </p>
            {lastMeasured && (
              <div>
                <h3>Your latest measured task against the synthetic reference</h3>
                <ReferenceChart taskId={lastMeasured.taskId} userChange={lastMeasured.change} />
                <p className="muted">
                  The dashed curve is a labelled synthetic teaching reference. Your point is a
                  single snapshot measurement; the two are shown together so you can see the
                  direction and rough size of a change, never as a pass or fail comparison.
                </p>
              </div>
            )}
            {complete && (
              <>
                <CannotAnalyzePanel
                  role="note"
                  reason="This session record is a set of practice measurements, not an analysis result. Nothing here confirms or rules out any condition."
                  guidance="If you noticed a new one-sided facial weakness in real life, especially if it started suddenly, treat it as an emergency and call 119 in Indonesia now instead of re-running this lab."
                />
                <div className="vf-actions">
                  <button type="button" className="btn btn-primary" onClick={restart}>
                    Start a new session
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
