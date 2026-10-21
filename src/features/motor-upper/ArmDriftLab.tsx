import { useEffect, useRef, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import { UncertaintyNote } from '../../components/ui';
import {
  compareDrift,
  computeSideDriftMetrics,
  syntheticDriftSeries,
  type DriftComparison,
  type DriftScenario,
  type DriftSeries,
  type DriftSide,
} from './driftMetrics';
import { roundTo } from './synthetic';

const SESSION_MS = 10000;
const COUNTDOWN_MS = 3000;
const TICK_MS = 100;
const POINTER_RATE_HZ = 1000 / TICK_MS;

type Mode = 'simulation' | 'pointer';
type Phase = 'setup' | 'countdown' | 'running' | 'done';

const SCENARIOS: { id: DriftScenario; label: string }[] = [
  { id: 'steady', label: 'Steady hold on both sides' },
  { id: 'left-drift', label: 'Left side gradually lowers' },
  { id: 'right-drift', label: 'Right side gradually lowers' },
  { id: 'both-drift', label: 'Both sides gradually lower' },
];

/** Split a series into drawable segments, breaking the line at gaps. */
function segmentsOf(series: (number | null)[]): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  series.forEach((value, index) => {
    if (value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ x: index, y: value });
    }
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

/** Rolling min and max envelope over a window, for the variability band. */
function envelopeOf(series: (number | null)[], windowTicks: number): { x: number; hi: number; lo: number }[] {
  const points: { x: number; hi: number; lo: number }[] = [];
  for (let i = 0; i < series.length; i += 2) {
    const values: number[] = [];
    for (let j = Math.max(0, i - windowTicks); j <= Math.min(series.length - 1, i + windowTicks); j += 1) {
      const value = series[j];
      if (value !== null) values.push(value);
    }
    if (values.length > 0) {
      points.push({ x: i, hi: Math.max(...values), lo: Math.min(...values) });
    }
  }
  return points;
}

function DriftChart({ series, revealed }: { series: DriftSeries; revealed: number }) {
  const width = 640;
  const height = 230;
  const top = 10;
  const bottom = height - 24;
  const minDeg = 35;
  const maxDeg = 100;
  const totalTicks = Math.max(series.left.length, 1);
  const shown = Math.min(revealed, totalTicks);
  const x = (tick: number) => (tick / totalTicks) * (width - 16) + 8;
  const y = (deg: number) =>
    bottom - ((Math.max(minDeg, Math.min(maxDeg, deg)) - minDeg) / (maxDeg - minDeg)) * (bottom - top);

  const renderSide = (values: (number | null)[], color: string) => {
    const sliced = values.slice(0, shown);
    const band = envelopeOf(sliced, Math.round(series.sampleRateHz));
    const bandPath =
      band.length > 1
        ? `M ${band.map((p) => `${x(p.x)},${y(p.hi)}`).join(' L ')} L ${band
            .slice()
            .reverse()
            .map((p) => `${x(p.x)},${y(p.lo)}`)
            .join(' L ')} Z`
        : '';
    return (
      <g>
        {bandPath && <path d={bandPath} fill={color} opacity={0.13} stroke="none" />}
        {segmentsOf(sliced).map((segment, i) => (
          <polyline
            key={i}
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            points={segment.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')}
          />
        ))}
      </g>
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Chart of arm elevation over the 10 second hold. Gaps in a line mean tracking data was missing for those moments."
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {[90, 70, 50].map((deg) => (
        <g key={deg}>
          <line x1={8} x2={width - 8} y1={y(deg)} y2={y(deg)} stroke="#c9d4cd" strokeWidth={1} />
          <text x={10} y={y(deg) - 4} fontSize={11} fill="#5a6a60">
            {deg} deg
          </text>
        </g>
      ))}
      {renderSide(series.left, '#126454')}
      {renderSide(series.right, '#b3541e')}
      <text x={width - 150} y={20} fontSize={12} fill="#126454">
        Left side
      </text>
      <text x={width - 150} y={38} fontSize={12} fill="#b3541e">
        Right side
      </text>
      <text x={8} y={height - 6} fontSize={11} fill="#5a6a60">
        0 s
      </text>
      <text x={width - 34} y={height - 6} fontSize={11} fill="#5a6a60">
        10 s
      </text>
    </svg>
  );
}

function ArmFigure({ leftDeg, rightDeg }: { leftDeg: number; rightDeg: number }) {
  const shoulderY = 92;
  const armLength = 74;
  const arm = (shoulderX: number, elevation: number, direction: 1 | -1) => {
    const tilt = ((90 - elevation) * Math.PI) / 180;
    return {
      x: shoulderX + direction * Math.cos(tilt) * armLength,
      y: shoulderY + Math.sin(tilt) * armLength,
    };
  };
  const leftHand = arm(118, leftDeg, -1);
  const rightHand = arm(162, rightDeg, 1);
  return (
    <svg
      viewBox="0 0 280 210"
      role="img"
      aria-label="Schematic figure whose arms follow the measured elevation angles."
      style={{ width: '100%', maxWidth: 280, height: 'auto', display: 'block', margin: '0 auto' }}
    >
      <circle cx={140} cy={42} r={17} fill="none" stroke="#153e34" strokeWidth={3} />
      <line x1={140} y1={59} x2={140} y2={140} stroke="#153e34" strokeWidth={3} />
      <line x1={118} y1={shoulderY} x2={leftHand.x} y2={leftHand.y} stroke="#126454" strokeWidth={5} strokeLinecap="round" />
      <line x1={162} y1={shoulderY} x2={rightHand.x} y2={rightHand.y} stroke="#b3541e" strokeWidth={5} strokeLinecap="round" />
      <line x1={140} y1={140} x2={118} y2={196} stroke="#153e34" strokeWidth={3} />
      <line x1={140} y1={140} x2={162} y2={196} stroke="#153e34" strokeWidth={3} />
      <line x1={30} x2={250} y1={shoulderY} y2={shoulderY} stroke="#c9d4cd" strokeDasharray="4 4" />
    </svg>
  );
}

function MetricsTable({ comparison }: { comparison: DriftComparison }) {
  const rows: { label: string; format: (m: DriftComparison['left']) => string }[] = [
    { label: 'Starting angle', format: (m) => `${roundTo(m.baselineDeg, 1)} deg` },
    { label: 'Ending angle', format: (m) => `${roundTo(m.endDeg, 1)} deg` },
    { label: 'Lowering over the hold', format: (m) => `${roundTo(m.driftDeg, 1)} deg` },
    { label: 'Lowering speed', format: (m) => `${roundTo(m.driftRateDegPerSec, 2)} deg per s` },
    { label: 'Largest single drop', format: (m) => `${roundTo(m.maxDropDeg, 1)} deg` },
    {
      label: 'Time until a 10 degree drop',
      format: (m) => (m.timeToDropSec === null ? 'Not reached in 10 s' : `${roundTo(m.timeToDropSec, 1)} s`),
    },
    { label: 'Usable samples', format: (m) => `${roundTo(m.validPercent, 0)} %` },
    { label: 'Average sideways offset', format: (m) => `${roundTo(m.meanAbsLateral, 2)} shoulder widths` },
  ];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Left side</th>
            <th scope="col">Right side</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.format(comparison.left)}</td>
              <td>{row.format(comparison.right)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ArmDriftLab() {
  const feature = getFeature('arm-drift');
  const [mode, setMode] = useState<Mode>('simulation');
  const [scenario, setScenario] = useState<DriftScenario>('left-drift');
  const [phase, setPhase] = useState<Phase>('setup');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [series, setSeries] = useState<DriftSeries | null>(null);
  const [pointerSide, setPointerSide] = useState<DriftSide>('left');
  const [pointerDone, setPointerDone] = useState<Partial<Record<DriftSide, DriftSeries>>>({});

  const pointerRef = useRef<{ x: number; y: number; down: boolean; freshAt: number } | null>(null);
  const samplesRef = useRef<{ angles: (number | null)[]; lateral: (number | null)[] }>({
    angles: [],
    lateral: [],
  });
  const phaseRef = useRef<Phase>('setup');
  phaseRef.current = phase;

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') return;
    const interval = window.setInterval(() => {
      setElapsedMs((value) => value + TICK_MS);
      if (phaseRef.current === 'running' && mode === 'pointer') {
        const pointer = pointerRef.current;
        const fresh = pointer && pointer.down && performance.now() - pointer.freshAt < 400;
        if (fresh) {
          samplesRef.current.angles.push(100 - pointer.y * 45);
          samplesRef.current.lateral.push((pointer.x - 0.5) * 2);
        } else {
          samplesRef.current.angles.push(null);
          samplesRef.current.lateral.push(null);
        }
      }
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [phase, mode]);

  useEffect(() => {
    if (phase === 'countdown' && elapsedMs >= COUNTDOWN_MS) {
      setElapsedMs(0);
      setPhase('running');
    } else if (phase === 'running' && elapsedMs >= SESSION_MS) {
      finishRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, phase]);

  function startRun() {
    setElapsedMs(0);
    samplesRef.current = { angles: [], lateral: [] };
    pointerRef.current = null;
    if (mode === 'simulation') {
      setSeries(syntheticDriftSeries(scenario, Math.floor(Math.random() * 100000)));
    }
    setPhase('countdown');
  }

  function finishRun() {
    if (mode === 'pointer') {
      const recorded: DriftSeries = {
        sampleRateHz: POINTER_RATE_HZ,
        left: pointerSide === 'left' ? samplesRef.current.angles : [],
        right: pointerSide === 'right' ? samplesRef.current.angles : [],
        leftLateral: pointerSide === 'left' ? samplesRef.current.lateral : [],
        rightLateral: pointerSide === 'right' ? samplesRef.current.lateral : [],
      };
      const merged: Partial<Record<DriftSide, DriftSeries>> = { ...pointerDone, [pointerSide]: recorded };
      setPointerDone(merged);
      if (pointerSide === 'left') {
        setPointerSide('right');
        setPhase('setup');
        setElapsedMs(0);
        return;
      }
      const leftSeries = merged.left;
      const rightSeries = merged.right;
      if (leftSeries && rightSeries) {
        setSeries({
          sampleRateHz: POINTER_RATE_HZ,
          left: leftSeries.left,
          right: rightSeries.right,
          leftLateral: leftSeries.leftLateral,
          rightLateral: rightSeries.rightLateral,
        });
      }
    }
    setPhase('done');
  }

  function resetAll() {
    setPhase('setup');
    setElapsedMs(0);
    setSeries(null);
    setPointerSide('left');
    setPointerDone({});
  }

  const comparison = series && phase === 'done' ? compareDrift(series) : null;
  const revealedTicks =
    series === null
      ? 0
      : phase === 'running'
        ? Math.floor((elapsedMs / 1000) * series.sampleRateHz)
        : series.left.length;
  const currentLeft =
    series && phase === 'running'
      ? (series.left[Math.min(revealedTicks, series.left.length - 1)] ?? 90)
      : 90;
  const currentRight =
    series && phase === 'running'
      ? (series.right[Math.min(revealedTicks, series.right.length - 1)] ?? 90)
      : 90;
  const remainingSec = Math.max(0, Math.ceil((SESSION_MS - elapsedMs) / 1000));

  const onPadPointer = (event: React.PointerEvent<HTMLDivElement>, down: boolean) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
      down,
      freshAt: performance.now(),
    };
  };

  return (
    <section className="panel" aria-labelledby="arm-drift-title">
      <h2 className="section-title" id="arm-drift-title">
        Practice workspace: measure a 10 second hold
      </h2>
      <p>
        This workspace measures how a held position changes over 10 seconds and reports the
        movement as angles and curves. It is a practice measurement only. It does not measure
        strength, it does not produce any clinical score, and a recording with little movement
        cannot rule out stroke or any other condition.
      </p>

      <div className="badge-row" role="group" aria-label="Input mode">
        <button
          type="button"
          className={mode === 'simulation' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => {
            setMode('simulation');
            resetAll();
          }}
          disabled={phase === 'countdown' || phase === 'running'}
        >
          Simulated arms
        </button>
        <button
          type="button"
          className={mode === 'pointer' ? 'btn btn-primary' : 'btn btn-ghost'}
          onClick={() => {
            setMode('pointer');
            resetAll();
          }}
          disabled={phase === 'countdown' || phase === 'running'}
        >
          Pointer hold practice
        </button>
      </div>

      {mode === 'simulation' && phase === 'setup' && (
        <div>
          <label htmlFor="drift-scenario">Scripted movement for the simulation</label>
          <select
            id="drift-scenario"
            className="form-input"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as DriftScenario)}
          >
            {SCENARIOS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="muted">
            The simulation plays a scripted pair of arms so you can learn what the measurement
            reports. The script describes movement only; it is not an example of any medical state.
          </p>
        </div>
      )}

      {mode === 'pointer' && phase === 'setup' && (
        <p className="muted">
          Pointer practice measures one side at a time. You press and hold inside the pad below,
          trying to keep the pointer in the target band. The tool records how the pointer position
          changes, which is a stand-in for practicing the measurement on this device, not a
          recording of your arm. {pointerSide === 'right' ? 'Left side recorded. Now the right side.' : 'First side: left.'}
        </p>
      )}

      {(phase === 'setup' || phase === 'done') && (
        <button type="button" className="btn btn-primary" onClick={phase === 'done' ? resetAll : startRun}>
          {phase === 'done'
            ? 'Run another session'
            : mode === 'pointer'
              ? `Start 10 second hold (${pointerSide} side)`
              : 'Start 10 second hold'}
        </button>
      )}

      {phase === 'countdown' && (
        <p aria-live="polite" style={{ fontSize: 28, fontWeight: 700 }}>
          Get ready: {Math.ceil((COUNTDOWN_MS - elapsedMs) / 1000)}
        </p>
      )}

      {phase === 'running' && mode === 'simulation' && series && (
        <div>
          <p aria-live="polite">
            Holding: {remainingSec} s left. Keep both arms raised at shoulder height.
          </p>
          <ArmFigure leftDeg={currentLeft} rightDeg={currentRight} />
          <DriftChart series={series} revealed={revealedTicks} />
        </div>
      )}

      {phase === 'running' && mode === 'pointer' && (
        <div>
          <p aria-live="polite">
            Holding the {pointerSide} side: {remainingSec} s left. Press and hold inside the pad,
            keeping the marker in the shaded band.
          </p>
          <div
            role="application"
            aria-label={`Pointer hold pad for the ${pointerSide} side`}
            onPointerDown={(event) => onPadPointer(event, true)}
            onPointerMove={(event) => {
              if (pointerRef.current?.down) onPadPointer(event, true);
            }}
            onPointerUp={() => {
              if (pointerRef.current) pointerRef.current.down = false;
            }}
            onPointerLeave={() => {
              pointerRef.current = null;
            }}
            style={{
              position: 'relative',
              height: 240,
              border: '2px solid #153e34',
              borderRadius: 8,
              touchAction: 'none',
              background: 'linear-gradient(to bottom, #eef4f0 0 38%, #d7e8dd 38% 62%, #eef4f0 62% 100%)',
            }}
          >
            <span className="muted" style={{ position: 'absolute', left: 10, top: 8 }}>
              Target band in the middle. Releasing the press is recorded as a gap.
            </span>
            <SampleCount samples={samplesRef.current.angles.length} />
          </div>
        </div>
      )}

      {phase === 'done' && series && comparison && (
        <div>
          <h3>What this recording showed</h3>
          <DriftChart series={series} revealed={series.left.length} />
          <MetricsTable comparison={comparison} />
          <p>
            {comparison.largerDriftSide === 'similar'
              ? `Both sides lowered by a similar amount in this recording; the difference was ${roundTo(comparison.driftDifferenceDeg, 1)} degrees.`
              : `In this recording, the ${comparison.largerDriftSide} side lowered ${roundTo(comparison.driftDifferenceDeg, 1)} degrees more than the other side.`}{' '}
            Breaks in the chart lines mark moments with no tracking data; those moments were left
            empty rather than filled in.
          </p>
          {(comparison.left.validPercent < 70 || comparison.right.validPercent < 70) && (
            <p className="muted" role="note">
              A large share of one side has no tracking data, so its numbers rest on few samples.
              Treat them as a rough description of the recording, not a precise measurement.
            </p>
          )}
          <UncertaintyNote>
            Practice measurement only, from a single short recording on this device. Camera and
            pointer tracking cannot reliably show forearm rotation, so rotation is not reported
            here. {feature?.limitations ?? ''}
          </UncertaintyNote>
        </div>
      )}
    </section>
  );
}

function SampleCount({ samples }: { samples: number }) {
  return (
    <span className="muted" style={{ position: 'absolute', right: 10, bottom: 8 }}>
      Samples recorded: {samples}
    </span>
  );
}

export function armDriftPointerMetrics(
  series: DriftSeries,
  side: DriftSide,
): ReturnType<typeof computeSideDriftMetrics> {
  return computeSideDriftMetrics(
    side === 'left' ? series.left : series.right,
    side === 'left' ? series.leftLateral : series.rightLateral,
    series.sampleRateHz,
    side,
  );
}
