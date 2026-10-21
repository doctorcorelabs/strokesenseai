import { useEffect, useMemo, useRef, useState } from 'react';
import { OSCE_STATIONS, scoreOsceStation } from './osceStations';
import type { OsceStation } from './osceStations';
import { formatClock, isExpired, remainingSeconds } from './engine';
import ScoreReport from './ScoreReport';

interface StationRun {
  askedIds: string[];
  examIds: string[];
  commChoices: Record<string, string>;
  diagnosisId: string | null;
  nextStepIds: string[];
  deadlineMs: number;
  finished: boolean;
  expired: boolean;
}

function StationWorkspace({ station, onExit }: { station: OsceStation; onExit: () => void }) {
  const [run, setRun] = useState<StationRun>(() => ({
    askedIds: [],
    examIds: [],
    commChoices: {},
    diagnosisId: null,
    nextStepIds: [],
    deadlineMs: Date.now() + station.timeLimitSeconds * 1000,
    finished: false,
    expired: false,
  }));
  const [nowMs, setNowMs] = useState(() => Date.now());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (run.finished) return;
    intervalRef.current = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [run.finished]);

  useEffect(() => {
    if (!run.finished && isExpired(run.deadlineMs, nowMs)) {
      setRun((prev) => ({ ...prev, finished: true, expired: true }));
    }
  }, [nowMs, run.finished, run.deadlineMs]);

  const score = useMemo(
    () =>
      scoreOsceStation(station, {
        askedIds: run.askedIds,
        examIds: run.examIds,
        commChoices: run.commChoices,
        diagnosisId: run.diagnosisId,
        nextStepIds: run.nextStepIds,
      }),
    [station, run],
  );

  const secondsLeft = remainingSeconds(run.deadlineMs, nowMs);
  const askedOptions = station.historyOptions.filter((o) => run.askedIds.includes(o.id));
  const doneExam = station.examOptions.filter((o) => run.examIds.includes(o.id));

  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  if (run.finished) {
    const missedHistory = station.historyOptions.filter(
      (o) => o.key && !run.askedIds.includes(o.id),
    );
    const missedExam = station.examOptions.filter((o) => o.key && !run.examIds.includes(o.id));
    return (
      <div className="page-stack">
        <section className="panel" aria-labelledby="osce-report">
          <p className="eyebrow">{station.title}</p>
          <h2 className="section-title" id="osce-report">
            Examiner report
          </h2>
          {run.expired && (
            <p role="alert">
              <strong>Time expired.</strong> The station was scored with whatever was complete at
              the limit, exactly as in a real OSCE.
            </p>
          )}
          <ScoreReport summary={score} title="Station score" />

          <h3>Communication moments, graded</h3>
          {station.commPrompts.map((prompt) => {
            const chosen = prompt.options.find((o) => o.id === run.commChoices[prompt.id]);
            return (
              <div key={prompt.id} className="detail-panel">
                <p className="muted">{prompt.prompt}</p>
                {chosen ? (
                  <p>
                    <strong>Your response scored {chosen.score} of 2.</strong> {chosen.feedback}
                  </p>
                ) : (
                  <p>
                    <strong>Not answered.</strong> This moment scored zero.
                  </p>
                )}
              </div>
            );
          })}

          <h3>Checklist gaps</h3>
          {missedHistory.length === 0 && missedExam.length === 0 ? (
            <p>No key history or examination items were missed.</p>
          ) : (
            <ul className="result-list">
              {missedHistory.map((o) => (
                <li key={o.id}>
                  History not asked: {o.label} <span className="muted">({o.domain})</span>
                </li>
              ))}
              {missedExam.map((o) => (
                <li key={o.id}>Examination not selected: {o.label}</li>
              ))}
            </ul>
          )}
          <p>
            <strong>Station note:</strong> {station.closingNote}
          </p>
          <div className="wizard-actions">
            <button type="button" className="btn btn-primary" onClick={onExit}>
              Back to station list
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="osce-head">
        <p className="eyebrow">{station.title}</p>
        <h2 className="section-title" id="osce-head">
          {station.setting}
        </h2>
        <p>{station.candidateInstructions}</p>
        <p>
          Time remaining: <strong>{formatClock(secondsLeft)}</strong>
        </p>
      </section>

      <section className="panel" aria-labelledby="osce-history">
        <h2 className="section-title" id="osce-history">
          1. Guided history
        </h2>
        <p className="muted">
          Choose the questions you want to ask. Each question reveals the scripted answer.
          Decorative questions cost time and score nothing; key questions carry the rubric.
        </p>
        <div className="card-grid">
          {station.historyOptions.map((option) => {
            const asked = run.askedIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className="choice-card"
                disabled={asked}
                onClick={() =>
                  setRun((prev) => ({ ...prev, askedIds: [...prev.askedIds, option.id] }))
                }
              >
                {option.label}
                {asked ? ' (asked)' : ''}
              </button>
            );
          })}
        </div>
        {askedOptions.length > 0 && (
          <div>
            <h3>Transcript so far</h3>
            {askedOptions.map((option) => (
              <div key={option.id} className="detail-panel">
                <p>
                  <strong>You asked:</strong> {option.label}
                </p>
                <p>{option.answer}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="osce-exam">
        <h2 className="section-title" id="osce-exam">
          2. Examination
        </h2>
        <div className="card-grid">
          {station.examOptions.map((option) => {
            const done = run.examIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className="choice-card"
                disabled={done}
                onClick={() =>
                  setRun((prev) => ({ ...prev, examIds: [...prev.examIds, option.id] }))
                }
              >
                {option.label}
                {done ? ' (done)' : ''}
              </button>
            );
          })}
        </div>
        {doneExam.map((option) => (
          <div key={option.id} className="detail-panel">
            <p>
              <strong>{option.label}:</strong> {option.result}
            </p>
          </div>
        ))}
      </section>

      <section className="panel" aria-labelledby="osce-comm">
        <h2 className="section-title" id="osce-comm">
          3. Communication moments
        </h2>
        {station.commPrompts.map((prompt) => (
          <div key={prompt.id} className="detail-panel">
            <p>{prompt.prompt}</p>
            <div className="card-grid">
              {prompt.options.map((option) => {
                const chosen = run.commChoices[prompt.id] === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="choice-card"
                    aria-pressed={chosen}
                    style={chosen ? { outline: '3px solid var(--green)' } : undefined}
                    onClick={() =>
                      setRun((prev) => ({
                        ...prev,
                        commChoices: { ...prev.commChoices, [prompt.id]: option.id },
                      }))
                    }
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="panel" aria-labelledby="osce-summary">
        <h2 className="section-title" id="osce-summary">
          4. Summary and next step
        </h2>
        <label className="form-label" htmlFor="osce-diagnosis">
          Working summary
        </label>
        <select
          id="osce-diagnosis"
          className="form-input"
          value={run.diagnosisId ?? ''}
          onChange={(e) =>
            setRun((prev) => ({ ...prev, diagnosisId: e.target.value || null }))
          }
        >
          <option value="">Choose the working summary</option>
          {station.diagnosisOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="muted">Most important next step:</p>
        <div className="card-grid">
          {station.nextStepOptions.map((option) => {
            const chosen = run.nextStepIds.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className="choice-card"
                aria-pressed={chosen}
                style={chosen ? { outline: '3px solid var(--green)' } : undefined}
                onClick={() =>
                  setRun((prev) => ({
                    ...prev,
                    nextStepIds: toggleId(prev.nextStepIds, option.id),
                  }))
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-danger"
            disabled={!run.diagnosisId || run.nextStepIds.length === 0}
            onClick={() => setRun((prev) => ({ ...prev, finished: true }))}
          >
            End station and see the rubric
          </button>
          <button type="button" className="btn btn-ghost" onClick={onExit}>
            Abandon station
          </button>
        </div>
      </section>
    </div>
  );
}

export default function VirtualPatientOsce() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = OSCE_STATIONS.find((s) => s.id === activeId);

  if (active) {
    return (
      <StationWorkspace
        key={active.id}
        station={active}
        onExit={() => setActiveId(null)}
      />
    );
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="osce-intro">
        <h2 className="section-title" id="osce-intro">
          How these stations work
        </h2>
        <p>
          Each station runs against a fixed clock, like a real OSCE. You take the history by
          choosing questions from a menu, choose your examination priorities, answer graded
          communication moments, and close with a working summary and next step. Scoring is a
          fixed deterministic rubric: a history checklist, an examination checklist, graded
          communication responses, and the closing summary. The patients and relatives are
          fictional, and their answers never change mid station.
        </p>
      </section>
      <section className="panel" aria-labelledby="osce-list">
        <h2 className="section-title" id="osce-list">
          Choose a station
        </h2>
        <div className="card-grid">
          {OSCE_STATIONS.map((station) => (
            <button
              key={station.id}
              type="button"
              className="choice-card"
              onClick={() => setActiveId(station.id)}
            >
              <strong>{station.title}</strong>
              <br />
              <span className="muted">
                {station.setting} Time limit: {formatClock(station.timeLimitSeconds)}.
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
