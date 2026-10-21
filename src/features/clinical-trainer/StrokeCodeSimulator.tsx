// Stroke Code Simulator UI.
//
// TRAINING SIMULATION ONLY. Every case is fictional and simplified around a
// small set of teaching time targets. Real stroke care follows the local
// stroke team and protocol, not this page. The engine in strokeCode.ts is
// deterministic: the clock, the milestones, and the scores are computed in
// code, and critical decisions cap the score instead of being averaged away.

import { useMemo, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import { EmergencyBanner, MaturityBadge, ModeBadge, UncertaintyNote } from '../../components/ui';
import HowItWorks from '../../components/HowItWorks';
import {
  STROKE_CODE_SCENARIOS,
  addMinutesToClock,
  applyChoice,
  computeResults,
  createRun,
  type RunState,
  type SimOption,
  type SimScenario,
  type Verdict,
} from './strokeCode';

const VERDICT_LABELS: Record<Verdict, string> = {
  optimal: 'Optimal',
  acceptable: 'Acceptable',
  poor: 'Poor',
  critical: 'Critical',
};

interface LastChoice {
  option: SimOption;
  stepTitle: string;
}

function ScenarioPicker({ onPick }: { onPick: (scenario: SimScenario) => void }) {
  return (
    <section className="panel" aria-labelledby="sim-picker">
      <h3 className="section-title" id="sim-picker">
        Pick a scenario
      </h3>
      <div className="card-grid">
        {STROKE_CODE_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className="choice-card"
            onClick={() => onPick(scenario)}
          >
            <strong>{scenario.title}</strong>
            <span className="muted">
              Difficulty: {scenario.difficulty}. Door at {scenario.doorClock}. Windows run from{' '}
              {scenario.onsetKind}, {scenario.lkwMinutesBeforeDoor} minutes before the door.
            </span>
            <span className="muted">{scenario.intro[0]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RunView({
  scenario,
  onExit,
}: {
  scenario: SimScenario;
  onExit: () => void;
}) {
  const [run, setRun] = useState<RunState>(() => createRun(scenario));
  const [lastChoice, setLastChoice] = useState<LastChoice | null>(null);
  const results = useMemo(
    () => (run.finished ? computeResults(scenario, run) : null),
    [scenario, run],
  );
  const currentStep = scenario.steps[run.stepIndex];

  const choose = (option: SimOption) => {
    if (!currentStep) return;
    setLastChoice({ option, stepTitle: currentStep.title });
    setRun((prev) => applyChoice(scenario, prev, option.id));
  };

  const restart = () => {
    setRun(createRun(scenario));
    setLastChoice(null);
  };

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="sim-case">
        <p className="eyebrow">
          {scenario.difficulty} scenario - simulation clock running
        </p>
        <h3 className="section-title" id="sim-case">
          {scenario.title}
        </h3>
        {scenario.intro.map((line) => (
          <p key={line.slice(0, 24)}>{line}</p>
        ))}
        <p>
          <strong>
            Door {scenario.doorClock} - now {addMinutesToClock(scenario.doorClock, run.elapsed)} (
            {run.elapsed} simulated minutes elapsed)
          </strong>
        </p>
        <div className="badge-row" aria-label="Milestones so far">
          <span className="badge badge-mode">
            CT: {run.milestones.ct !== undefined ? `${run.milestones.ct} min` : 'not yet'}
          </span>
          <span className="badge badge-mode">
            Needle: {run.milestones.needle !== undefined ? `${run.milestones.needle} min` : 'not yet'}
          </span>
          <span className="badge badge-mode">
            Puncture: {run.milestones.groin !== undefined ? `${run.milestones.groin} min` : 'not yet'}
          </span>
          <span className="badge badge-mode">
            Step {Math.min(run.stepIndex + 1, scenario.steps.length)} of {scenario.steps.length}
          </span>
        </div>
      </section>

      {lastChoice && (
        <section className="panel" aria-labelledby="sim-last">
          <h3 className="section-title" id="sim-last">
            Examiner note: {lastChoice.stepTitle}
          </h3>
          <p>
            <strong>{VERDICT_LABELS[lastChoice.option.verdict]}.</strong>{' '}
            {lastChoice.option.feedback}
          </p>
          <p className="muted">This choice cost {lastChoice.option.minutes} simulated minutes.</p>
        </section>
      )}

      {!run.finished && currentStep && (
        <section className="panel" aria-labelledby="sim-step">
          <p className="eyebrow">{currentStep.phase}</p>
          <h3 className="section-title" id="sim-step">
            {currentStep.title}
          </h3>
          {currentStep.context && <p className="muted">{currentStep.context}</p>}
          <p>{currentStep.prompt}</p>
          <div className="card-grid">
            {currentStep.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="choice-card"
                onClick={() => choose(option)}
              >
                <strong>{option.label}</strong>
                {option.detail && <span className="muted">{option.detail}</span>}
                <span className="muted">Takes about {option.minutes} simulated minutes</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {run.entries.length > 0 && (
        <section className="panel" aria-labelledby="sim-timeline">
          <h3 className="section-title" id="sim-timeline">
            Case timeline so far
          </h3>
          <table className="table-simple">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Phase</th>
                <th scope="col">Decision</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {run.entries.map((entry) => (
                <tr key={`${entry.stepId}-${entry.startAt}`}>
                  <td>
                    {addMinutesToClock(scenario.doorClock, entry.startAt)} to{' '}
                    {addMinutesToClock(scenario.doorClock, entry.endAt)}
                  </td>
                  <td>{entry.phase}</td>
                  <td>{entry.choiceLabel}</td>
                  <td>{VERDICT_LABELS[entry.verdict]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {results && (
        <section className="panel" aria-labelledby="sim-debrief">
          <h3 className="section-title" id="sim-debrief">
            Debrief
          </h3>
          <p>
            Score: <strong>{results.scorePct} of 100</strong>
            {results.critical.length > 0
              ? ` (uncapped score ${results.rawScorePct}, capped because of critical decisions)`
              : ''}
            . {results.grade}.
          </p>

          <h4>Time targets (training benchmarks)</h4>
          <table className="table-simple">
            <thead>
              <tr>
                <th scope="col">Target</th>
                <th scope="col">Your run</th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {results.targetChecks.map((check) => (
                <tr key={check.id}>
                  <td>
                    {check.label} within {check.limitMinutes} min
                  </td>
                  <td>{check.value === null ? 'Never happened' : `${check.value} min`}</td>
                  <td>
                    {check.met === null ? 'Not done' : check.met ? 'Met' : 'Missed'} - {check.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {results.critical.length > 0 && (
            <div className="panel alert-emergency" role="note">
              <h4>Critical decisions to review</h4>
              <ul className="check-list">
                {results.critical.map((entry) => (
                  <li key={entry.slice(0, 48)}>{entry}</li>
                ))}
              </ul>
            </div>
          )}

          <h4>What the clock and the rubric say</h4>
          <ul className="check-list">
            {results.debrief.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>

          <h4>Ideal key decisions for this case</h4>
          <ol className="step-list">
            {scenario.idealPath.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ol>

          <UncertaintyNote>
            These targets are simplified teaching benchmarks for a fictional case. Real pathways
            set their own targets, and real eligibility is decided by the treating stroke team
            with the actual patient in front of them.
          </UncertaintyNote>

          <div className="wizard-actions">
            <button type="button" className="btn btn-primary" onClick={restart}>
              Run this scenario again
            </button>
            <button type="button" className="btn" onClick={onExit}>
              Pick another scenario
            </button>
          </div>
        </section>
      )}

      {!run.finished && (
        <div className="wizard-actions">
          <button type="button" className="btn" onClick={restart}>
            Restart scenario
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Abandon and pick another scenario
          </button>
        </div>
      )}
    </div>
  );
}

export function StrokeCodeSimulator() {
  const feature = getFeature('stroke-code-simulator');
  const [scenario, setScenario] = useState<SimScenario | null>(null);

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">Clinical Reasoning AI - Training simulation</p>
        <h1
          style={{ fontSize: 'clamp(1.45rem, 3vw, 2rem)', fontWeight: 750, marginBottom: '0.5em' }}
        >
          {feature?.name ?? 'Stroke Code Simulator'}
        </h1>
        <p className="muted">
          {feature?.tagline ?? 'Decisions under the clock, with an AI examiner'}
        </p>
        <div className="badge-row">
          <MaturityBadge maturity={feature?.maturity ?? 'concept'} />
          <ModeBadge mode="simulation" />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="sim-training-note">
        <h3 className="section-title" id="sim-training-note">
          Training simulation, not a clinical protocol
        </h3>
        <p>
          Every case here is fictional, assembled from a fixed template with planted facts and
          planted traps. The clock, the interval calculations, and the scoring are deterministic
          code; no model invents case facts or moves a deadline. Eligibility inside a scenario is
          fixed by the scenario key. In real care, decisions always follow your local stroke team
          and protocol.
        </p>
      </section>

      {scenario ? (
        <RunView key={scenario.id} scenario={scenario} onExit={() => setScenario(null)} />
      ) : (
        <ScenarioPicker onPick={setScenario} />
      )}

      {feature && <HowItWorks feature={feature} />}
    </div>
  );
}

export default StrokeCodeSimulator;
