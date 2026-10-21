import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LEVEL_LABELS,
  LOCALIZATION_CASES,
  SIDE_LABELS,
  TERRITORIES,
  getTerritory,
  scoreLocalizationAnswer,
} from './localizationCases';
import type { LevelId, LocalizationAnswer, LocalizationCase, SideId } from './localizationCases';
import { formatClock, isExpired, pickSeeded, remainingSeconds } from './engine';
import type { ScoreSummary } from './engine';
import ScoreReport from './ScoreReport';
import TerritoryMap from './TerritoryMap';

const CHALLENGE_CASE_COUNT = 5;
const CHALLENGE_SECONDS_PER_CASE = 90;

const EMPTY_ANSWER: LocalizationAnswer = { side: null, level: null, territory: null };

function AnswerForm({
  answer,
  onChange,
  disabled,
}: {
  answer: LocalizationAnswer;
  onChange: (next: LocalizationAnswer) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="form-label" htmlFor="loc-side">
        Layer 1a: lesion side
      </label>
      <select
        id="loc-side"
        className="form-input"
        value={answer.side ?? ''}
        disabled={disabled}
        onChange={(e) =>
          onChange({ ...answer, side: (e.target.value || null) as SideId | null })
        }
      >
        <option value="">Choose a side</option>
        {(Object.keys(SIDE_LABELS) as SideId[]).map((id) => (
          <option key={id} value={id}>
            {SIDE_LABELS[id]}
          </option>
        ))}
      </select>

      <label className="form-label" htmlFor="loc-level">
        Layer 1b: level
      </label>
      <select
        id="loc-level"
        className="form-input"
        value={answer.level ?? ''}
        disabled={disabled}
        onChange={(e) =>
          onChange({ ...answer, level: (e.target.value || null) as LevelId | null })
        }
      >
        <option value="">Choose a level</option>
        {(Object.keys(LEVEL_LABELS) as LevelId[]).map((id) => (
          <option key={id} value={id}>
            {LEVEL_LABELS[id]}
          </option>
        ))}
      </select>

      <label className="form-label" htmlFor="loc-territory">
        Layer 2: arterial territory
      </label>
      <select
        id="loc-territory"
        className="form-input"
        value={answer.territory ?? ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...answer, territory: e.target.value || null })}
      >
        <option value="">Choose a territory</option>
        {TERRITORIES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CaseDebrief({ c, score }: { c: LocalizationCase; score: ScoreSummary }) {
  const key = getTerritory(c.keyTerritory);
  return (
    <div>
      <ScoreReport summary={score} title="Case score" />
      <p>
        <strong>Key answer:</strong> {SIDE_LABELS[c.keySide]}, {LEVEL_LABELS[c.keyLevel]},{' '}
        {key?.label ?? c.keyTerritory}.
      </p>
      <TerritoryMap highlightTerritory={c.keyTerritory} highlightSide={c.keySide} />
      <h3>Finding by finding</h3>
      <ul className="result-list">
        {c.findings.map((finding) => (
          <li key={finding.text}>
            <strong>{finding.text}.</strong> {finding.pointsTo}
          </li>
        ))}
      </ul>
      {c.trap && (
        <p>
          <strong>Trap:</strong> {c.trap}
        </p>
      )}
      <p>{c.explanation}</p>
    </div>
  );
}

function PracticeMode() {
  const [caseId, setCaseId] = useState(LOCALIZATION_CASES[0]!.id);
  const [answer, setAnswer] = useState<LocalizationAnswer>(EMPTY_ANSWER);
  const [submitted, setSubmitted] = useState<ScoreSummary | null>(null);
  const current = LOCALIZATION_CASES.find((c) => c.id === caseId) ?? LOCALIZATION_CASES[0]!;

  function chooseCase(id: string) {
    setCaseId(id);
    setAnswer(EMPTY_ANSWER);
    setSubmitted(null);
  }

  return (
    <div>
      <label className="form-label" htmlFor="practice-case">
        Choose a case
      </label>
      <select
        id="practice-case"
        className="form-input"
        value={caseId}
        onChange={(e) => chooseCase(e.target.value)}
      >
        {LOCALIZATION_CASES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      <h3>{current.title}</h3>
      <p>{current.intro}</p>
      <ul className="result-list">
        {current.findings.map((finding) => (
          <li key={finding.text}>{finding.text}</li>
        ))}
      </ul>

      <AnswerForm answer={answer} onChange={setAnswer} disabled={submitted !== null} />
      {submitted === null ? (
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!answer.side || !answer.level || !answer.territory}
            onClick={() => setSubmitted(scoreLocalizationAnswer(current, answer))}
          >
            Check my localization
          </button>
        </div>
      ) : (
        <div>
          <CaseDebrief c={current} score={submitted} />
          <div className="wizard-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setAnswer(EMPTY_ANSWER);
                setSubmitted(null);
              }}
            >
              Try this case again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChallengeRun {
  queue: LocalizationCase[];
  index: number;
  answer: LocalizationAnswer;
  deadlineMs: number;
  results: { caseId: string; percent: number }[];
  lastScore: ScoreSummary | null;
  lastCase: LocalizationCase | null;
  phase: 'answering' | 'debrief' | 'done';
}

function ChallengeMode() {
  const [seed, setSeed] = useState(7);
  const [run, setRun] = useState<ChallengeRun | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!run || run.phase !== 'answering') return;
    timerRef.current = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [run]);

  const current = run && run.phase !== 'done' ? run.queue[run.index] : undefined;

  function start() {
    const queue = pickSeeded(LOCALIZATION_CASES, CHALLENGE_CASE_COUNT, seed);
    setRun({
      queue,
      index: 0,
      answer: EMPTY_ANSWER,
      deadlineMs: Date.now() + CHALLENGE_SECONDS_PER_CASE * 1000,
      results: [],
      lastScore: null,
      lastCase: null,
      phase: 'answering',
    });
    setNowMs(Date.now());
  }

  function submitCurrent(timedOut: boolean) {
    setRun((prev) => {
      if (!prev || prev.phase !== 'answering') return prev;
      const c = prev.queue[prev.index]!;
      const score = scoreLocalizationAnswer(c, timedOut ? EMPTY_ANSWER : prev.answer);
      return {
        ...prev,
        results: [...prev.results, { caseId: c.id, percent: score.percent }],
        lastScore: score,
        lastCase: c,
        phase: 'debrief',
      };
    });
  }

  // Auto submit when the per-case clock runs out.
  useEffect(() => {
    if (run && run.phase === 'answering' && isExpired(run.deadlineMs, nowMs)) {
      submitCurrent(true);
    }
    // submitCurrent is stable enough for this effect; run identity guards it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs, run?.phase, run?.deadlineMs]);

  function advance() {
    setRun((prev) => {
      if (!prev) return prev;
      const nextIndex = prev.index + 1;
      if (nextIndex >= prev.queue.length) {
        return { ...prev, phase: 'done', lastScore: null, lastCase: null };
      }
      return {
        ...prev,
        index: nextIndex,
        answer: EMPTY_ANSWER,
        deadlineMs: Date.now() + CHALLENGE_SECONDS_PER_CASE * 1000,
        phase: 'answering',
        lastScore: null,
        lastCase: null,
      };
    });
    setNowMs(Date.now());
  }

  const totalPercent = useMemo(() => {
    if (!run || run.results.length === 0) return 0;
    return Math.round(run.results.reduce((sum, r) => sum + r.percent, 0) / run.results.length);
  }, [run]);

  if (!run) {
    return (
      <div>
        <p>
          Challenge mode draws {CHALLENGE_CASE_COUNT} cases in a seeded order and gives you{' '}
          {CHALLENGE_SECONDS_PER_CASE} seconds per case. When the clock ends, the case is scored
          as blank if you have not submitted. There is no pause button; that is the point of the
          drill.
        </p>
        <div className="wizard-actions">
          <button type="button" className="btn btn-primary" onClick={start}>
            Start challenge
          </button>
        </div>
      </div>
    );
  }

  if (run.phase === 'done') {
    return (
      <div>
        <h3>Challenge complete</h3>
        <ul className="result-list">
          {run.results.map((r) => (
            <li key={r.caseId}>
              {LOCALIZATION_CASES.find((c) => c.id === r.caseId)?.title ?? r.caseId}: {r.percent}%
            </li>
          ))}
        </ul>
        <p>
          <strong>Average score: {totalPercent}%.</strong> Replay with a new case order, or drop
          back to practice mode and read the finding by finding debriefs slowly.
        </p>
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSeed((s) => s + 1);
              setRun(null);
            }}
          >
            New challenge
          </button>
        </div>
      </div>
    );
  }

  const secondsLeft = remainingSeconds(run.deadlineMs, nowMs);

  return (
    <div>
      <p className="muted">
        Case {run.index + 1} of {run.queue.length}.{' '}
        {run.phase === 'answering' ? (
          <>
            Time left: <strong>{formatClock(secondsLeft)}</strong>
          </>
        ) : (
          'Time stopped for the debrief.'
        )}
      </p>
      {current && (
        <div>
          <h3>{current.title}</h3>
          <p>{current.intro}</p>
          <ul className="result-list">
            {current.findings.map((finding) => (
              <li key={finding.text}>{finding.text}</li>
            ))}
          </ul>
          {run.phase === 'answering' ? (
            <div>
              <AnswerForm
                answer={run.answer}
                onChange={(next) => setRun((prev) => (prev ? { ...prev, answer: next } : prev))}
                disabled={false}
              />
              <div className="wizard-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!run.answer.side || !run.answer.level || !run.answer.territory}
                  onClick={() => submitCurrent(false)}
                >
                  Submit answer
                </button>
              </div>
            </div>
          ) : (
            run.lastCase &&
            run.lastScore && (
              <div>
                <CaseDebrief c={run.lastCase} score={run.lastScore} />
                <div className="wizard-actions">
                  <button type="button" className="btn btn-primary" onClick={advance}>
                    {run.index + 1 >= run.queue.length ? 'See challenge results' : 'Next case'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function LocalizationChallenge() {
  const [mode, setMode] = useState<'practice' | 'challenge'>('practice');
  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="loc-intro">
        <h2 className="section-title" id="loc-intro">
          How this challenge works
        </h2>
        <p>
          Read the structured findings, then answer in two layers: side and level first, then the
          arterial territory. Scoring is deterministic from the finding to territory table:
          side 20 points, level 30, territory 50, with half credit for a territory in the right
          artery family. After each answer the map highlights the key territory and every finding
          is replayed with the reason it points there.
        </p>
        <div className="badge-row" role="group" aria-label="Mode">
          <button
            type="button"
            className={mode === 'practice' ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setMode('practice')}
          >
            Practice mode
          </button>
          <button
            type="button"
            className={mode === 'challenge' ? 'btn btn-primary' : 'btn btn-ghost'}
            onClick={() => setMode('challenge')}
          >
            Timed challenge
          </button>
        </div>
      </section>
      <section className="panel">{mode === 'practice' ? <PracticeMode /> : <ChallengeMode />}</section>
    </div>
  );
}
