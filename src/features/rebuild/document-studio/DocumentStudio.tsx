// Document Studio: a paste-text path checked on this device, and a
// separate photo path read by the AI service.
//
// The paste path replaces the separate Discharge Lens, Risk Factor
// Extractor, and Plain-Language Translator pages. Detection only
// decides which output leads; both extractions are always computed,
// so a hybrid document never ends in an empty page. It has no consent
// checkbox and no redaction step on purpose: nothing is sent
// anywhere, so there is nothing to consent to and nothing to unlock.
// The pure parsers from the old document groups are imported and
// called directly (see detect.ts); the old extract.ts wrappers are
// deliberately not used because their personal-data guard exists to
// gate an upload path the paste tools do not have.
//
// The photo path is opt-in and labelled as a different source
// everywhere it appears. Nothing is sent when a photo is picked; the
// photo leaves this device only when the person taps the analyze
// button, and it goes to the AI service through the Worker
// (analyzeWithAi, task 'document-photo'). Its sheet is labelled Live
// AI and carries its own framing line, so an AI reading of a photo is
// never mistaken for the on-device text check above it.

import { useMemo, useState, type ReactNode } from 'react';

import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet, UploadPanel } from '../../../shell';
import { EmergencyBanner } from '../../../components/ui';
import { analyzeWithAi } from '../../../ai/visionClient';
import { imageFileToDataUrl } from '../../../ml/analyze';
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
const PHOTO_PRIVACY_LINE =
  'Your photo is sent to the AI service for analysis. The pasted-text tools on this page stay fully on this device.';
const AI_FRAMING_LINE =
  'The AI reads and summarizes what it can see in the photo. Check every item against the original document; the AI can misread handwriting, doses, and names.';
const CATEGORY_ORDER: DischargeCategory[] = [
  'diagnosis',
  'medication',
  'follow-up',
  'warning-sign',
  'activity',
];

type TabId = 'checklist' | 'risk' | 'plain';

type InputMode = 'paste' | 'photo';

type PhotoOutcome =
  | { kind: 'done'; headline: string; observations: string[] }
  | { kind: 'cannot'; reason: string }
  | { kind: 'emergency' }
  | { kind: 'error'; message: string };

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
  const [inputMode, setInputMode] = useState<InputMode>('paste');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState<'preparing' | 'analyzing' | null>(null);
  const [photoOutcome, setPhotoOutcome] = useState<PhotoOutcome | null>(null);
  const [activeResult, setActiveResult] = useState<InputMode>('paste');

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
    setActiveResult('paste');
  }

  function loadSample(sample: DocumentSample) {
    setText(sample.text);
    runAnalysis(sample.text);
  }

  async function handlePhotoFile(file: File) {
    setPhotoBusy('preparing');
    setPhotoOutcome(null);
    try {
      const dataUrl = await imageFileToDataUrl(file, 1024);
      setPhotoDataUrl(dataUrl);
    } catch {
      setPhotoDataUrl(null);
      setPhotoOutcome({
        kind: 'error',
        message:
          'That photo could not be opened on this device. Choose a different photo, for example a JPG or PNG from your gallery.',
      });
      setActiveResult('photo');
    } finally {
      setPhotoBusy(null);
    }
  }

  function clearPhoto() {
    setPhotoDataUrl(null);
    setPhotoOutcome(null);
  }

  async function runPhotoAnalysis() {
    if (!photoDataUrl || photoBusy !== null) return;
    setPhotoBusy('analyzing');
    try {
      const res = await analyzeWithAi({ task: 'document-photo', images: [photoDataUrl] });
      if (res.emergency) {
        setPhotoOutcome({ kind: 'emergency' });
      } else if (res.cannotAnalyze) {
        setPhotoOutcome({
          kind: 'cannot',
          reason:
            res.reason ?? 'The AI could not read this photo clearly enough to describe it.',
        });
      } else {
        setPhotoOutcome({
          kind: 'done',
          headline: res.headline,
          observations: res.observations,
        });
      }
    } catch {
      setPhotoOutcome({
        kind: 'error',
        message:
          'The photo analysis did not finish. The connection may have dropped, or the AI service may be busy right now.',
      });
    } finally {
      setPhotoBusy(null);
      setActiveResult('photo');
    }
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

  const pasteTools = (
    <>
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
    </>
  );

  const photoTools = (
    <>
      <p>
        Photograph a discharge summary or a medicine list and let the AI service read the
        photo. This is a different tool from the text check: the photo leaves this device,
        and the AI reading can be wrong, so every item still needs checking against the
        paper original.
      </p>
      <p>
        <span className="badge badge-mode">Source: AI photo analysis</span>
      </p>
      <UploadPanel
        accept="image"
        label="Upload a photo of the document"
        hint="A discharge summary or a medicine list, photographed straight on in bright light, with the whole page in frame."
        privacyLine={PHOTO_PRIVACY_LINE}
        onFile={(file) => void handlePhotoFile(file)}
        onClear={clearPhoto}
        disabled={photoBusy !== null}
      />
      {photoBusy === 'preparing' ? (
        <p className="muted ds-photo-status">Preparing your photo on this device...</p>
      ) : null}
      {photoDataUrl && photoBusy !== 'preparing' ? (
        <p className="muted ds-photo-status">
          Photo ready. Nothing has been sent yet; sending happens only when you tap the
          button below.
        </p>
      ) : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={!photoDataUrl || photoBusy !== null}
        onClick={() => void runPhotoAnalysis()}
      >
        {photoBusy === 'analyzing' ? 'Analyzing photo...' : 'Analyze photo with AI'}
      </button>
    </>
  );

  const tryIt = (
    <section className="panel">
      <h2 className="section-title">Check a document</h2>
      <div className="ds-tabs" role="group" aria-label="How to add your document">
        <button
          type="button"
          aria-pressed={inputMode === 'paste'}
          className={inputMode === 'paste' ? 'ds-tab ds-tab-active' : 'ds-tab'}
          onClick={() => setInputMode('paste')}
        >
          Paste text
        </button>
        <button
          type="button"
          aria-pressed={inputMode === 'photo'}
          className={inputMode === 'photo' ? 'ds-tab ds-tab-active' : 'ds-tab'}
          onClick={() => setInputMode('photo')}
        >
          Upload a photo
        </button>
      </div>
      {inputMode === 'paste' ? pasteTools : photoTools}
    </section>
  );

  const headline =
    leadKind === 'discharge'
      ? `We found ${analysis?.detection.discharge.facts.length ?? 0} facts in this discharge summary, each tied to its source line.`
      : leadKind === 'history'
        ? `We found ${analysis?.detection.riskFactorsFound ?? 0} of the 10 fixed risk factors mentioned in this history.`
        : 'We could not tell what kind of text this is, so both checks were run on it anyway.';

  const pasteResult = analysis ? (
    <ResultSheet
      headline={headline}
      limitLine={`${HONEST_LABEL}. Checked with fixed rules; extraction can be wrong and the original document always wins.`}
      modeLabel="On this device"
    >
      <p>
        <span className="badge badge-mode">Source: pasted text, checked on this device</span>
      </p>
      <StudioTabs
        detection={analysis.detection}
        sourceText={analysis.text}
        leadKind={leadKind}
      />
    </ResultSheet>
  ) : undefined;

  let photoResult: ReactNode = undefined;
  if (photoOutcome?.kind === 'done') {
    photoResult = (
      <ResultSheet
        headline={photoOutcome.headline}
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
      >
        <h3 className="ds-ai-title">AI analysis of your photo</h3>
        <p>
          <span className="badge badge-mode">Source: AI photo analysis</span>
        </p>
        {photoOutcome.observations.length > 0 ? (
          <ul className="ds-ai-list">
            {photoOutcome.observations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">The AI returned no readable items for this photo.</p>
        )}
      </ResultSheet>
    );
  } else if (photoOutcome?.kind === 'cannot') {
    photoResult = (
      <ResultSheet
        headline="The AI could not read this photo"
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
        cannotAnalyze={{
          reason: photoOutcome.reason,
          suggestion:
            'Try a brighter photo taken straight on with the whole page in frame, or switch to Paste text and let this device check the document instead.',
        }}
      />
    );
  } else if (photoOutcome?.kind === 'emergency') {
    photoResult = (
      <section className="panel">
        <EmergencyBanner variant="full" />
      </section>
    );
  } else if (photoOutcome?.kind === 'error') {
    photoResult = (
      <section className="panel">
        <h2 className="section-title">The photo analysis did not finish</h2>
        <p>{photoOutcome.message}</p>
        {photoDataUrl ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={photoBusy !== null}
            onClick={() => void runPhotoAnalysis()}
          >
            Try again
          </button>
        ) : (
          <p className="muted">Choose another photo above to try again.</p>
        )}
      </section>
    );
  }

  const result =
    activeResult === 'photo' && photoResult ? photoResult : pasteResult;

  return <LabShell feature={feature} example={example} tryIt={tryIt} result={result} />;
}
