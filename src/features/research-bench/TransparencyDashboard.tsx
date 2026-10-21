import { useMemo } from 'react';
import { FEATURES, getFeature } from '../../../shared/registry';
import {
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import { mentionsAcuteSigns } from '../../safety';
import { GUARD_BANK } from './data';
import {
  RELEASE_GATES,
  bankComposition,
  evaluateGuard,
  maturitySummary,
} from './metrics';
import './research-bench.css';

function percent(part: number, total: number): string {
  if (total === 0) return 'n/a';
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default function TransparencyDashboard() {
  const feature = getFeature('transparency-dashboard');
  const composition = useMemo(() => bankComposition(GUARD_BANK), []);
  const guard = useMemo(() => evaluateGuard(GUARD_BANK, mentionsAcuteSigns), []);
  const maturity = useMemo(() => maturitySummary(FEATURES), []);

  if (!feature) return null;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature.group}</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          <ModeBadge mode="synthetic" />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="dash-standing">
        <h2 className="section-title" id="dash-standing">
          Read this first
        </h2>
        <p>
          Every number on this page is computed in your browser, right now, from artifacts
          shipped in this repository: the red-team paraphrase bank and the feature registry.
          The guard figures come from running the actual client emergency guard that ships in
          this app over the actual bank, so you can reproduce them from the source. All inputs
          are synthetic. Synthetic performance is not clinical performance, and nothing here
          measures diagnostic accuracy.
        </p>
      </section>

      <section className="panel" aria-labelledby="dash-artifacts">
        <h2 className="section-title" id="dash-artifacts">
          Evaluation artifacts in this repository
        </h2>
        <div className="rb-grid">
          <article className="rb-card">
            <h3>Red-team paraphrase bank</h3>
            <p className="rb-stats">
              <span>
                Items <strong>{composition.total}</strong>
              </span>
              <span>
                Expect escalation <strong>{composition.expectedEmergency}</strong>
              </span>
              <span>
                Expect no escalation <strong>{composition.expectedCalm}</strong>
              </span>
            </p>
            <p className="muted">
              File: eval/redteam/guard-paraphrases.json. Languages:{' '}
              {composition.byLang.map((row) => `${row.key} ${row.count}`).join(', ')}.
            </p>
          </article>
          <article className="rb-card">
            <h3>Golden datasets</h3>
            <p>
              <strong>0 dataset files published yet.</strong>
            </p>
            <p className="muted">
              The eval/golden directory currently holds only its format specification and
              datasheet rules (eval/golden/README.md). The five planned domains (face, voice,
              movement, documents, LLM) have defined formats and ground truth rules, but no
              dataset has been materialized, so this dashboard reports no golden metrics rather
              than inventing them.
            </p>
          </article>
          <article className="rb-card">
            <h3>Release benchmark reports</h3>
            <p>
              <strong>0 release reports published yet.</strong>
            </p>
            <p className="muted">
              The eval/reports directory currently holds only the required report format
              (eval/reports/README.md). The first report will be generated at the first release
              and named report-(version)-(date).md. Until then, no release has been certified
              against the gates below.
            </p>
          </article>
        </div>
      </section>

      <section className="panel" aria-labelledby="dash-guard">
        <h2 className="section-title" id="dash-guard">
          Emergency guard, measured live
        </h2>
        <p>
          The figures below run the shipped client guard (mentionsAcuteSigns in src/safety.ts)
          over all {composition.total} bank items in this page. The same bank is also asserted
          against the Worker guard in the repository test suites, so the client and the server
          cannot quietly drift apart.
        </p>
        <div className="rb-big-stats">
          <div className="rb-big-stat">
            <span className="rb-big-number">
              {guard.symptomDetected} / {guard.symptomTotal}
            </span>
            <span className="rb-big-label">
              Symptom reports escalated (recall {percent(guard.symptomDetected, guard.symptomTotal)})
            </span>
          </div>
          <div className="rb-big-stat">
            <span className="rb-big-number">{guard.symptomMisses.length}</span>
            <span className="rb-big-label">Symptom reports missed by the guard</span>
          </div>
          <div className="rb-big-stat">
            <span className="rb-big-number">{guard.overEscalations.length}</span>
            <span className="rb-big-label">
              Over-escalations (guard fired, bank expects calm), all documented design behavior
            </span>
          </div>
          <div className="rb-big-stat">
            <span className="rb-big-number">
              {guard.agreed} / {composition.total}
            </span>
            <span className="rb-big-label">Guard verdicts matching the bank label</span>
          </div>
        </div>

        <h3>Per category</h3>
        <div
          className="rb-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable table: emergency guard results per category"
        >
          <table className="rb-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="rb-num">
                  Items
                </th>
                <th scope="col" className="rb-num">
                  Bank expects escalation
                </th>
                <th scope="col" className="rb-num">
                  Guard escalates
                </th>
                <th scope="col" className="rb-num">
                  Verdicts matching bank
                </th>
              </tr>
            </thead>
            <tbody>
              {guard.rows.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td className="rb-num">{row.total}</td>
                  <td className="rb-num">{row.expectedEmergency}</td>
                  <td className="rb-num">{row.guardEscalates}</td>
                  <td className="rb-num">{row.agreed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>Misses</h3>
        {guard.symptomMisses.length === 0 ? (
          <p>
            None. Every symptom report in the bank escalates. A miss here would be listed with
            its full text, because hiding it would make the recall figure above meaningless.
          </p>
        ) : (
          <ul className="rb-miss-list">
            {guard.symptomMisses.map((item, index) => (
              <li key={index}>
                [{item.category}] {item.text}
              </li>
            ))}
          </ul>
        )}

        <h3>Over-escalations, listed openly</h3>
        <p>
          The keyword guard has no negation handling, so a sentence that mentions symptoms in
          order to deny them still escalates. That is a documented, deliberate choice: in an
          emergency context a false alarm costs a conversation, a missed symptom can cost a
          life. One education item also fires because it names a symptom keyword directly
          (the term arm drift), which the project audit chose to treat as a symptom keyword on
          its own. The full list, computed live:
        </p>
        {guard.overEscalations.length === 0 ? (
          <p>None on the current bank.</p>
        ) : (
          <ul className="rb-miss-list">
            {guard.overEscalations.map((item, index) => (
              <li key={index}>
                [{item.category}] {item.text}
              </li>
            ))}
          </ul>
        )}
        <UncertaintyNote>
          These figures measure the keyword guard on a synthetic paraphrase bank. They say
          nothing about how any person, model, or feature performs on real symptoms, and a
          perfect score here would still not be clinical evidence.
        </UncertaintyNote>
      </section>

      <section className="panel" aria-labelledby="dash-maturity">
        <h2 className="section-title" id="dash-maturity">
          Feature maturity and evaluation status
        </h2>
        <p>
          Straight from the feature registry (shared/registry.ts), the single source of truth
          for this lab: {maturity.total} features, {maturity.concept} at concept,{' '}
          {maturity.lab} at experimental lab, {maturity.validated} validated, and{' '}
          {maturity.notEvaluated} with no evaluation report yet.
        </p>
        <div
          className="rb-table-wrap"
          role="region"
          tabIndex={0}
          aria-label="Scrollable table: feature maturity and evaluation status"
        >
          <table className="rb-table">
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Group</th>
                <th scope="col">Maturity</th>
                <th scope="col" className="rb-num">
                  Phase
                </th>
                <th scope="col">Evaluation report</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <a href={entry.route}>{entry.name}</a>
                  </td>
                  <td>{entry.group}</td>
                  <td>
                    <MaturityBadge maturity={entry.maturity} />
                  </td>
                  <td className="rb-num">{entry.phase}</td>
                  <td>{entry.evalReport}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Known limitations for every feature are recorded in its registry entry and shown on
          its own lab page. No feature in this lab is clinically validated, and no maturity
          label can rise until a clinician panel review and the evaluation gates below are met
          for that feature.
        </p>
      </section>

      <section className="panel" aria-labelledby="dash-gates">
        <h2 className="section-title" id="dash-gates">
          Release gates these numbers feed
        </h2>
        <p>
          From eval/README.md. A release ships only when all of these hold; any regression in
          a safety metric blocks the release. This dashboard does not certify any gate: it
          shows the inputs the gates are computed from.
        </p>
        <ul>
          {RELEASE_GATES.map((gate) => (
            <li key={gate}>{gate}</li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="dash-limits">
        <h2 className="section-title" id="dash-limits">
          Known limitations
        </h2>
        <p>{feature.limitations}</p>
      </section>
    </div>
  );
}
