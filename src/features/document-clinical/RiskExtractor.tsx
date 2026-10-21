// Risk Factor Extractor: workspace page.
// Turns a free-text history into the fixed 10 factor profile. Every status
// is backed by an exact quote from the text, negations are honored, family
// history is never attributed to the patient, and factors the text does
// not mention are listed as not mentioned. There is deliberately no risk
// score, percentage, or stratification. Design: PLANNING.md section 6.6,
// feature 21.

import { useState } from 'react';
import { getFeature } from '../../../shared/registry';
import {
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import PrivacyBanner from './PrivacyBanner';
import { analyzeRiskText } from './extract';
import type { ExtractionOutcome } from './extract';
import { PiiBlockedError, redactPii } from './pii';
import { riskFactorEducation, riskFactorLabel } from './risk-parser';
import { RISK_SAMPLES } from './samples';
import type { PiiFinding, RiskExtraction, RiskFactorResult, RiskFactorStatus } from './types';
import './document-clinical.css';

const MAX_CHARS = 2000;

const STATUS_LABELS: Record<RiskFactorStatus, string> = {
  present: 'Present',
  absent_stated: 'Stated absent',
  not_mentioned: 'Not mentioned',
};

const STATUS_CLASSES: Record<RiskFactorStatus, string> = {
  present: 'dc-status dc-status-present',
  absent_stated: 'dc-status dc-status-absent',
  not_mentioned: 'dc-status dc-status-not',
};

export default function RiskExtractor() {
  const feature = getFeature('risk-extractor');
  const [text, setText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ExtractionOutcome<RiskExtraction> | null>(null);
  const [piiFindings, setPiiFindings] = useState<PiiFinding[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedFactor, setSelectedFactor] = useState<string | null>(null);

  const result = outcome?.data ?? null;
  const selected = result?.results.find((entry) => entry.factor === selectedFactor) ?? null;
  const presentFactors = result?.results.filter((entry) => entry.status === 'present') ?? [];

  function resetResult() {
    setOutcome(null);
    setSelectedFactor(null);
    setPiiFindings(null);
  }

  function loadSample(sampleText: string) {
    setText(sampleText.slice(0, MAX_CHARS));
    setConfirmed(false);
    setNotice(null);
    resetResult();
  }

  function editText(value: string) {
    setText(value.slice(0, MAX_CHARS));
    setConfirmed(false);
    setNotice(null);
    resetResult();
  }

  function clearText() {
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
      const next = await analyzeRiskText(text);
      setOutcome(next);
      setSelectedFactor(null);
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

  function evidenceCell(entry: RiskFactorResult) {
    if (!entry.evidenceSpan) return <span className="muted">No quote in the text</span>;
    return (
      <span className="dc-evidence">
        &quot;{entry.evidenceSpan}&quot;{' '}
        {entry.evidenceValid ? (
          <span className="dc-chip dc-chip-verified">Verbatim quote</span>
        ) : (
          <span className="dc-chip dc-chip-unverified">Quote not verified</span>
        )}{' '}
        <button
          type="button"
          className="dc-chip"
          aria-pressed={selectedFactor === entry.factor}
          onClick={() => setSelectedFactor(selectedFactor === entry.factor ? null : entry.factor)}
        >
          {selectedFactor === entry.factor ? 'Hide in text' : 'Show in text'}
        </button>
      </span>
    );
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature?.group ?? 'Document and Data AI'}</p>
        <h1>{feature?.name ?? 'Risk Factor Extractor'}</h1>
        <p className="muted">{feature?.tagline}</p>
        <div className="badge-row">
          {feature && <MaturityBadge maturity={feature.maturity} />}
          <ModeBadge mode="offline" />
        </div>
      </header>

      <EmergencyBanner />
      <PrivacyBanner noun="clinical note" />

      <section className="panel" aria-labelledby="rx-input-title">
        <h2 className="section-title" id="rx-input-title">
          History text
        </h2>
        <p className="muted">
          Type or paste a short history (up to {MAX_CHARS} characters, English or Bahasa
          Indonesia), or load a fictional example. The profile is computed locally with a
          deterministic rule engine; nothing is sent or stored. This tool never calculates a
          risk score, percentage, or risk level.
        </p>
        <div className="dc-sample-row" role="group" aria-label="Fictional examples">
          {RISK_SAMPLES.map((sample) => (
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
        <label className="form-label" htmlFor="rx-text">
          History text
        </label>
        <textarea
          id="rx-text"
          className="form-input"
          rows={8}
          maxLength={MAX_CHARS}
          value={text}
          onChange={(event) => editText(event.target.value)}
          placeholder="Paste a de-identified history here, or load a fictional example above."
        />
        <p className="dc-char-count" aria-live="polite">
          {text.length} / {MAX_CHARS} characters
        </p>
        <label className="consent-box">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span className="consent-text">
            <span>
              This text is a fictional example, or text I have fully de-identified and may use
              for learning. It contains no real patient information.
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
            {busy ? 'Analyzing...' : 'Extract profile locally'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearText}>
            Clear text
          </button>
        </div>
        {notice && (
          <p role="status" className="muted">
            {notice}
          </p>
        )}
      </section>

      {piiFindings && (
        <section className="dc-blocked" role="alert" aria-labelledby="rx-blocked-title">
          <h2 className="section-title" id="rx-blocked-title">
            Analysis blocked: possible personal data found
          </h2>
          <p>
            The local privacy check found the patterns below. Remove them, or insert the
            automatic redactions, before any analysis can run.
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
        <>
          <section className="panel" aria-labelledby="rx-profile-title">
            <h2 className="section-title" id="rx-profile-title">
              Risk factor profile (10 fixed factors)
            </h2>
            <p className="muted">
              Engine: local rule engine (offline). Counts:{' '}
              {result.results.filter((entry) => entry.status === 'present').length} present,{' '}
              {result.results.filter((entry) => entry.status === 'absent_stated').length} stated
              absent, {result.notMentioned.length} not mentioned. These counts describe the text
              only; they are not a risk score.
            </p>
            <div className="dc-table-wrap">
              <table className="dc-table">
                <thead>
                  <tr>
                    <th scope="col">Factor</th>
                    <th scope="col">Status</th>
                    <th scope="col">Evidence from your text</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((entry) => (
                    <tr key={entry.factor}>
                      <th scope="row">
                        {entry.label}
                        {entry.note && (
                          <>
                            <br />
                            <span className="muted">{entry.note}</span>
                          </>
                        )}
                      </th>
                      <td>
                        <span className={STATUS_CLASSES[entry.status]}>
                          {STATUS_LABELS[entry.status]}
                        </span>
                      </td>
                      <td>{evidenceCell(entry)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <UncertaintyNote>
              Not mentioned does not mean absent. It only means this text did not state the
              factor, and a real assessment would ask about every factor explicitly.
            </UncertaintyNote>
          </section>

          <section className="panel" aria-labelledby="rx-source-title">
            <h2 className="section-title" id="rx-source-title">
              Your text
            </h2>
            <p className="muted">
              {selected
                ? `Highlighting the evidence for ${selected.label}.`
                : 'Choose "Show in text" next to an evidence quote to highlight its sentence here.'}
            </p>
            <p className="dc-source-text">
              {result.sentences.map((sentence) => (
                <span key={sentence.index}>
                  <span
                    className={
                      selected?.evidenceSentenceIndex === sentence.index
                        ? 'dc-sentence-active'
                        : undefined
                    }
                  >
                    {sentence.text}
                  </span>{' '}
                </span>
              ))}
            </p>
          </section>

          {presentFactors.length > 0 && (
            <section className="panel" aria-labelledby="rx-edu-title">
              <h2 className="section-title" id="rx-edu-title">
                About the factors found in this text
              </h2>
              <p className="muted">
                Static education cards for learning. They describe each factor in general and
                are not advice about any person.
              </p>
              <div className="dc-edu-grid">
                {presentFactors.map((entry) => (
                  <article className="dc-edu-card" key={entry.factor}>
                    <h3>{entry.label}</h3>
                    <p>{riskFactorEducation(entry.factor)}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {result.notMentioned.length > 0 && (
            <section className="panel" aria-labelledby="rx-missing-title">
              <h2 className="section-title" id="rx-missing-title">
                Not mentioned in this text
              </h2>
              <ul>
                {result.notMentioned.map((factorId) => (
                  <li key={factorId}>{riskFactorLabel(factorId)}</li>
                ))}
              </ul>
              <p className="muted">
                Not mentioned never means absent. These factors were simply not stated, and a
                complete history would cover each one explicitly.
              </p>
            </section>
          )}
        </>
      )}

      {feature && (
        <section className="panel" aria-labelledby="rx-limits-title">
          <h2 className="section-title" id="rx-limits-title">
            Known limitations
          </h2>
          <p>{feature.limitations}</p>
        </section>
      )}
    </div>
  );
}
