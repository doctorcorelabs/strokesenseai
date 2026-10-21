import { useEffect, useRef, useState } from 'react';
import { UncertaintyNote } from '../../components/ui';
import {
  QUADRANTS,
  buildTrialPlan,
  eyeTotals,
  mulberry32,
  quadrantLabel,
  stimulusPointFor,
  summarizeVisionTrials,
} from './vision-logic';
import type { EyeSide, Quadrant, StimulusPoint, VisionTrial } from './vision-logic';

// FAST Vision Check (feature id: fast-vision-check, route #lab/fast-vision-check).
//
// A guided practice check of what a person notices around a fixation point.
// One eye is tested at a time while the other is covered. Brief dots appear
// in one of four screen areas; the person taps as soon as they notice a dot.
// The result is a per-area map of noticed and missed dots for this session.
//
// This is not a visual field examination and produces no combined score.
// A missed dot can mean distraction, a slow tap, screen glare, or many other
// things, and noticing every dot here cannot rule out a vision problem.

const TRIALS_PER_QUADRANT = 3;
const STIMULUS_MS = 900;
const GAP_MS = 550;

type Phase = 'intro' | 'cover' | 'running' | 'eye-done' | 'done';

const EYE_LABEL: Record<EyeSide, string> = { left: 'left eye', right: 'right eye' };
const OTHER_EYE: Record<EyeSide, EyeSide> = { left: 'right', right: 'left' };

interface ActiveStimulus {
  quadrant: Quadrant;
  point: StimulusPoint;
}

export default function FastVisionCheck() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [eye, setEye] = useState<EyeSide>('left');
  const [testedEyes, setTestedEyes] = useState<EyeSide[]>([]);
  const [trials, setTrials] = useState<VisionTrial[]>([]);
  const [trialIndex, setTrialIndex] = useState(0);
  const [stimulusOn, setStimulusOn] = useState(false);
  const [strayTaps, setStrayTaps] = useState(0);

  const seedRef = useRef(Math.floor(Math.random() * 1_000_000));
  const stimulusRef = useRef<ActiveStimulus | null>(null);
  const answeredRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const plan = buildTrialPlan(TRIALS_PER_QUADRANT, seedRef.current + (eye === 'right' ? 7919 : 0));

  const clearTimers = () => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
  };

  const finishEye = (collected: VisionTrial[]) => {
    setTrials(collected);
    setTestedEyes((previous) => (previous.includes(eye) ? previous : [...previous, eye]));
    setPhase('eye-done');
  };

  const finishTrial = (seen: boolean) => {
    const active = stimulusRef.current;
    if (!active) return;
    setStimulusOn(false);
    const collected: VisionTrial[] = [
      ...trials,
      { eye, quadrant: active.quadrant, seen },
    ];
    if (trialIndex + 1 >= plan.length) {
      finishEye(collected);
      return;
    }
    setTrials(collected);
    const timer = window.setTimeout(() => setTrialIndex(trialIndex + 1), GAP_MS);
    timersRef.current.push(timer);
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const quadrant = plan[trialIndex];
    const rng = mulberry32(seedRef.current + trialIndex * 131 + (eye === 'right' ? 7919 : 0));
    stimulusRef.current = { quadrant, point: stimulusPointFor(quadrant, rng) };
    answeredRef.current = false;
    setStimulusOn(true);
    const timer = window.setTimeout(() => {
      if (!answeredRef.current) {
        answeredRef.current = true;
        finishTrial(false);
      }
    }, STIMULUS_MS);
    timersRef.current.push(timer);
    return () => window.clearTimeout(timer);
    // finishTrial is re-created per render; the effect intentionally keys
    // on the trial position only, and the timeout reads refs for state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, trialIndex, eye]);

  useEffect(() => () => clearTimers(), []);

  const beginEye = (which: EyeSide) => {
    clearTimers();
    setEye(which);
    setTrialIndex(0);
    setStimulusOn(false);
    setPhase('cover');
  };

  const handleTap = () => {
    if (phase !== 'running') return;
    if (stimulusOn && !answeredRef.current) {
      answeredRef.current = true;
      finishTrial(true);
    } else if (!stimulusOn) {
      setStrayTaps((previous) => previous + 1);
    }
  };

  const summary = summarizeVisionTrials(trials);
  const active = stimulusRef.current;
  const otherEye = OTHER_EYE[eye];
  const otherTested = testedEyes.includes(otherEye);

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="vision-intro-title">
        <h2 className="section-title" id="vision-intro-title">
          How this check works
        </h2>
        <ol className="step-list">
          <li>
            <strong>One eye at a time.</strong> You test one eye while gently covering the other
            with your palm. Do not press on the covered eye.
          </li>
          <li>
            <strong>Hold the device at arm&apos;s length</strong> and keep looking at the cross
            in the center of the test area. Try not to move your eyes toward the dots.
          </li>
          <li>
            <strong>Tap the moment you notice a dot</strong> anywhere in the test area, using the
            large button or the area itself. Each dot stays for less than a second.
          </li>
          <li>
            <strong>The result is a map, not a score.</strong> You will see, per eye and per area
            of the screen, how many dots were shown and how many you noticed in time.
          </li>
        </ol>
        <p className="muted">
          Sit somewhere without glare on the screen. If you wear glasses for distance, keep them
          on. You can stop at any time; stopping simply ends the recording.
        </p>
      </section>

      {phase === 'intro' && (
        <section className="panel" aria-labelledby="vision-start-title">
          <h2 className="section-title" id="vision-start-title">
            Choose the eye to test first
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={() => beginEye('left')}>
              Start with my left eye
            </button>
            <button type="button" className="btn btn-primary" onClick={() => beginEye('right')}>
              Start with my right eye
            </button>
          </div>
        </section>
      )}

      {phase === 'cover' && (
        <section className="panel" aria-labelledby="vision-cover-title">
          <h2 className="section-title" id="vision-cover-title">
            Cover your {EYE_LABEL[otherEye]}
          </h2>
          <p>
            Cover your {EYE_LABEL[otherEye]} gently with your palm so it sees nothing, and keep
            it covered for the whole round. Look at the center cross with your {EYE_LABEL[eye]}.
            There are {plan.length} dots in this round. Press start when you are ready, and keep
            your tapping hand free.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setPhase('running')}>
            Start the round for my {EYE_LABEL[eye]}
          </button>
        </section>
      )}

      {(phase === 'running' || phase === 'eye-done' || phase === 'done') && (
        <section className="panel" aria-labelledby="vision-area-title">
          <h2 className="section-title" id="vision-area-title">
            Test area
          </h2>
          {phase === 'running' && (
            <p aria-live="polite">
              Testing your {EYE_LABEL[eye]}. Dot {Math.min(trialIndex + 1, plan.length)} of{' '}
              {plan.length}. Keep looking at the center cross.
            </p>
          )}
          <div
            role="button"
            tabIndex={0}
            aria-label="Test area. Tap here the moment you notice a dot."
            onPointerDown={handleTap}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Enter') handleTap();
            }}
            style={{
              position: 'relative',
              height: '420px',
              border: '2px solid #444',
              borderRadius: '8px',
              background: '#fdfdf8',
              overflow: 'hidden',
              cursor: phase === 'running' ? 'pointer' : 'default',
              touchAction: 'manipulation',
              userSelect: 'none',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#222',
              }}
            >
              +
            </span>
            {phase === 'running' && stimulusOn && active && (
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `${active.point.xRatio * 100}%`,
                  top: `${active.point.yRatio * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: '#c62828',
                }}
              />
            )}
            {phase !== 'running' && (
              <span
                className="muted"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '58%',
                  transform: 'translateX(-50%)',
                }}
              >
                {phase === 'eye-done' ? 'Round finished.' : 'Results are below.'}
              </span>
            )}
          </div>
          {phase === 'running' && (
            <p>
              <button
                type="button"
                className="btn btn-primary"
                onPointerDown={handleTap}
                style={{ fontSize: '1.25rem', padding: '1rem 2rem' }}
              >
                I saw a dot
              </button>{' '}
              <button type="button" className="btn btn-danger" onClick={() => finishEye(trials)}>
                Stop this round
              </button>
            </p>
          )}
        </section>
      )}

      {phase === 'eye-done' && (
        <section className="panel" aria-labelledby="vision-next-title">
          <h2 className="section-title" id="vision-next-title">
            Round finished for your {EYE_LABEL[eye]}
          </h2>
          <p>
            You noticed {eyeTotals(summary, eye).seen} of {eyeTotals(summary, eye).shown} dots
            with your {EYE_LABEL[eye]}. The full map is below.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {!otherTested && (
              <button type="button" className="btn btn-primary" onClick={() => beginEye(otherEye)}>
                Now test my {EYE_LABEL[otherEye]}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setPhase('done')}>
              See the result map
            </button>
          </div>
        </section>
      )}

      {(phase === 'eye-done' || phase === 'done') && (
        <section className="panel" aria-labelledby="vision-map-title">
          <h2 className="section-title" id="vision-map-title">
            Result map for this session
          </h2>
          <p className="muted">
            Areas are labeled as you see them on the screen. Each cell shows how many of the dots
            in that area you noticed in time.
          </p>
          {testedEyes.map((side) => {
            const totals = eyeTotals(summary, side);
            return (
              <div key={side}>
                <h3>
                  Your {EYE_LABEL[side]}: noticed {totals.seen} of {totals.shown} dots
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    maxWidth: '480px',
                  }}
                >
                  {QUADRANTS.map((quadrant) => {
                    const stat = summary[side][quadrant];
                    return (
                      <div
                        key={quadrant}
                        className="panel"
                        style={{
                          margin: 0,
                          background: stat.missed > 0 ? '#fdf0ec' : '#f2f7f2',
                        }}
                      >
                        <strong>{quadrantLabel(quadrant)}</strong>
                        <br />
                        {stat.shown === 0
                          ? 'No dots were shown here.'
                          : `Noticed ${stat.seen} of ${stat.shown} dots.`}
                        {stat.missed > 0 && (
                          <>
                            <br />
                            Not noticed in time: {stat.missed}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {strayTaps > 0 && (
            <p className="muted">
              You also tapped {strayTaps} time{strayTaps === 1 ? '' : 's'} while no dot was on
              screen. That is recorded as part of the session, without any interpretation.
            </p>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setTrials([]);
              setTestedEyes([]);
              setStrayTaps(0);
              setPhase('intro');
            }}
          >
            Start over
          </button>
        </section>
      )}

      <section className="panel" aria-labelledby="vision-limits-title">
        <h2 className="section-title" id="vision-limits-title">
          What this check cannot do
        </h2>
        <p>
          This is a noticing exercise on a phone or computer screen, not a visual field
          examination. Screen size, viewing distance, glare, attention, and tapping speed all
          change the counts, and the areas tested here are four large screen regions, not a
          measured visual field. There is deliberately no combined score and no final status,
          because a single number would act like a hidden diagnosis. Noticing every dot here
          cannot rule out a visual field problem, and missing dots here does not establish one.
        </p>
        <UncertaintyNote>
          Sudden loss of vision in one or both eyes, or a sudden shadow or curtain over part of
          what you see, is an emergency. Call 119 in Indonesia now instead of using this or any
          other tool on this site.
        </UncertaintyNote>
      </section>
    </div>
  );
}
