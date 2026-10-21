import { useEffect, useRef, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import { UncertaintyNote } from '../../components/ui';
import {
  compareTapping,
  computeTappingMetrics,
  syntheticTapTimes,
  type TappingHand,
  type TappingMetrics,
} from './tappingMetrics';
import { roundTo } from './synthetic';

const TEST_MS = 15000;
const TICK_MS = 100;

interface HandResult {
  metrics: TappingMetrics;
  source: 'you' | 'synthetic';
}

type Results = Partial<Record<TappingHand, HandResult>>;

function handLabel(hand: TappingHand): string {
  return hand === 'left' ? 'Left hand' : 'Right hand';
}

function IntervalBars({ intervals }: { intervals: number[] }) {
  const shown = intervals.slice(-28);
  const max = Math.max(600, ...shown);
  return (
    <div
      aria-hidden="true"
      style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 54, marginTop: 8 }}
    >
      {shown.map((interval, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: `${Math.max(6, (interval / max) * 54)}px`,
            background: interval > 600 ? '#b3541e' : '#126454',
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

function HandMetrics({ hand, result }: { hand: TappingHand; result: HandResult }) {
  const m = result.metrics;
  return (
    <div>
      <h4>
        {handLabel(hand)} {result.source === 'synthetic' ? '(synthetic example)' : '(your recording)'}
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <tbody>
            <tr>
              <th scope="row">Taps counted</th>
              <td>{m.tapCount}</td>
            </tr>
            <tr>
              <th scope="row">Rate</th>
              <td>{roundTo(m.frequencyHz, 2)} taps per s</td>
            </tr>
            <tr>
              <th scope="row">Average interval</th>
              <td>{roundTo(m.meanIntervalMs, 0)} ms</td>
            </tr>
            <tr>
              <th scope="row">Rhythm variation</th>
              <td>{roundTo(m.intervalCv * 100, 1)} % spread around the average interval</td>
            </tr>
            <tr>
              <th scope="row">First half rate</th>
              <td>{roundTo(m.firstHalfHz, 2)} taps per s</td>
            </tr>
            <tr>
              <th scope="row">Second half rate</th>
              <td>{roundTo(m.secondHalfHz, 2)} taps per s</td>
            </tr>
            <tr>
              <th scope="row">Change between halves</th>
              <td>
                {m.fatigueChangePct === 0
                  ? 'No change'
                  : `${roundTo(m.fatigueChangePct, 1)} % (${m.fatigueChangePct < 0 ? 'slower second half' : 'faster second half'})`}
              </td>
            </tr>
            <tr>
              <th scope="row">Hesitation pauses</th>
              <td>
                {m.hesitationPauses} (longest pause {roundTo(m.longestPauseMs, 0)} ms)
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <IntervalBars intervals={m.intervalsMs} />
      <details>
        <summary>Audit every interval ({m.intervalsMs.length})</summary>
        <p className="muted">
          Milliseconds between consecutive taps, in order. Long bars in the chart above match the
          long numbers here, so any count can be checked by hand.
        </p>
        <p>{m.intervalsMs.map((value) => roundTo(value, 0)).join(', ')}</p>
      </details>
    </div>
  );
}

export default function FingerTappingLab() {
  const feature = getFeature('finger-tapping');
  const [results, setResults] = useState<Results>({});
  const [activeHand, setActiveHand] = useState<TappingHand | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [liveIntervals, setLiveIntervals] = useState<number[]>([]);
  const tapTimesRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const activeRef = useRef<TappingHand | null>(null);
  activeRef.current = activeHand;

  useEffect(() => {
    if (!activeHand) return;
    const interval = window.setInterval(() => {
      setElapsedMs(Math.min(TEST_MS, performance.now() - startRef.current));
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [activeHand]);

  useEffect(() => {
    if (activeHand && elapsedMs >= TEST_MS) {
      finishHand(activeHand);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedMs, activeHand]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space' && activeRef.current && !event.repeat) {
        event.preventDefault();
        registerTap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startHand(hand: TappingHand) {
    tapTimesRef.current = [];
    setLiveIntervals([]);
    setElapsedMs(0);
    startRef.current = performance.now();
    setActiveHand(hand);
  }

  function registerTap() {
    if (!activeRef.current) return;
    const now = performance.now() - startRef.current;
    if (now > TEST_MS) return;
    const times = tapTimesRef.current;
    const previous = times[times.length - 1];
    times.push(now);
    if (previous !== undefined) {
      setLiveIntervals((values) => [...values.slice(-27), now - previous]);
    }
  }

  function finishHand(hand: TappingHand) {
    const metrics = computeTappingMetrics(tapTimesRef.current, TEST_MS);
    setResults((current) => ({ ...current, [hand]: { metrics, source: 'you' } }));
    setActiveHand(null);
    setElapsedMs(0);
    setLiveIntervals([]);
  }

  function runSynthetic(hand: TappingHand) {
    const taps = syntheticTapTimes({
      durationMs: TEST_MS,
      startHz: hand === 'left' ? 3.6 : 4.4,
      endHz: hand === 'left' ? 2.9 : 4.1,
      jitterCv: 0.09,
      hesitationCount: 1,
      seed: hand === 'left' ? 31 : 47,
    });
    const metrics = computeTappingMetrics(taps, TEST_MS);
    setResults((current) => ({ ...current, [hand]: { metrics, source: 'synthetic' } }));
  }

  const comparison =
    results.left && results.right ? compareTapping(results.left.metrics, results.right.metrics) : null;
  const remainingSec = Math.max(0, Math.ceil((TEST_MS - elapsedMs) / 1000));
  const liveCount = tapTimesRef.current.length;

  return (
    <section className="panel" aria-labelledby="finger-tapping-title">
      <h2 className="section-title" id="finger-tapping-title">
        Practice workspace: 15 seconds of tapping per hand
      </h2>
      <p>
        Tap the pad, click, or press the space bar as steadily as you can for 15 seconds, one hand
        at a time. The tool reports speed, rhythm, and how the second half compares with the
        first. It is a practice measurement only: there is no comparison table for these numbers,
        and a slower recording can come from joint pain, tiredness, arthritis, an unfamiliar
        input device, or the device frame rate.
      </p>

      <div className="badge-row" role="group" aria-label="Choose a hand">
        {(['left', 'right'] as TappingHand[]).map((hand) => (
          <button
            key={hand}
            type="button"
            className="btn btn-primary"
            onClick={() => startHand(hand)}
            disabled={activeHand !== null}
          >
            Start {handLabel(hand).toLowerCase()} (15 s)
          </button>
        ))}
        {(['left', 'right'] as TappingHand[]).map((hand) => (
          <button
            key={`synthetic-${hand}`}
            type="button"
            className="btn btn-ghost"
            onClick={() => runSynthetic(hand)}
            disabled={activeHand !== null}
          >
            Synthetic example: {handLabel(hand).toLowerCase()}
          </button>
        ))}
      </div>

      {activeHand && (
        <div>
          <p aria-live="polite">
            {handLabel(activeHand)} recording: {remainingSec} s left, {liveCount} taps so far.
            Keep one steady rhythm.
          </p>
          <div
            role="button"
            tabIndex={0}
            aria-label={`Tap pad for the ${activeHand} hand. Press, click, or use the space bar.`}
            onPointerDown={(event) => {
              event.preventDefault();
              registerTap();
            }}
            style={{
              height: 180,
              border: '2px solid #153e34',
              borderRadius: 8,
              background: '#eef4f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 700,
              touchAction: 'none',
              userSelect: 'none',
              cursor: 'pointer',
            }}
          >
            TAP HERE
          </div>
          <IntervalBars intervals={liveIntervals} />
          <p className="muted">
            Bars show the gap between taps. Even spacing means a steady rhythm; a tall orange bar
            is a long pause.
          </p>
        </div>
      )}

      {!activeHand && Object.keys(results).length === 0 && (
        <p className="muted">
          No recording yet. Run one hand, or load a synthetic example to see the shape of a result
          first. Synthetic examples are generated numbers, clearly labelled, never mixed with your
          recordings.
        </p>
      )}

      {(['left', 'right'] as TappingHand[]).map(
        (hand) =>
          results[hand] && (
            <HandMetrics key={hand} hand={hand} result={results[hand] as HandResult} />
          ),
      )}

      {comparison && (
        <div>
          <h3>Side by side</h3>
          <p>
            {comparison.fasterHand === 'similar'
              ? `Both hands tapped at a similar rate in these recordings; the rate difference was ${roundTo(Math.abs(comparison.frequencyAsymmetryPct), 1)} % of the average rate.`
              : `In these recordings, the ${comparison.fasterHand} hand tapped faster; the rate difference was ${roundTo(Math.abs(comparison.frequencyAsymmetryPct), 1)} % of the average rate, with ${comparison.tapCountDifference} more taps counted on one side.`}{' '}
            This compares your two recordings with each other only. It does not compare you with
            anyone else, and it is not a score.
          </p>
          <UncertaintyNote>
            Practice measurement only, from single 15 second recordings on this device.{' '}
            {feature?.limitations ?? ''}
          </UncertaintyNote>
        </div>
      )}
    </section>
  );
}
