// Small visual building blocks shared by the FAST Live Check stages,
// the closing observation sheet, and the worked example: the two-side
// movement bars, the arm angle chart, and the speech word map. Keeping
// one implementation means the example, the live view, and the result
// all draw the same picture the same way.

import type { ArmPoint, FastWordEntry } from './types';

// ---------------------------------------------------------------------------
// Movement bars (face tasks)
// ---------------------------------------------------------------------------

export function MovementBars({
  left,
  right,
  leftLabel = 'Left side of your face',
  rightLabel = 'Right side of your face',
}: {
  left: number;
  right: number;
  leftLabel?: string;
  rightLabel?: string;
}) {
  const rows = [
    { label: leftLabel, value: left },
    { label: rightLabel, value: right },
  ];
  return (
    <div className="fast-bars">
      {rows.map((row) => (
        <div className="fast-bar-row" key={row.label}>
          <span className="fast-bar-label">{row.label}</span>
          <span className="fast-bar-track">
            <span
              className="fast-bar-fill"
              style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
            />
          </span>
          <span className="fast-bar-value">{Math.round(row.value)}</span>
        </div>
      ))}
      <p className="fast-axis-note">relative movement detected</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arm angle chart
// ---------------------------------------------------------------------------

const CHART_W = 320;
const CHART_H = 150;
const MAX_DEG = 140;

function seriesPoints(series: ArmPoint[], holdSeconds: number): string {
  return series
    .map((point) => {
      const x = (point.t / holdSeconds) * (CHART_W - 16) + 8;
      const y = CHART_H - 18 - (Math.max(0, Math.min(MAX_DEG, point.deg)) / MAX_DEG) * (CHART_H - 34);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ArmChart({
  leftSeries,
  rightSeries,
  holdSeconds = 10,
  leftStartDeg,
  rightStartDeg,
}: {
  leftSeries: ArmPoint[];
  rightSeries: ArmPoint[];
  holdSeconds?: number;
  leftStartDeg?: number;
  rightStartDeg?: number;
}) {
  const referenceY = (deg: number) =>
    CHART_H - 18 - (Math.max(0, Math.min(MAX_DEG, deg)) / MAX_DEG) * (CHART_H - 34);
  return (
    <figure className="fast-chart">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        role="img"
        aria-label="Chart of each arm angle in the camera picture over the hold"
        className="fast-chart-svg"
      >
        {leftStartDeg !== undefined ? (
          <line
            x1="8"
            x2={CHART_W - 8}
            y1={referenceY(leftStartDeg)}
            y2={referenceY(leftStartDeg)}
            className="fast-chart-ref fast-chart-ref-left"
          />
        ) : null}
        {rightStartDeg !== undefined ? (
          <line
            x1="8"
            x2={CHART_W - 8}
            y1={referenceY(rightStartDeg)}
            y2={referenceY(rightStartDeg)}
            className="fast-chart-ref fast-chart-ref-right"
          />
        ) : null}
        {leftSeries.length > 1 ? (
          <polyline points={seriesPoints(leftSeries, holdSeconds)} className="fast-chart-line fast-chart-left" />
        ) : null}
        {rightSeries.length > 1 ? (
          <polyline points={seriesPoints(rightSeries, holdSeconds)} className="fast-chart-line fast-chart-right" />
        ) : null}
      </svg>
      <figcaption className="fast-chart-caption">
        <span className="fast-chart-key fast-chart-key-left">Left arm</span>
        <span className="fast-chart-key fast-chart-key-right">Right arm</span>
        <span className="muted">angle in the camera picture, degrees</span>
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Speech word map
// ---------------------------------------------------------------------------

export function WordMapView({ entries }: { entries: FastWordEntry[] }) {
  const targetEntries = entries.filter((entry) => entry.target !== null);
  return (
    <p className="fast-wordmap" aria-label="Word by word comparison">
      {targetEntries.map((entry, index) => {
        if (entry.status === 'written') {
          return (
            <span key={index} className="fast-word fast-word-heard">
              {entry.target}
            </span>
          );
        }
        if (entry.status === 'differently') {
          return (
            <span key={index} className="fast-word fast-word-different">
              <span>{entry.target}</span>
              <span className="fast-word-heard-as">heard as &ldquo;{entry.heard}&rdquo;</span>
            </span>
          );
        }
        return (
          <span key={index} className="fast-word fast-word-missed">
            {entry.target}
          </span>
        );
      })}
    </p>
  );
}
