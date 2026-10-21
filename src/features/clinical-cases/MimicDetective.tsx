import { useMemo, useState } from 'react';
import {
  CLASSIFICATION_LABELS,
  MIMIC_CASES,
  differentialFeedback,
  scoreMimicAttempt,
} from './mimicCases';
import type { ClassificationId, MimicCase } from './mimicCases';
import { pickSeeded, summarizeScore } from './engine';
import type { ScorePart } from './engine';
import ScoreReport from './ScoreReport';

type Stage = 'differential' | 'clues' | 'decide' | 'result';

const ALL_CLASSIFICATIONS = Object.keys(CLASSIFICATION_LABELS) as ClassificationId[];
const MAX_DIFFERENTIAL = 3;

interface CaseRun {
  differential: ClassificationId[];
  chosenClueIds: string[];
  stage: Stage;
  classification: ClassificationId | null;
  decisivePick: string | null;
  diffFeedback: string | null;
}

const EMPTY_RUN: CaseRun = {
  differential: [],
  chosenClueIds: [],
  stage: 'differential',
  classification: null,
  decisivePick: null,
  diffFeedback: null,
};

export default function MimicDetective() {
  const [seed, setSeed] = useState(20261021);
  const order = useMemo(() => pickSeeded(MIMIC_CASES, MIMIC_CASES.length, seed), [seed]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [run, setRun] = useState<CaseRun>(EMPTY_RUN);
  const [finished, setFinished] = useState<{ caseId: string; percent: number }[]>([]);

  const current: MimicCase = order[caseIndex] ?? MIMIC_CASES[0]!;
  const score = useMemo(
    () =>
      scoreMimicAttempt(current, {
        differential: run.differential,
        chosenClueIds: run.chosenClueIds,
        classification: run.classification,
        decisivePick: run.decisivePick,
      }),
    [current, run],
  );

  function resetRun() {
    setRun(EMPTY_RUN);
  }

  function toggleDifferential(id: ClassificationId) {
    setRun((prev) => {
      const has = prev.differential.includes(id);
      if (has) return { ...prev, differential: prev.differential.filter((d) => d !== id) };
      if (prev.differential.length >= MAX_DIFFERENTIAL) return prev;
      return { ...prev, differential: [...prev.differential, id] };
    });
  }

  function commitDifferential() {
    setRun((prev) => ({
      ...prev,
      stage: 'clues',
      diffFeedback: differentialFeedback(current, prev.differential),
    }));
  }

  function openClue(id: string) {
    setRun((prev) => {
      if (prev.chosenClueIds.includes(id)) return prev;
      if (prev.chosenClueIds.length >= current.clueBudget) return prev;
      return { ...prev, chosenClueIds: [...prev.chosenClueIds, id] };
    });
  }

  function finishCase() {
    setFinished((prev) => [...prev, { caseId: current.id, percent: score.percent }]);
    setRun((prev) => ({ ...prev, stage: 'result' }));
  }

  function nextCase() {
    resetRun();
    setCaseIndex((i) => Math.min(i + 1, order.length - 1));
  }

  function restartSession() {
    setSeed((s) => s + 1);
    setCaseIndex(0);
    setFinished([]);
    resetRun();
  }

  const chosenClues = current.clues.filter((clue) => run.chosenClueIds.includes(clue.id));
  const sessionDone = caseIndex === order.length - 1 && run.stage === 'result';
  const sessionSummary = useMemo(() => {
    if (finished.length === 0) return null;
    const parts: ScorePart[] = finished.map((f, i) => ({
      id: f.caseId,
      label: `Case ${i + 1}: ${MIMIC_CASES.find((c) => c.id === f.caseId)?.title ?? f.caseId}`,
      earned: f.percent,
      max: 100,
    }));
    return summarizeScore(parts);
  }, [finished]);

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="mimic-intro">
        <h2 className="section-title" id="mimic-intro">
          How this case works
        </h2>
        <p>
          Each fictional case arrives in stages. First you commit to a differential of up to{' '}
          {MAX_DIFFERENTIAL} possibilities. Then you may open up to {current.clueBudget} clues from
          the menu; every clue you open gives its result and a short feedback note immediately.
          Finally you classify the case and name the single piece of evidence that determined
          your answer. Checking glucose is scored in every case, because in real care it is the
          one check that must never wait.
        </p>
        <p className="muted">
          Case {caseIndex + 1} of {order.length}. All patients are fictional teaching cases.
        </p>
      </section>

      <section className="panel" aria-labelledby="mimic-case">
        <p className="eyebrow">Case file</p>
        <h2 className="section-title" id="mimic-case">
          {current.title}
        </h2>
        <p>{current.presentation}</p>

        {run.stage === 'differential' && (
          <div>
            <h3>Stage 1: Build your differential</h3>
            <p className="muted">
              Pick up to {MAX_DIFFERENTIAL} classifications you seriously consider at this point.
            </p>
            <div className="card-grid">
              {ALL_CLASSIFICATIONS.map((id) => {
                const selected = run.differential.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="choice-card"
                    aria-pressed={selected}
                    onClick={() => toggleDifferential(id)}
                    style={selected ? { outline: '3px solid var(--green)' } : undefined}
                  >
                    {CLASSIFICATION_LABELS[id]}
                    {selected ? ' (selected)' : ''}
                  </button>
                );
              })}
            </div>
            <div className="wizard-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={run.differential.length === 0}
                onClick={commitDifferential}
              >
                Commit differential
              </button>
            </div>
          </div>
        )}

        {run.stage !== 'differential' && (
          <div>
            <h3>What happened next</h3>
            <p>{current.reveal}</p>
            {run.diffFeedback && (
              <p role="note">
                <strong>Differential feedback:</strong> {run.diffFeedback}
              </p>
            )}
            <p>
              <strong>Your differential:</strong>{' '}
              {run.differential.map((d) => CLASSIFICATION_LABELS[d]).join('; ')}
            </p>
          </div>
        )}

        {(run.stage === 'clues' || run.stage === 'decide' || run.stage === 'result') && (
          <div>
            <h3>Stage 2: Gather clues</h3>
            <p className="muted">
              Clues opened: {run.chosenClueIds.length} of {current.clueBudget}. Feedback appears
              under each clue as you open it.
            </p>
            <div className="card-grid">
              {current.clues.map((clue) => {
                const opened = run.chosenClueIds.includes(clue.id);
                const budgetLeft = run.chosenClueIds.length < current.clueBudget;
                return (
                  <button
                    key={clue.id}
                    type="button"
                    className="choice-card"
                    disabled={opened || run.stage !== 'clues' || !budgetLeft}
                    onClick={() => openClue(clue.id)}
                  >
                    {clue.label}
                    <span className="muted"> ({clue.kind})</span>
                    {opened ? ' (opened)' : ''}
                  </button>
                );
              })}
            </div>
            {chosenClues.map((clue) => (
              <div key={clue.id} className="detail-panel">
                <p>
                  <strong>{clue.label}:</strong> {clue.result}
                </p>
                <p className="muted">{clue.feedback}</p>
                {run.stage === 'result' && (
                  <p>
                    <span className="badge badge-mode">Clue weight: {clue.weight}</span>
                    {clue.safety ? <span className="badge badge-lab">Safety check</span> : null}
                  </p>
                )}
              </div>
            ))}
            {run.stage === 'clues' && (
              <div className="wizard-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={run.chosenClueIds.length === 0}
                  onClick={() => setRun((prev) => ({ ...prev, stage: 'decide' }))}
                >
                  Move to classification
                </button>
              </div>
            )}
          </div>
        )}

        {(run.stage === 'decide' || run.stage === 'result') && (
          <div>
            <h3>Stage 3: Classify and name the determining evidence</h3>
            <p className="muted">Final classification:</p>
            <div className="card-grid">
              {ALL_CLASSIFICATIONS.map((id) => {
                const selected = run.classification === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className="choice-card"
                    aria-pressed={selected}
                    disabled={run.stage === 'result'}
                    onClick={() => setRun((prev) => ({ ...prev, classification: id }))}
                    style={selected ? { outline: '3px solid var(--green)' } : undefined}
                  >
                    {CLASSIFICATION_LABELS[id]}
                  </button>
                );
              })}
            </div>
            <label className="form-label" htmlFor="mimic-decisive">
              The single clue that determined your answer:
            </label>
            <select
              id="mimic-decisive"
              className="form-input"
              value={run.decisivePick ?? ''}
              disabled={run.stage === 'result'}
              onChange={(e) =>
                setRun((prev) => ({ ...prev, decisivePick: e.target.value || null }))
              }
            >
              <option value="">Choose from the clues you opened</option>
              {chosenClues.map((clue) => (
                <option key={clue.id} value={clue.id}>
                  {clue.label}
                </option>
              ))}
            </select>
            {run.stage === 'decide' && (
              <div className="wizard-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!run.classification || !run.decisivePick}
                  onClick={finishCase}
                >
                  Submit case
                </button>
              </div>
            )}
          </div>
        )}

        {run.stage === 'result' && (
          <div>
            <h3>Case debrief</h3>
            <ScoreReport summary={score} title="Case score" />
            <p>
              <strong>Key diagnosis:</strong> {current.keyLabel}.
            </p>
            <p>{current.explanation}</p>
            <p>
              <strong>The trap in this case:</strong> {current.trap}
            </p>
            <p className="muted">
              Decisive clues in this case:{' '}
              {current.decisiveClueIds
                .map((id) => current.clues.find((clue) => clue.id === id)?.label ?? id)
                .join('; ')}
              .
            </p>
            <div className="wizard-actions">
              {!sessionDone && (
                <button type="button" className="btn btn-primary" onClick={nextCase}>
                  Next case
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={restartSession}>
                Restart session with a new case order
              </button>
            </div>
          </div>
        )}
      </section>

      {sessionDone && sessionSummary && (
        <section className="panel" aria-labelledby="mimic-session">
          <h2 className="section-title" id="mimic-session">
            Session summary
          </h2>
          <ScoreReport summary={sessionSummary} title="Average across cases" />
          <p className="muted">
            The band is a practice guide, not a grade. The habit that transfers to real care is
            the order of operations: differential first, glucose always, decisive evidence named
            out loud.
          </p>
        </section>
      )}
    </div>
  );
}
