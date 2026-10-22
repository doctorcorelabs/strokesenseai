// Document Studio: one paste box, two local parsers, three outputs.
// This replaces the separate Discharge Lens, Risk Factor Extractor, and
// Plain-Language Translator pages. Detection only decides which output
// leads; both extractions are always computed, so a hybrid document
// never ends in an empty page. There is no consent checkbox and no
// redaction step here on purpose: nothing is sent anywhere, so there is
// nothing to consent to and nothing to unlock. The pure parsers from the
// old document groups are imported and called directly (see detect.ts);
// the old extract.ts wrappers are deliberately not used because their
// personal-data guard exists to gate an upload path this studio does
// not have.

import { useMemo, useState } from 'react';

import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet } from '../../../shell';
import { detectDocument, type DetectionResult, type DocumentKind } from './detect';
import { dischargeCategoryLabel } from '../../document-clinical/discharge-parser';
import { riskFactorEducation } from '../../document-clinical/risk-parser';
import {
  DISCHARGE_SAMPLES,
  RISK_SAMPLES,
  type DocumentSample,
} from '../../document-clinical/samples';
import type {
  DischargeCategory,
  DischargeExtraction,
  RiskExtraction,
} from '../../document-clinical/types';
import {
  plainRewriteLocal,
  readabilityStats,
  verifyPreserved,
} from '../../document-knowledge/plain-text';
import './document-studio.css';

const MAX_CHARS = 20000;
const HONEST_LABEL = 'Checked on this device - no AI, no OCR, nothing uploaded';
const CATEGORY_ORDER: DischargeCategory[] = [
  'diagnosis',
  'medication',
  'follow-up',
  'warning-sign',
  'activity',
];

type TabId = 'checklist' | 'risk' | 'plain';

const RISK_STATUS_LABEL: Record<string, string> = {
  present: 'Mentioned',
  absent_stated: 'Said no',
  not_mentioned: 'Not mentioned',
};

function ChecklistBlock({ extraction }: { extraction: DischargeExtraction }) {
  if (extraction.facts.length === 0) {
    return (
      <p className="muted">
        No discharge lines were recognized in this text. The risk profile and plain language
        tabs still ran on the same text.
      </p>
    );
  }
  return (
    <div>
      {CATEGORY_ORDER.map((category) => {
        const facts = extraction.facts.filter((fact) => fact.category === category);
        if (facts.length === 0) return null;
        return (
          <div key={category} className="ds-category">
            <h3>{dischargeCategoryLabel(category)}</h3>
            <ul className="ds-fact-list">
              {facts.map((fact) => (
                <li key={fact.id} className="ds-fact">
                  <p className="ds-fact-label">
                    {fact.label}
                    {fact.status === 'verified' ? (
                      <span className="badge badge-verified">Wording verified</span>
                    ) : null}
                  </p>
                  {fact.detail !== fact.label ? <p>{fact.detail}</p> : null}
                  {fact.doseText ? (
                    <p className="muted">Dose and schedule, exactly as written: {fact.doseText}</p>
                  ) : null}
                  {fact.flags.map((flag) => (
                    <p key={flag} className="ds-flag">
                      {flag}
                    </p>
                  ))}
                  <p className="ds-source">
                    Source line {fact.sourceLineIds.join(', ')}: &ldquo;{fact.sourceQuote}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {extraction.notes.length > 0 ? (
        <div className="ds-notes">
          <h3>Parser notes</h3>
          <ul>
            {extraction.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RiskBlock({ extraction }: { extraction: RiskExtraction }) {
  const stated = extraction.results.filter((result) => result.status !== 'not_mentioned');
  const notMentioned = extraction.results.filter(
    (result) => result.status === 'not_mentioned',
  );
  return (
    <div>
      {stated.length === 0 ? (
        <p className="muted">
          None of the 10 fixed risk factors were mentioned in this text. That is shown
          openly, not filled in.
        </p>
      ) : (
        <ul className="ds-risk-list">
          {stated.map((result) => (
            <li key={result.factor} className="ds-risk-card">
              <p className="ds-risk-head">
                <strong>{result.label}</strong>
                <span className="badge">{RISK_STATUS_LABEL[result.status]}</span>
              </p>
              {result.evidenceSpan ? (
                <p className="ds-source">&ldquo;{result.evidenceSpan}&rdquo;</p>
              ) : null}
              {result.note ? <p className="muted">{result.note}</p> : null}
              <p className="muted">{riskFactorEducation(result.factor)}</p>
            </li>
          ))}
        </ul>
      )}
      {notMentioned.length > 0 ? (
        <p className="ds-not-mentioned">
          Not mentioned in this text: {notMentioned.map((result) => result.label).join(', ')}.
          Not mentioned never means absent.
        </p>
      ) : null}
    </div>
  );
}

function PlainLanguageBlock({ text }: { text: string }) {
  const rewrite = useMemo(() => plainRewriteLocal(text, 'en'), [text]);
  const verification = useMemo(() => verifyPreserved(text, rewrite.text), [text, rewrite.text]);
  const stats = useMemo(() => readabilityStats(rewrite.text), [rewrite.text]);

  if (!verification.ok) {
    // The locked-element check failed: the rewrite is refused, not shown
    // with the problem hidden. This mirrors the old translator behaviour.
    const problems: string[] = [
      ...verification.missingNumbers.map((value) => `Number lost: ${value}`),
      ...verification.addedNumbers.map((value) => `Number added: ${value}`),
      ...verification.missingMedicines.map((value) => `Medicine lost: ${value}`),
      ...verification.addedMedicines.map((value) => `Medicine added: ${value}`),
    ];
    return (
      <div className="ds-rejected">
        <h3>Plain-language version refused</h3>
        <p>
          The safety check compares every number, dose, date, and medicine name before and
          after the rewrite. It found differences, so the rewritten text is not shown:
        </p>
        <ul>
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <p className="ds-plain-text">{rewrite.text}</p>
      <p className="muted">
        Safety check passed: every number, dose, date, and medicine name in the original is
        unchanged. {rewrite.replacedTerms.length} medical term(s) were swapped for everyday
        words from the built-in glossary. Readability of the rewrite: {stats.label}.
      </p>
    </div>
  );
}

function StudioTabs({
  detection,
  sourceText,
  leadKind,
  exampleLabel,
}: {
  detection: DetectionResult;
  sourceText: string;
  leadKind: DocumentKind;
  exampleLabel?: boolean;
}) {
  const [tab, setTab] = useState<TabId>(leadKind === 'history' ? 'risk' : 'checklist');
  return (
    <div>
      {exampleLabel ? <p className="badge badge-mode">Example result</p> : null}
      {leadKind === 'unknown' ? (
        <p className="ds-unknown">
          We could not tell what kind of text this is. Both checks ran anyway, and the plain
          language version is under its tab. Trying one of the samples shows the full output.
        </p>
      ) : null}
      <div className="ds-tabs" role="tablist" aria-label="Document outputs">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'checklist'}
          className={tab === 'checklist' ? 'ds-tab ds-tab-active' : 'ds-tab'}
          onClick={() => setTab('checklist')}
        >
          Checklist{leadKind === 'history' ? ' (also found in this text)' : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'risk'}
          className={tab === 'risk' ? 'ds-tab ds-tab-active' : 'ds-tab'}
          onClick={() => setTab('risk')}
        >
          Risk profile{leadKind === 'discharge' ? ' (also found in this text)' : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'plain'}
          className={tab === 'plain' ? 'ds-tab ds-tab-active' : 'ds-tab'}
          onClick={() => setTab('plain')}
        >
          Plain language
        </button>
      </div>
      {tab === 'checklist' ? <ChecklistBlock extraction={detection.discharge} /> : null}
      {tab === 'risk' ? <RiskBlock extraction={detection.risk} /> : null}
      {tab === 'plain' ? <PlainLanguageBlock text={sourceText} /> : null}
    </div>
  );
}

interface Analysis {
  text: string;
  detection: DetectionResult;
}

export default function DocumentStudio() {
  const feature = getFeature('document-studio')!;
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [kindOverride, setKindOverride] = useState<DocumentKind | null>(null);

  const exampleDetection = useMemo(
    () => detectDocument(DISCHARGE_SAMPLES[0].text),
    [],
  );

  const leadKind: DocumentKind = kindOverride ?? analysis?.detection.kind ?? 'unknown';
  const stale = analysis !== null && analysis.text !== text;
  const overLimit = text.length > MAX_CHARS;

  function runAnalysis(value: string) {
    setAnalysis({ text: value, detection: detectDocument(value) });
    setKindOverride(null);
  }

  function loadSample(sample: DocumentSample) {
    setText(sample.text);
    runAnalysis(sample.text);
  }

  const samples: DocumentSample[] = [
    DISCHARGE_SAMPLES[0],
    RISK_SAMPLES[0],
    RISK_SAMPLES[1],
    DISCHARGE_SAMPLES[1],
  ];

  const example = (
    <section className="panel">
      <h2 className="section-title">See a finished example</h2>
      <p>
        This fictional discharge summary was checked with the same rules you will use. All
        three outputs below come from the one document.
      </p>
      <details className="ds-example-source">
        <summary>Read the example document</summary>
        <pre>{DISCHARGE_SAMPLES[0].text}</pre>
      </details>
      <StudioTabs
        detection={exampleDetection}
        sourceText={DISCHARGE_SAMPLES[0].text}
        leadKind={exampleDetection.kind}
        exampleLabel
      />
    </section>
  );

  const tryIt = (
    <section className="panel">
      <h2 className="section-title">Paste a document</h2>
      <p>
        Paste a discharge summary or a health history story. The studio reads it on this
        device and shows what it found, line by line.
      </p>
      <p className="muted">{HONEST_LABEL}. Processed on this device. Nothing is sent or stored.</p>
      <div className="ds-samples">
        {samples.map((sample) => (
          <button
            key={sample.id}
            type="button"
            className="btn btn-secondary"
            onClick={() => loadSample(sample)}
          >
            {sample.title}
          </button>
        ))}
      </div>
      <p className="muted">Samples are fictional. One tap loads a sample and checks it right away.</p>
      <label className="ds-label" htmlFor="ds-input">
        Your document text
      </label>
      <textarea
        id="ds-input"
        className="ds-textarea"
        rows={12}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste the document text here, or use one of the fictional samples above."
      />
      <p className="muted">
        {text.length} of {MAX_CHARS} characters.
        {overLimit ? ' This text is too long for the studio; shorten it before checking.' : ''}
      </p>
      {analysis ? (
        <div className="ds-detect-row">
          <span className="badge badge-mode">
            {leadKind === 'discharge'
              ? 'Detected: Discharge summary'
              : leadKind === 'history'
                ? 'Detected: Health history'
                : 'Detected: kind not clear'}
          </span>
          {leadKind !== 'unknown' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setKindOverride(leadKind === 'discharge' ? 'history' : 'discharge')
              }
            >
              {leadKind === 'discharge' ? 'Switch to Health history' : 'Switch to Discharge summary'}
            </button>
          ) : null}
          {stale ? (
            <span className="ds-stale">Text changed, check again to refresh results.</span>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={text.trim().length === 0 || overLimit}
        onClick={() => runAnalysis(text)}
      >
        Check this document
      </button>
    </section>
  );

  const headline =
    leadKind === 'discharge'
      ? `We found ${analysis?.detection.discharge.facts.length ?? 0} facts in this discharge summary, each tied to its source line.`
      : leadKind === 'history'
        ? `We found ${analysis?.detection.riskFactorsFound ?? 0} of the 10 fixed risk factors mentioned in this history.`
        : 'We could not tell what kind of text this is, so both checks were run on it anyway.';

  const result = analysis ? (
    <ResultSheet
      headline={headline}
      limitLine={`${HONEST_LABEL}. Checked with fixed rules; extraction can be wrong and the original document always wins.`}
      modeLabel="On this device"
    >
      <StudioTabs
        detection={analysis.detection}
        sourceText={analysis.text}
        leadKind={leadKind}
      />
    </ResultSheet>
  ) : undefined;

  return <LabShell feature={feature} example={example} tryIt={tryIt} result={result} />;
}
