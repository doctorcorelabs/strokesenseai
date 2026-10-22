// Face Lesion Localizer: one uploaded face photo, one AI reading,
// one result screen of possibilities.
//
// Step 1 (example) is pure presentation. Step 2 is a single upload
// panel and a single button: the photo is prepared on the device and
// nothing is sent anywhere until the person ticks the vision consent
// (or already gave it this session) and presses "Analyze photo". The
// Worker AI endpoint reads the pattern and returns ranked candidate
// lesion levels, the pathway involved, candidate vessels, and
// possibilities to consider. Step 3 is the shared ResultSheet.
//
// Honesty rules held here:
// - The framing is possibility exploration, never a diagnosis, and
//   the closing text to that effect is fixed copy in LesionResult,
//   not model output.
// - A photo the AI cannot read ends in the cannot-analyze variant
//   with a specific reason. No candidates are ever invented locally.
// - The mode label on the sheet is "Live AI": the whole analysis is
//   the server-side vision model, and the registry entry says so.

import { useRef, useState, type ReactNode } from 'react';
import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet, UploadPanel } from '../../../shell';
import { ConsentNotice, EmergencyBanner } from '../../../components/ui';
import { EMERGENCY_TEXT } from '../../../safety';
import { imageFileToDataUrl } from '../../../ml/analyze';
import { hasSessionConsent } from '../../../ai/client';
import { analyzeLocalizer, type LocalizerAnalysis } from '../../../ai/visionClient';
import LesionResultBody from './LesionResult';
import { EXAMPLE_ANALYSIS, toResultView } from './resultModel';
import './lesion-localizer.css';

// The framing line that travels with every localizer result, so the
// sheet itself never lets a possibility read as a diagnosis.
const AI_FRAMING_LINE =
  'AI exploration of possibilities from one photo, in experimental mode. It suggests where a problem could sit; it does not diagnose, and only an in-person examination and brain imaging can confirm a lesion.';

// The exact privacy line the upload picker shows: the on-device
// default would be untrue here, because the photo leaves the device
// (to the AI service, through the Worker) once analysis runs.
const AI_PRIVACY_LINE =
  'Your photo is sent to the AI service for analysis when you press Analyze photo. It is not stored by this site.';

const STATUS_STEPS = [
  'Preparing your photo on this device',
  'Sending your photo to the AI service',
  'Reading the pattern and the possibilities',
];

type Outcome =
  | { kind: 'ai'; analysis: LocalizerAnalysis }
  | { kind: 'ai-cannot'; reason: string };

type Phase = 'empty' | 'preparing' | 'ready' | 'sending' | 'reading' | 'failed' | 'emergency';

function ExamplePanel() {
  return (
    <div>
      <h2 className="section-title">See how the result looks first</h2>
      <p>
        Upload one photo of a face, and this lab explores three things in one screen: the
        pattern of the droop (which parts of the face look weaker, and whether the forehead
        is involved), the places along the corticobulbar pathway (the command pathway from
        the brain to the face muscles) where a lesion, an area of damage, could sit, and the
        conditions that could explain the picture. This finished example uses a teaching
        picture, not a real patient.
      </p>
      <p>
        <span className="badge badge-mode">Example result</span>
      </p>
      <LesionResultBody view={toResultView(EXAMPLE_ANALYSIS)} />
    </div>
  );
}

function UploadWorkspace({
  onOutcome,
  onReset,
}: {
  onOutcome: (outcome: Outcome | null) => void;
  onReset: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('empty');
  const [photo, setPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [failStage, setFailStage] = useState<'prepare' | 'send'>('prepare');
  const [errorMessage, setErrorMessage] = useState('');
  const [emergencyText, setEmergencyText] = useState('');
  const [panelKey, setPanelKey] = useState(0);
  const [sessionAgreed, setSessionAgreed] = useState(() => hasSessionConsent('vision'));
  const [consent, setConsent] = useState(false);
  const [consentPrompt, setConsentPrompt] = useState(false);
  const prepIdRef = useRef(0);

  const busy = phase === 'preparing' || phase === 'sending' || phase === 'reading';
  const agreed = sessionAgreed || consent;

  const clearAll = () => {
    prepIdRef.current += 1;
    onOutcome(null);
    setPhoto(null);
    setErrorMessage('');
    setEmergencyText('');
    setConsentPrompt(false);
    setPhase('empty');
    setPanelKey((value) => value + 1);
  };

  const prepareFile = async (picked: File) => {
    const prepId = prepIdRef.current + 1;
    prepIdRef.current = prepId;
    onOutcome(null);
    setErrorMessage('');
    setEmergencyText('');
    setConsentPrompt(false);
    setPhase('preparing');
    try {
      const url = await imageFileToDataUrl(picked);
      if (prepIdRef.current !== prepId) return;
      setPhoto(url);
      setPhase('ready');
    } catch (caught) {
      if (prepIdRef.current !== prepId) return;
      setPhoto(null);
      setFailStage('prepare');
      setErrorMessage(
        caught instanceof Error ? caught.message : 'That photo could not be prepared.',
      );
      setPhase('failed');
    }
  };

  const runAnalysis = async () => {
    if (!photo) return;
    if (!agreed) {
      // Agreement is a UI act that must come first; analyzeLocalizer
      // only records it. Without it, nothing leaves the device.
      setConsentPrompt(true);
      return;
    }
    setConsentPrompt(false);
    setPhase('sending');
    setErrorMessage('');
    try {
      const analysis = await analyzeLocalizer({
        images: [photo],
        note: note.trim() ? note.trim() : undefined,
      });
      setSessionAgreed(hasSessionConsent('vision'));
      setPhase('reading');
      // A short beat on the final status step so the person sees the
      // reading stage before the sheet replaces the workspace state.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      if (analysis.emergency) {
        setEmergencyText(analysis.observations[0] ?? EMERGENCY_TEXT);
        setPhase('emergency');
        return;
      }
      if (analysis.cannotAnalyze) {
        onOutcome({
          kind: 'ai-cannot',
          reason:
            analysis.reason ??
            'The AI could not read this photo clearly enough to say anything useful about it.',
        });
      } else {
        onOutcome({ kind: 'ai', analysis });
      }
      setPhase('ready');
    } catch (caught) {
      setFailStage('send');
      setErrorMessage(caught instanceof Error ? caught.message : 'Live AI could not respond.');
      setPhase('failed');
    }
  };

  const statusIndex = phase === 'preparing' ? 0 : phase === 'sending' ? 1 : 2;

  return (
    <section className="panel">
      <h2 className="section-title">Upload one photo of a face</h2>
      <p>
        Choose a clear photo that shows the whole face looking at the camera. The photo is
        prepared on this device and is only sent when you press Analyze photo. One photo
        supports a pattern-level reading only, so expect possibilities, not answers.
      </p>

      <UploadPanel
        key={panelKey}
        accept="image"
        label="Upload a photo of a face"
        hint="Front-facing and well lit, without a beauty filter. A relaxed face or a smile both work."
        privacyLine={AI_PRIVACY_LINE}
        disabled={busy}
        onFile={(picked) => void prepareFile(picked)}
        onClear={clearAll}
      />

      {busy ? (
        <ol className="loc-status-list" aria-live="polite">
          {STATUS_STEPS.map((label, index) => {
            const state = index < statusIndex ? 'done' : index === statusIndex ? 'active' : 'todo';
            return (
              <li key={label} className={`loc-status-step is-${state}`}>
                {label}
                {state === 'active' ? '...' : ''}
              </li>
            );
          })}
        </ol>
      ) : null}

      {phase === 'emergency' ? (
        <div className="loc-emergency">
          <EmergencyBanner variant="full" />
          <p>{emergencyText}</p>
          <div className="loc-actions">
            <button type="button" className="btn" onClick={onReset}>
              Start over
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'failed' ? (
        <div className="loc-failure" role="alert">
          <h3>The analysis did not finish</h3>
          <p>{errorMessage}</p>
          <div className="loc-actions">
            {failStage === 'send' && photo ? (
              <button type="button" className="btn btn-primary" onClick={() => void runAnalysis()}>
                Try again
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={clearAll}>
                Choose a different photo
              </button>
            )}
          </div>
        </div>
      ) : null}

      {photo && phase !== 'preparing' && phase !== 'failed' && phase !== 'emergency' ? (
        <>
          <h3>This photo will be sent to the AI</h3>
          <img className="loc-photo-thumb" src={photo} alt="The photo you chose, ready to send" />

          <div className="loc-note">
            <label className="form-label" htmlFor="loc-note-input">
              Anything else you noticed? (optional)
            </label>
            <p className="muted">
              For example: an arm also feels weak, the droop started this morning, or there is
              pain behind one ear. Extra signs change which possibilities fit, and a note that
              describes symptoms happening now goes to the emergency guidance instead.
            </p>
            <textarea
              id="loc-note-input"
              className="form-input loc-note-input"
              rows={3}
              maxLength={1000}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional, one or two short sentences"
            />
          </div>

          {sessionAgreed ? (
            <p className="muted">AI consent given for this session.</p>
          ) : (
            <ConsentNotice
              scopeLabel="your uploaded photo"
              checked={consent}
              onChange={(checked) => {
                setConsent(checked);
                if (checked) setConsentPrompt(false);
              }}
            />
          )}
          {consentPrompt && !agreed ? (
            <p className="muted">
              One step before the AI sees your photo: tick the agreement box above, then press
              Analyze photo again.
            </p>
          ) : null}

          <div className="loc-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void runAnalysis()}
            >
              Analyze photo
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default function LesionLocalizer() {
  const feature = getFeature('lesion-localizer');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  if (!feature) {
    return (
      <section className="panel">
        <h2 className="section-title">Face Lesion Localizer is not available</h2>
        <p>This lab is missing from the registry, so it cannot be shown honestly.</p>
      </section>
    );
  }

  const reset = () => {
    setOutcome(null);
    setSessionKey((value) => value + 1);
  };

  const tryIt = (
    <UploadWorkspace key={sessionKey} onOutcome={setOutcome} onReset={reset} />
  );

  let result: ReactNode | undefined;
  if (outcome?.kind === 'ai') {
    result = (
      <ResultSheet
        headline={outcome.analysis.headline}
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
      >
        <LesionResultBody view={toResultView(outcome.analysis)} />
      </ResultSheet>
    );
  } else if (outcome?.kind === 'ai-cannot') {
    result = (
      <ResultSheet
        headline="The AI could not read this photo clearly enough."
        limitLine={AI_FRAMING_LINE}
        modeLabel="Live AI"
        cannotAnalyze={{
          reason: outcome.reason,
          suggestion:
            'Try a brighter, front-facing photo that shows the whole face, without a beauty filter, and analyze again.',
        }}
      />
    );
  }

  return (
    <LabShell feature={feature} example={<ExamplePanel />} tryIt={tryIt} result={result} />
  );
}
