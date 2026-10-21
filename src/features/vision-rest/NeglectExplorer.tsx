// Visual Field and Neglect Explorer (feature id: neglect-explorer,
// route: #lab/neglect-explorer).
//
// Digital versions of three classic bedside tasks: cancellation, line
// bisection, and peripheral awareness. Scoring is fully deterministic and
// the rubric is printed on this page. A simulated patient mode with
// programmed response profiles keeps the learning experience separate from
// self-testing: the simulation is an illustration, never a measurement.
// No result in this lab is labeled as neglect or a visual field defect.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import ToolCoach from '../../ai/ToolCoach';
import {
  PATIENT_PROFILE_LABELS,
  generateBisectionLines,
  generateCancellation,
  planPeripheralFlashes,
  scoreBisection,
  scoreCancellation,
  scorePeripheral,
  simulatePatient,
} from './neglect';
import type {
  FieldItem,
  PatientProfile,
  PeripheralTrial,
  Quadrant,
} from './neglect';

type TaskKind = 'cancellation' | 'bisection' | 'peripheral';
type ExplorerMode = 'practice' | 'simulation';

const FIELD_W = 100;
const FIELD_H = 62.5;
const FLASH_MS = 550;
const RESPONSE_WINDOW_MS = 2000;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function FieldSvg({
  items,
  foundIds,
  showMissed,
  path,
  onItemClick,
  onFieldClick,
}: {
  items: FieldItem[];
  foundIds: ReadonlySet<number>;
  showMissed: boolean;
  path: { x: number; y: number }[];
  onItemClick?: (item: FieldItem) => void;
  onFieldClick?: (x: number, y: number) => void;
}) {
  function handleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (!onFieldClick) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onFieldClick(
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    );
  }
  return (
    <svg
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      style={{ width: '100%', background: '#f7f2df', borderRadius: 12, display: 'block' }}
      onClick={handleClick}
      role="img"
      aria-label="Cancellation test field"
    >
      <line x1={FIELD_W / 2} y1={0} x2={FIELD_W / 2} y2={FIELD_H} stroke="#d8cf9f" strokeDasharray="1.5 1.5" />
      {path.length > 1 && (
        <polyline
          points={path.map((p) => `${p.x * FIELD_W},${p.y * FIELD_H}`).join(' ')}
          fill="none"
          stroke="#8a6d1f"
          strokeWidth={0.45}
          strokeDasharray="1.6 1"
          opacity={0.8}
        />
      )}
      {items.map((item) => {
        const cx = item.x * FIELD_W;
        const cy = item.y * FIELD_H;
        const found = foundIds.has(item.id);
        if (item.kind === 'target') {
          return (
            <g
              key={item.id}
              onClick={(event) => {
                event.stopPropagation();
                onItemClick?.(item);
              }}
              style={{ cursor: onItemClick ? 'pointer' : 'default' }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={2.1}
                fill={found ? '#2e7d32' : showMissed ? '#f3d9d7' : '#ffffff'}
                stroke={found ? '#2e7d32' : showMissed ? '#b3261e' : '#37474f'}
                strokeWidth={0.45}
              />
              {found && (
                <path
                  d={`M ${cx - 1.2} ${cy} L ${cx - 0.3} ${cy + 1} L ${cx + 1.3} ${cy - 1.1}`}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.55}
                />
              )}
            </g>
          );
        }
        return (
          <rect
            key={item.id}
            x={cx - 1.3}
            y={cy - 1.3}
            width={2.6}
            height={2.6}
            fill="#ece5c8"
            stroke="#8d99ae"
            strokeWidth={0.4}
            onClick={(event) => {
              event.stopPropagation();
              onItemClick?.(item);
            }}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          />
        );
      })}
    </svg>
  );
}

export default function NeglectExplorer() {
  const feature = getFeature('neglect-explorer');
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  const [mode, setMode] = useState<ExplorerMode>('practice');
  const [task, setTask] = useState<TaskKind>('cancellation');
  const [seed, setSeed] = useState(7);

  // Cancellation practice state.
  const items = useMemo(() => generateCancellation(seed), [seed]);
  const [foundIds, setFoundIds] = useState<ReadonlySet<number>>(new Set());
  const [falseTaps, setFalseTaps] = useState(0);
  const [clickPath, setClickPath] = useState<{ x: number; y: number }[]>([]);
  const [cancelDone, setCancelDone] = useState(false);
  const cancelStartRef = useRef<number>(0);
  const [cancelElapsed, setCancelElapsed] = useState(0);

  // Simulation state.
  const [profile, setProfile] = useState<PatientProfile>('left-inattention');
  const simulation = useMemo(
    () => simulatePatient(items, profile, seed + 500),
    [items, profile, seed],
  );
  const simulationScore = useMemo(
    () => scoreCancellation(items, simulation.foundIds, simulation.falseTaps, 0),
    [items, simulation],
  );

  // Bisection state.
  const lines = useMemo(() => generateBisectionLines(seed), [seed]);
  const [lineIndex, setLineIndex] = useState(0);
  const [marks, setMarks] = useState<{ startX: number; endX: number; markX: number }[]>([]);
  const [pendingMark, setPendingMark] = useState<number | null>(null);
  const bisectionScore = useMemo(
    () => (marks.length > 0 ? scoreBisection(marks) : null),
    [marks],
  );

  // Peripheral state.
  const [peripheralRunning, setPeripheralRunning] = useState(false);
  const [peripheralDone, setPeripheralDone] = useState(false);
  const [flash, setFlash] = useState<Quadrant | null>(null);
  const [trials, setTrials] = useState<PeripheralTrial[]>([]);
  const peripheralRef = useRef<{
    plan: Quadrant[];
    index: number;
    shownAt: number;
    answered: boolean;
    timers: number[];
  } | null>(null);
  const peripheralScore = useMemo(
    () => (trials.length > 0 ? scorePeripheral(trials) : null),
    [trials],
  );

  useEffect(() => {
    return () => {
      peripheralRef.current?.timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function resetCancellation() {
    setFoundIds(new Set());
    setFalseTaps(0);
    setClickPath([]);
    setCancelDone(false);
    setCancelElapsed(0);
    cancelStartRef.current = 0;
  }

  function handleItemClick(item: FieldItem) {
    if (mode !== 'practice' || cancelDone) return;
    if (cancelStartRef.current === 0) cancelStartRef.current = performance.now();
    setClickPath((prev) => [...prev, { x: item.x, y: item.y }]);
    if (item.kind === 'target') {
      setFoundIds((prev) => new Set(prev).add(item.id));
    } else {
      setFalseTaps((prev) => prev + 1);
    }
  }

  function finishCancellation() {
    if (cancelStartRef.current > 0) {
      setCancelElapsed(performance.now() - cancelStartRef.current);
    }
    setCancelDone(true);
  }

  const cancelScore = useMemo(
    () => (cancelDone ? scoreCancellation(items, foundIds, falseTaps, cancelElapsed) : null),
    [cancelDone, items, foundIds, falseTaps, cancelElapsed],
  );

  function handleBisectionClick(x: number) {
    if (marks.length >= lines.length) return;
    setPendingMark(x);
  }

  function confirmBisectionMark() {
    if (pendingMark === null) return;
    const line = lines[lineIndex];
    setMarks((prev) => [...prev, { startX: line.startX, endX: line.endX, markX: pendingMark }]);
    setPendingMark(null);
    setLineIndex((prev) => Math.min(prev + 1, lines.length));
  }

  function schedulePeripheralStep() {
    const state = peripheralRef.current;
    if (!state) return;
    if (state.index >= state.plan.length) {
      setPeripheralRunning(false);
      setPeripheralDone(true);
      setFlash(null);
      return;
    }
    const quadrant = state.plan[state.index];
    const wait = window.setTimeout(() => {
      state.shownAt = performance.now();
      state.answered = false;
      setFlash(quadrant);
      const hide = window.setTimeout(() => setFlash(null), FLASH_MS);
      const expire = window.setTimeout(() => {
        if (!state.answered) {
          setTrials((prev) => [...prev, { quadrant, responded: false, latencyMs: null }]);
          state.index += 1;
        }
        schedulePeripheralStep();
      }, RESPONSE_WINDOW_MS);
      state.timers.push(hide, expire);
    }, 800);
    state.timers.push(wait);
  }

  function startPeripheral() {
    peripheralRef.current?.timers.forEach((timer) => window.clearTimeout(timer));
    peripheralRef.current = {
      plan: planPeripheralFlashes(seed + 31, 12),
      index: 0,
      shownAt: 0,
      answered: false,
      timers: [],
    };
    setTrials([]);
    setPeripheralDone(false);
    setPeripheralRunning(true);
    schedulePeripheralStep();
  }

  function respondPeripheral(quadrant: Quadrant) {
    const state = peripheralRef.current;
    if (!state || !peripheralRunning || state.answered || state.shownAt === 0) return;
    const current = state.plan[state.index];
    state.answered = true;
    const latency = performance.now() - state.shownAt;
    setTrials((prev) => [
      ...prev,
      { quadrant: current, responded: quadrant === current, latencyMs: latency },
    ]);
    state.index += 1;
    state.shownAt = 0;
    state.timers.forEach((timer) => window.clearTimeout(timer));
    state.timers = [];
    setFlash(null);
    schedulePeripheralStep();
  }

  const currentLine = lines[Math.min(lineIndex, lines.length - 1)];
  const bisectionDone = marks.length >= lines.length;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Vision AI</p>
        <h1>Visual Field and Neglect Explorer</h1>
        <p className="muted">{feature?.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity="lab" />
          <ModeBadge mode={mode === 'simulation' ? 'simulation' : apiConfigured ? 'live' : 'offline'} />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="neglect-about">
        <h2 className="section-title" id="neglect-about">
          How scoring works here
        </h2>
        <p>
          Three bedside tasks, scored exactly the way the paper versions are scored, with the
          rubric in the open: cancellation counts missed targets per side and per quadrant and
          finds the center of the found set; line bisection measures the signed distance between
          your mark and the true middle; peripheral awareness counts correct responses per
          quadrant and the median response time. The numbers describe this practice session on
          this screen. They are not a label about you.
        </p>
        <p className="muted">{feature?.limitations}</p>
        <div className="badge-row" role="group" aria-label="Explorer mode">
          <button
            type="button"
            className={mode === 'practice' ? 'btn btn-primary' : 'btn'}
            onClick={() => setMode('practice')}
          >
            Practice with your own responses
          </button>
          <button
            type="button"
            className={mode === 'simulation' ? 'btn btn-primary' : 'btn'}
            onClick={() => setMode('simulation')}
          >
            Simulated patient mode
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSeed((prev) => prev + 1);
              resetCancellation();
              setMarks([]);
              setLineIndex(0);
              setPendingMark(null);
              setTrials([]);
              setPeripheralDone(false);
            }}
          >
            New layout
          </button>
        </div>
        <div className="badge-row" role="group" aria-label="Task">
          <button
            type="button"
            className={task === 'cancellation' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTask('cancellation')}
          >
            Cancellation task
          </button>
          <button
            type="button"
            className={task === 'bisection' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTask('bisection')}
          >
            Line bisection
          </button>
          <button
            type="button"
            className={task === 'peripheral' ? 'btn btn-primary' : 'btn'}
            onClick={() => setTask('peripheral')}
          >
            Peripheral awareness
          </button>
        </div>
      </section>

      {task === 'cancellation' && (
        <section className="panel" aria-labelledby="neglect-cancel">
          <h2 className="section-title" id="neglect-cancel">
            Cancellation task
          </h2>
          {mode === 'simulation' ? (
            <>
              <p>
                Choose a programmed profile and inspect the response pattern it produces on the
                same field. This is how the pattern can look in a teaching example; it is
                generated by a fixed rule, not recorded from a person.
              </p>
              <div className="badge-row" role="group" aria-label="Simulated profile">
                {(Object.keys(PATIENT_PROFILE_LABELS) as PatientProfile[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={profile === key ? 'btn btn-primary' : 'btn'}
                    onClick={() => setProfile(key)}
                  >
                    {PATIENT_PROFILE_LABELS[key]}
                  </button>
                ))}
              </div>
              <FieldSvg
                items={items}
                foundIds={simulation.foundIds}
                showMissed
                path={[]}
              />
              <p>
                Pattern summary: missed {simulationScore.bySide.left.missed} of{' '}
                {simulationScore.bySide.left.total} targets on the left and{' '}
                {simulationScore.bySide.right.missed} of {simulationScore.bySide.right.total} on
                the right. Center of the found set:{' '}
                {simulationScore.centerOfCancellation.toFixed(2)} (0.50 would be balanced).
                Compare this map with your own practice map below in practice mode, and notice
                how the search strategy differs, not just the count.
              </p>
            </>
          ) : (
            <>
              <p>
                Tap or click every circle you can find. The squares are distractors; tapping one
                is counted as a false tap. Take your time, work in whatever order you like, and
                press Finish when you believe you have found them all.
              </p>
              <FieldSvg
                items={items}
                foundIds={foundIds}
                showMissed={cancelDone}
                path={cancelDone ? clickPath : []}
                onItemClick={handleItemClick}
              />
              <div className="badge-row">
                <span>
                  Found {foundIds.size} targets so far, {falseTaps} false taps.
                </span>
                {!cancelDone ? (
                  <button type="button" className="btn btn-primary" onClick={finishCancellation}>
                    Finish and score
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={resetCancellation}>
                    Try again
                  </button>
                )}
              </div>
              {cancelScore && (
                <div aria-live="polite">
                  <h3>Your session map</h3>
                  <p>
                    Found {cancelScore.foundTotal} of {cancelScore.targetTotal} targets in{' '}
                    {(cancelScore.elapsedMs / 1000).toFixed(1)} seconds. Missed on the left:{' '}
                    {cancelScore.bySide.left.missed} of {cancelScore.bySide.left.total}. Missed
                    on the right: {cancelScore.bySide.right.missed} of{' '}
                    {cancelScore.bySide.right.total}. Center of the found set:{' '}
                    {cancelScore.centerOfCancellation.toFixed(2)}. The dashed line on the field
                    is the order you searched in.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 6,
                      maxWidth: 460,
                    }}
                  >
                    {(
                      Object.entries(cancelScore.byQuadrant) as [
                        Quadrant,
                        { found: number; total: number },
                      ][]
                    ).map(([quadrant, score]) => (
                      <div
                        key={quadrant}
                        style={{
                          border: '1px solid #3a4353',
                          borderRadius: 8,
                          padding: '8px 10px',
                        }}
                      >
                        <div>{quadrant.replace('-', ' ')}</div>
                        <strong>
                          {score.found} of {score.total} found
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="muted">
                    A lopsided map in one practice session can come from screen size, posture,
                    attention, or fatigue. Clinicians interpret the real test together with the
                    rest of the examination, never from one map alone.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {task === 'bisection' && (
        <section className="panel" aria-labelledby="neglect-bisection">
          <h2 className="section-title" id="neglect-bisection">
            Line bisection
          </h2>
          <p>
            Click where you judge the exact middle of the line to be, then confirm. Deviation is
            reported as a percentage of half the line length: negative means your mark sat left
            of the true center, positive means right.
          </p>
          {!bisectionDone ? (
            <>
              <svg
                viewBox={`0 0 100 40`}
                style={{ width: '100%', background: '#f7f2df', borderRadius: 12, display: 'block' }}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  handleBisectionClick((event.clientX - rect.left) / rect.width);
                }}
                role="img"
                aria-label={`Line ${lineIndex + 1} of ${lines.length}: click its midpoint`}
              >
                <line
                  x1={currentLine.startX * 100}
                  y1={20}
                  x2={currentLine.endX * 100}
                  y2={20}
                  stroke="#37474f"
                  strokeWidth={0.9}
                />
                <line x1={currentLine.startX * 100} y1={16} x2={currentLine.startX * 100} y2={24} stroke="#37474f" strokeWidth={0.9} />
                <line x1={currentLine.endX * 100} y1={16} x2={currentLine.endX * 100} y2={24} stroke="#37474f" strokeWidth={0.9} />
                {pendingMark !== null && (
                  <line
                    x1={pendingMark * 100}
                    y1={13}
                    x2={pendingMark * 100}
                    y2={27}
                    stroke="#b3261e"
                    strokeWidth={0.8}
                  />
                )}
              </svg>
              <div className="badge-row">
                <span>
                  Line {lineIndex + 1} of {lines.length}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pendingMark === null}
                  onClick={confirmBisectionMark}
                >
                  Confirm mark
                </button>
              </div>
            </>
          ) : (
            <div aria-live="polite">
              <p>
                Mean signed deviation{' '}
                {bisectionScore !== null ? (bisectionScore.meanDeviation * 100).toFixed(1) : '0'}{' '}
                percent of the half length, mean absolute deviation{' '}
                {bisectionScore !== null
                  ? (bisectionScore.meanAbsoluteDeviation * 100).toFixed(1)
                  : '0'}{' '}
                percent. Per line:{' '}
                {bisectionScore?.deviations
                  .map((d) => `${(d * 100).toFixed(1)}%`)
                  .join(', ')}
                .
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setMarks([]);
                  setLineIndex(0);
                  setPendingMark(null);
                }}
              >
                Run the lines again
              </button>
            </div>
          )}
          <p className="muted">
            Small deviations are expected for everyone and vary with handedness and where the
            line sits on the screen. The teaching point is the direction and consistency of a
            pattern, never a single mark.
          </p>
        </section>
      )}

      {task === 'peripheral' && (
        <section className="panel" aria-labelledby="neglect-peripheral">
          <h2 className="section-title" id="neglect-peripheral">
            Peripheral awareness
          </h2>
          <p>
            Keep your eyes on the center cross. A dot flashes briefly in one quadrant; press the
            button for the quadrant where it appeared. There are 12 flashes. This is a reaction
            and attention exercise on a small screen, not a visual field measurement.
          </p>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 10',
              background: '#10151c',
              borderRadius: 12,
            }}
            aria-live="polite"
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                color: '#f2e7cb',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              +
            </div>
            {flash && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: '#ffd166',
                  left:
                    flash === 'upper-left' || flash === 'lower-left' ? '18%' : undefined,
                  right:
                    flash === 'upper-right' || flash === 'lower-right' ? '18%' : undefined,
                  top:
                    flash === 'upper-left' || flash === 'upper-right' ? '18%' : undefined,
                  bottom:
                    flash === 'lower-left' || flash === 'lower-right' ? '18%' : undefined,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 6,
              maxWidth: 460,
              marginTop: 10,
            }}
          >
            {(['upper-left', 'upper-right', 'lower-left', 'lower-right'] as Quadrant[]).map(
              (quadrant) => (
                <button
                  key={quadrant}
                  type="button"
                  className="btn"
                  disabled={!peripheralRunning}
                  onClick={() => respondPeripheral(quadrant)}
                >
                  {quadrant.replace('-', ' ')}
                </button>
              ),
            )}
          </div>
          <div className="badge-row" style={{ marginTop: 10 }}>
            {!peripheralRunning && !peripheralDone && (
              <button type="button" className="btn btn-primary" onClick={startPeripheral}>
                Start 12 flashes
              </button>
            )}
            {peripheralRunning && <span>Flashes answered: {trials.length} of 12</span>}
            {peripheralDone && (
              <button type="button" className="btn" onClick={startPeripheral}>
                Run again
              </button>
            )}
          </div>
          {peripheralDone && peripheralScore && (
            <div aria-live="polite">
              <p>
                Overall accuracy {pct(peripheralScore.overallAccuracy)}. Median response time{' '}
                {peripheralScore.medianLatencyMs !== null
                  ? `${Math.round(peripheralScore.medianLatencyMs)} ms`
                  : 'not available'}
                .
              </p>
              <ul>
                {(Object.entries(peripheralScore.byQuadrant) as [
                  Quadrant,
                  { shown: number; hits: number; accuracy: number },
                ][]).map(([quadrant, score]) => (
                  <li key={quadrant}>
                    {quadrant.replace('-', ' ')}: {score.hits} of {score.shown} correct (
                    {pct(score.accuracy)})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <UncertaintyNote>
        These three tasks teach what the bedside tests measure and how their scores are built.
        A screen is far smaller than a real visual field, and practice results shift with
        attention, fatigue, and device. Nothing here labels you with neglect or a field defect.
      </UncertaintyNote>

      <ToolCoach
        tool="gaze"
        moduleId="neglect-explorer"
        context="Visual Field and Neglect Explorer: cancellation, line bisection, and peripheral awareness tasks with deterministic scoring, plus a simulated patient mode with programmed response profiles."
        fallback="This explorer digitizes three bedside tasks. Cancellation counts missed targets per side and quadrant and locates the center of the found set. Line bisection reports the signed deviation of your midpoint mark. Peripheral awareness counts correct quadrant responses and median latency. Scores are transparent counts from a fixed rubric, shown next to the task. A simulated patient mode generates programmed response patterns for teaching, so a pattern can be studied without being measured from a person. No result here is labeled as neglect or a visual field defect."
      />
    </div>
  );
}
