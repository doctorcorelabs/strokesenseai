// Discharge Lens AI: workspace page.
// Paste a discharge summary (synthetic samples provided) and get a
// structured checklist where every fact cites its source line. Extraction
// runs locally with a deterministic rule engine; the personal-data guard
// blocks analysis while likely personal data is present. Nothing is sent
// or stored. Design contract: PLANNING.md section 6.6, feature 20.

import { useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import PrivacyBanner from './PrivacyBanner';
import { analyzeDischargeText } from './extract';
import type { ExtractionOutcome } from './extract';
import { PiiBlockedError, redactPii } from './pii';
import { CARE_TEAM_QUESTIONS, dischargeCategoryLabel } from './discharge-parser';
import { DISCHARGE_SAMPLES } from './samples';
import type { DischargeCategory, DischargeExtraction, DischargeFact, PiiFinding } from './types';
import './document-clinical.css';

const CATEGORY_ORDER: DischargeCategory[] = [
  'diagnosis',
  'medication',
  'follow-up',
  'warning-sign',
  'activity',
];

export default function DischargeLens() {
  const feature = getFeature('discharge-lens');
  const [text, setText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ExtractionOutcome<DischargeExtraction> | null>(null);
  const [piiFindings, setPiiFindings] = useState<PiiFinding[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  const result = outcome?.data ?? null;
  const selectedFact = result?.facts.find((fact) => fact.id === selectedFactId) ?? null;
  const highlightedLines = new Set(selectedFact ? selectedFact.sourceLineIds : []);
  const unreadableIds = new Set(result?.unreadableLines.map((line) => line.id) ?? []);

  function resetResult() {
    setOutcome(null);
    setSelectedFactId(null);
    setPiiFindings(null);
  }

  function loadSample(sampleText: string) {
    setText(sampleText);
    setConfirmed(false);
    setNotice(null);
    resetResult();
  }

  function editText(value: string) {
    setText(value);
    setConfirmed(false);
    setNotice(null);
    resetResult();
  }

  function clearDocument() {
    setText('');
    setConfirmed(false);
    setNotice(null);
    resetResult();
  }

  async function analyze() {
    setBusy(true);
    setNotice(null);
    setPiiFindings(null);
    try {
      const next = await analyzeDischargeText(text);
      setOutcome(next);
      setSelectedFactId(null);
    } catch (caught) {
      if (caught instanceof PiiBlockedError) {
        setPiiFindings(caught.findings);
        setOutcome(null);
      } else {
        setNotice('The local analysis could not run. Check the text and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  function applyRedactions() {
    if (!piiFindings) return;
    setText(redactPii(text, piiFindings));
    setPiiFindings(null);
    setConfirmed(false);
    setNotice(
      'The flagged patterns were replaced with [removed]. Review the text, confirm the checkbox, then run the analysis again.',
    );
  }

  function factsIn(category: DischargeCategory): DischargeFact[] {
    return result?.facts.filter((fact) => fact.category === category) ?? [];
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature?.group ?? 'Document and Data AI'}</p>
        <h1>{feature?.name ?? 'Discharge Lens AI'}</h1>
        <p className="muted">{feature?.tagline}</p>
        <div className="badge-row">
          {feature && <MaturityBadge maturity={feature.maturity} />}
          <ModeBadge mode="offline" />
        </div>
      </header>

      <EmergencyBanner />
      <PrivacyBanner noun="discharge document" />

      <section className="panel" aria-labelledby="dl-input-title">
        <h2 className="section-title" id="dl-input-title">
          Discharge text
        </h2>
        <p className="muted">
          Start with a synthetic sample, or paste discharge text that contains no personal data.
          The analysis runs locally in your browser with a deterministic rule engine; no AI
          request is sent and nothing is stored.
        </p>
        <div className="dc-sample-row" role="group" aria-label="Synthetic samples">
          {DISCHARGE_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="btn btn-ghost"
              onClick={() => loadSample(sample.text)}
            >
              {sample.title}
            </button>
          ))}
        </div>
        <label className="form-label" htmlFor="dl-text">
          Discharge summary text
        </label>
        <textarea
          id="dl-text"
          className="form-input"
          rows={14}
          value={text}
          onChange={(event) => editText(event.target.value)}
          placeholder="Paste de-identified discharge text here, or load a synthetic sample above."
        />
        <label className="consent-box">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="consent-text">
            <span>
              This text is a synthetic sample, or text I have fully de-identified and may use for
              learning. It contains no real patient information.
            </span>
          </span>
        </label>
        <div className="dc-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!confirmed || !text.trim() || busy}
            onClick={analyze}
          >
            {busy ? 'Analyzing...' : 'Analyze locally'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearDocument}>
            Clear document
          </button>
        </div>
        {notice && (
          <p role="status" className="muted">
            {notice}
          </p>
        )}
      </section>

      {piiFindings && (
        <section className="dc-blocked" role="alert" aria-labelledby="dl-blocked-title">
          <h2 className="section-title" id="dl-blocked-title">
            Analysis blocked: possible personal data found
          </h2>
          <p>
            The local privacy check found the patterns below. Remove them, or insert the automatic
            redactions, before any analysis can run.
          </p>
          <ul>
            {piiFindings.map((finding, index) => (
              <li key={`${finding.kind}-${finding.index}-${index}`}>
                <strong>{finding.description}</strong> Found: &quot;{finding.match}&quot;
              </li>
            ))}
          </ul>
          <div className="dc-actions">
            <button type="button" className="btn btn-primary" onClick={applyRedactions}>
              Insert redactions
            </button>
          </div>
        </section>
      )}

      {result && (
        <div className="dc-layout">
          <section className="panel" aria-labelledby="dl-source-title">
            <h2 className="section-title" id="dl-source-title">
              Source text with line numbers
            </h2>
            <p className="muted">
              Select a fact to highlight the exact line it was extracted from.
            </p>
            <ol className="dc-lines">
              {result.sourceLines.map((line) => (
                <li
                  key={line.id}
                  className={[
                    'dc-line',
                    highlightedLines.has(line.id) ? 'dc-line-active' : '',
                    unreadableIds.has(line.id) ? 'dc-line-unreadable' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="dc-line-num">{line.id}</span>
                  <span>{line.text}</span>
                </li>
              ))}
            </ol>
            {result.unreadableLines.length > 0 && (
              <p className="muted">
                Lines marked unreadable were not extracted:{' '}
                {result.unreadableLines.map((line) => `line ${line.id}`).join(', ')}. Read them
                on the original document.
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="dl-results-title">
            <h2 className="section-title" id="dl-results-title">
              Extracted checklist
            </h2>
            <p className="muted">
              Engine: local rule engine (offline). Relative dates such as &quot;in two weeks&quot;
              are shown exactly as written and are never converted into calendar dates. Doses are
              kept as raw text.
            </p>
            {CATEGORY_ORDER.map((category) => {
              const facts = factsIn(category);
              return (
                <div className="dc-category" key={category}>
                  <h3>{dischargeCategoryLabel(category)}</h3>
                  {facts.length === 0 && (
                    <p className="muted">Nothing was extracted in this category.</p>
                  )}
                  {facts.map((fact) => (
                    <article
                      key={fact.id}
                      className={`dc-fact${fact.id === selectedFactId ? ' dc-fact-selected' : ''}`}
                    >
                      <div className="dc-fact-head">
                        <strong>{fact.label}</strong>
                        <span
                          className={`dc-chip ${fact.status === 'verified' ? 'dc-chip-verified' : 'dc-chip-unverified'}`}
                        >
                          {fact.status === 'verified' ? 'Verified' : 'Unverified'}
                        </span>
                      </div>
                      {fact.doseText && (
                        <p className="dc-fact-detail">
                          Dose and schedule, as written: {fact.doseText}
                        </p>
                      )}
                      {fact.detail !== fact.label && <p className="dc-fact-detail">{fact.detail}</p>}
                      <div className="dc-actions">
                        <button
                          type="button"
                          className="dc-chip"
                          aria-pressed={fact.id === selectedFactId}
                          onClick={() =>
                            setSelectedFactId(fact.id === selectedFactId ? null : fact.id)
                          }
                        >
                          {fact.id === selectedFactId ? 'Hide source' : `Show source: line ${fact.sourceLineIds.join(', ')}`}
                        </button>
                        {fact.flags.map((flag) => (
                          <span key={flag} className="dc-chip dc-chip-flag">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}
            {result.notes.length > 0 && (
              <div>
                <h3>Parser notes</h3>
                <ul>
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            <UncertaintyNote>
              Extraction can be wrong, including facts marked verified: verified only means the
              words match the cited line, not that the line itself is correct. Always check
              against the original paper.
            </UncertaintyNote>
          </section>
        </div>
      )}

      {result && (
        <section className="panel" aria-labelledby="dl-questions-title">
          <h2 className="section-title" id="dl-questions-title">
            Questions to ask the care team
          </h2>
          <p className="muted">
            A static template to take to the treating team. It is not medical advice.
          </p>
          <ul>
            {CARE_TEAM_QUESTIONS.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      )}

      {feature && (
        <section className="panel" aria-labelledby="dl-limits-title">
          <h2 className="section-title" id="dl-limits-title">
            Known limitations
          </h2>
          <p>{feature.limitations}</p>
        </section>
      )}
    </div>
  );
}
