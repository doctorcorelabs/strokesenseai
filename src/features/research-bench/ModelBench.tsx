import { useMemo, useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  ConsentNotice,
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../safety';
import {
  getApiBase,
  requestConsentToken,
  requestToolExplanation,
} from '../../ai/client';
import { matchOfflineTopic } from '../../ai/offline';
import { allBenchCases, type BenchCase } from './data';
import {
  BENCH_CONFIGS,
  HISTORY_STORAGE_KEY,
  analyzeReply,
  capReply,
  parseHistory,
  prependRun,
  rubricScore,
  serializeHistory,
  wordCount,
  type BenchConfig,
  type BenchConfigId,
  type FlagHit,
  type RunMode,
  type RunRecord,
} from './bench';
import './research-bench.css';

interface BenchResult {
  config: BenchConfig;
  mode: RunMode;
  latencyMs: number;
  reply: string;
  flags: FlagHit[];
  score: number | null;
  note?: string;
}

const OFFLINE_FALLBACK =
  'No prewritten offline topic matches this case. In offline mode the bench can only show ' +
  'curated guide text, so a free-form case like this one stays unanswered until live AI is ' +
  'configured. That gap is itself one of the things this bench makes visible.';

const MODE_TEXT: Record<RunMode, string> = {
  live: 'Live AI',
  emergency: 'Emergency guidance',
  offline: 'Offline guide',
  unavailable: 'Did not run',
};

function newRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function loadHistory(): RunRecord[] {
  try {
    return parseHistory(window.localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
}

function saveHistory(records: RunRecord[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, serializeHistory(records));
  } catch {
    // Storage may be unavailable (private mode, quota). History is a
    // convenience, so failing to persist is shown by absence, not an error.
  }
}

export default function ModelBench() {
  const feature = getFeature('model-bench');
  const cases = useMemo(() => allBenchCases(), []);
  const api = getApiBase();

  const [caseId, setCaseId] = useState<string>(cases[0]?.id ?? '');
  const [selected, setSelected] = useState<Record<BenchConfigId, boolean>>({
    'coach-context': true,
    'coach-plain': true,
    'offline-guide': true,
  });
  const [consent, setConsent] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BenchResult[]>([]);
  const [runHistory, setRunHistory] = useState<RunRecord[]>(loadHistory);

  const benchCase: BenchCase = cases.find((item) => item.id === caseId) ?? cases[0]!;
  const liveSelected = BENCH_CONFIGS.some(
    (config) => config.id !== 'offline-guide' && selected[config.id],
  );

  function toggleConfig(id: BenchConfigId, checked: boolean) {
    setSelected((previous) => ({ ...previous, [id]: checked }));
  }

  async function runBench() {
    if (running) return;
    setError('');
    const configs = BENCH_CONFIGS.filter((config) => selected[config.id]);
    if (configs.length === 0) {
      setError('Pick at least one configuration to run.');
      return;
    }
    // The emergency guard runs first, before consent and before any
    // network call, exactly as in the product coach. A symptom report is
    // never sent to a model as a bench question; the run demonstrates the
    // interception instead.
    const emergency = mentionsAcuteSigns(benchCase.text);
    const needsLive = configs.some((config) => config.id !== 'offline-guide');
    if (needsLive && api && !emergency && !consent) {
      setError(
        'Acknowledge the data-sharing notice before running live configurations. The offline guide configuration runs without sending data.',
      );
      return;
    }
    setRunning(true);
    try {
      let consentToken: string | undefined;
      if (needsLive && api && !emergency) {
        try {
          consentToken = await requestConsentToken(['tools']);
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Consent could not be recorded, so nothing was sent.',
          );
          return;
        }
      }

      const contextText = feature
        ? `${feature.name}. ${feature.summary} Known limitations: ${feature.limitations}`
        : '';
      const out: BenchResult[] = [];

      for (const config of configs) {
        if (emergency) {
          const flags = analyzeReply(EMERGENCY_TEXT);
          out.push({
            config,
            mode: 'emergency',
            latencyMs: 0,
            reply: EMERGENCY_TEXT,
            flags,
            score: rubricScore(flags),
            note: 'Intercepted locally by the client emergency guard before consent and before any network call. This interception is the expected product behavior for a symptom report.',
          });
          continue;
        }
        if (config.id === 'offline-guide') {
          const started = performance.now();
          const topic = matchOfflineTopic(benchCase.text);
          const reply = topic ? topic.reply : OFFLINE_FALLBACK;
          const flags = analyzeReply(reply);
          out.push({
            config,
            mode: 'offline',
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            reply,
            flags,
            score: rubricScore(flags),
            note: topic
              ? 'Matched a prewritten offline topic shipped in the app. No network call was made.'
              : 'No offline topic matched, so the bench fallback text is shown. No network call was made.',
          });
          continue;
        }
        if (!api) {
          out.push({
            config,
            mode: 'unavailable',
            latencyMs: 0,
            reply: '',
            flags: [],
            score: null,
            note: 'Live AI is not configured in this build (no Worker URL is set), so this configuration did not run. Nothing was sent.',
          });
          continue;
        }
        const started = performance.now();
        try {
          const result = await requestToolExplanation(
            {
              tool: 'research',
              id: 'model-bench',
              context: config.id === 'coach-context' ? contextText : '',
              question: benchCase.text,
            },
            consentToken ? { consentToken } : undefined,
          );
          const flags = analyzeReply(result.reply);
          out.push({
            config,
            mode: result.mode,
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            reply: result.reply,
            flags,
            score: rubricScore(flags),
          });
        } catch (caught) {
          out.push({
            config,
            mode: 'unavailable',
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            reply: '',
            flags: [],
            score: null,
            note:
              caught instanceof Error
                ? caught.message
                : 'Live AI could not respond, so this configuration produced no output.',
          });
        }
      }

      setResults(out);
      setRunHistory((previous) => {
        let next = previous;
        for (const result of out) {
          next = prependRun(next, {
            id: newRunId(),
            at: new Date().toISOString(),
            caseId: benchCase.id,
            caseLabel: benchCase.label,
            configId: result.config.id,
            configLabel: result.config.label,
            mode: result.mode,
            latencyMs: result.latencyMs,
            words: wordCount(result.reply),
            score: result.score,
            flags: result.flags,
            reply: capReply(result.reply),
          });
        }
        saveHistory(next);
        return next;
      });
    } finally {
      setRunning(false);
    }
  }

  function clearHistory() {
    setRunHistory([]);
    saveHistory([]);
  }

  function exportHistory() {
    const blob = new Blob([serializeHistory(runHistory)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'model-bench-history.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!feature) return null;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature.group}</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          <ModeBadge mode={api ? 'live' : 'offline'} />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="bench-about">
        <h2 className="section-title" id="bench-about">
          What this bench does
        </h2>
        <p>
          Pick one test case and run it through several configurations of the same AI coach at
          once. The outputs appear side by side with latency, word count, and a deterministic
          flag rubric that marks dosage-like content, foreign emergency numbers, diagnosis
          language, and reassurance language for human review. The flags are heuristics, not
          verdicts, and benchmark results describe behavior on these cases only.
        </p>
        <p className="muted">
          Cases come from two sources: a small bundled set of synthetic education questions
          written for this bench, and the red-team paraphrase bank shipped in this repository
          (eval/redteam/guard-paraphrases.json). The golden datasets described in eval/golden
          are specified but not published as data files yet, so no golden cases are listed.
        </p>
      </section>

      <section className="panel" aria-labelledby="bench-setup">
        <h2 className="section-title" id="bench-setup">
          Run a comparison
        </h2>
        <form
          className="rb-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runBench();
          }}
        >
          <div>
            <label className="form-label" htmlFor="bench-case">
              Test case
            </label>
            <select
              id="bench-case"
              className="form-input"
              value={benchCase.id}
              onChange={(event) => setCaseId(event.target.value)}
            >
              <optgroup label="Bundled synthetic cases">
                {cases
                  .filter((item) => item.source === 'bundled-synthetic')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.text}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Red-team bank cases (eval/redteam)">
                {cases
                  .filter((item) => item.source === 'redteam-bank')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.text}
                    </option>
                  ))}
              </optgroup>
            </select>
            <p className="muted">
              Source: {benchCase.source === 'redteam-bank' ? 'red-team bank' : 'bundled synthetic'}
              {' '}| Category: {benchCase.category} | Language: {benchCase.lang}
              {benchCase.expectEmergency !== null &&
                ` | Bank expectation: ${benchCase.expectEmergency ? 'escalate to emergency' : 'no escalation'}`}
            </p>
          </div>

          <fieldset>
            <legend className="form-label">Configurations</legend>
            <div className="rb-config-list">
              {BENCH_CONFIGS.map((config) => (
                <label key={config.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={selected[config.id]}
                    onChange={(event) => toggleConfig(config.id, event.target.checked)}
                  />
                  <span>
                    <strong>{config.label}.</strong> {config.description}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {api && liveSelected && (
            <ConsentNotice
              scopeLabel="the selected bench case text and, for the context configuration, the Model Bench registry summary"
              checked={consent}
              onChange={setConsent}
            />
          )}
          {!api && (
            <p className="muted" role="note">
              Live AI is not configured in this build, so the two live configurations will be
              reported as not run. The offline guide configuration and the emergency guard
              interception still work.
            </p>
          )}

          <div className="rb-actions">
            <button className="btn btn-primary" type="submit" disabled={running}>
              {running ? 'Running...' : 'Run comparison'}
            </button>
          </div>
        </form>
        {error && (
          <p role="alert" className="coach-error">
            {error}
          </p>
        )}
      </section>

      {results.length > 0 && (
        <section aria-labelledby="bench-results">
          <h2 className="section-title" id="bench-results">
            Results for this case
          </h2>
          <div className="rb-grid">
            {results.map((result) => (
              <article className="rb-card" key={result.config.id}>
                <h3>{result.config.label}</h3>
                <span className="badge badge-mode">{MODE_TEXT[result.mode]}</span>
                <p className="rb-stats">
                  <span>
                    Latency <strong>{result.latencyMs} ms</strong>
                  </span>
                  <span>
                    Words <strong>{wordCount(result.reply)}</strong>
                  </span>
                  <span>
                    Rubric score{' '}
                    <strong>{result.score === null ? 'not scored' : `${result.score} / 100`}</strong>
                  </span>
                </p>
                {result.note && <p className="muted">{result.note}</p>}
                {result.reply && <p className="rb-reply">{result.reply}</p>}
                {result.mode !== 'unavailable' &&
                  (result.flags.length > 0 ? (
                    <ul className="rb-flags">
                      {result.flags.map((flag, index) => (
                        <li className="rb-flag" key={`${flag.kind}-${index}`}>
                          <strong>{flag.label}</strong>
                          <span>{flag.excerpt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rb-clean">No rubric flags fired on this output.</p>
                  ))}
              </article>
            ))}
          </div>
          <UncertaintyNote>
            The rubric score is a comparison aid computed from pattern flags. It is not a
            quality grade, not a safety certification, and not evidence of clinical performance.
          </UncertaintyNote>
        </section>
      )}

      <section className="panel" aria-labelledby="bench-history">
        <h2 className="section-title" id="bench-history">
          Experiment history (this browser only)
        </h2>
        <p className="muted">
          Runs are stored only in this browser&apos;s local storage so you can compare sessions.
          Nothing is uploaded, and the server stores nothing. Clear the history at any time.
        </p>
        {runHistory.length === 0 ? (
          <p className="muted">No runs yet. Results from comparisons you run will appear here.</p>
        ) : (
          <>
            <div className="rb-history-list">
              {runHistory.map((record) => (
                <details className="rb-history-item" key={record.id}>
                  <summary>
                    <strong>{record.configLabel}</strong>
                    <span className="muted">
                      {new Date(record.at).toLocaleString()} | {MODE_TEXT[record.mode]} |{' '}
                      {record.latencyMs} ms | score{' '}
                      {record.score === null ? 'not scored' : `${record.score} / 100`} |{' '}
                      {record.flags.length} flag{record.flags.length === 1 ? '' : 's'}
                    </span>
                    <span className="muted">Case: {record.caseLabel}</span>
                  </summary>
                  {record.reply ? (
                    <p className="rb-reply">{record.reply}</p>
                  ) : (
                    <p className="muted">This run produced no output.</p>
                  )}
                  {record.flags.length > 0 && (
                    <ul className="rb-flags">
                      {record.flags.map((flag, index) => (
                        <li className="rb-flag" key={`${flag.kind}-${index}`}>
                          <strong>{flag.label}</strong>
                          <span>{flag.excerpt}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              ))}
            </div>
            <div className="rb-actions" style={{ marginTop: '0.9rem' }}>
              <button className="btn btn-ghost" type="button" onClick={exportHistory}>
                Export history as JSON
              </button>
              <button className="btn btn-ghost" type="button" onClick={clearHistory}>
                Clear history
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="bench-limits">
        <h2 className="section-title" id="bench-limits">
          Known limitations
        </h2>
        <p>{feature.limitations}</p>
      </section>
    </div>
  );
}
