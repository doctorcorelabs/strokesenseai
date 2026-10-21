// Speech-to-NIHSS Language Item Assistant (nihss-language-assistant).
//
// A study tool for students: run the language tasks on a fictional,
// author-written simulated patient, commit to a practice score with a
// written justification, then compare with the fixed case key and the
// educational anchor wording. Reference scores belong to the case
// authors and are never produced by AI or by the student's recording.
// There is deliberately no path here that scores a real patient.

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { EmergencyBanner } from '../../components/ui';
import { alignWords } from './analysis';
import {
  LANGUAGE_SCORE_ANCHORS,
  NIHSS_CASES,
  anchorFor,
  buildDocumentationDraft,
  evaluateScore,
  getNihssCase,
} from './nihss';
import type { NihssScore } from './nihss';
import { useAudioRecorder } from './useAudioRecorder';
import { useSpeechRecognition } from './useSpeechRecognition';

type Step = 'case' | 'naming' | 'reading' | 'conversation' | 'score' | 'feedback';

const STEP_ORDER: Step[] = ['case', 'naming', 'reading', 'conversation', 'score', 'feedback'];

const STEP_LABELS: Record<Step, string> = {
  case: 'Choose a case',
  naming: 'Naming task',
  reading: 'Reading task',
  conversation: 'Conversation task',
  score: 'Your score',
  feedback: 'Feedback',
};

const WATERMARK_STYLE: CSSProperties = {
  border: '2px dashed #b3261e',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textAlign: 'center',
  color: '#b3261e',
};

export default function NihssLanguageAssistant() {
  const [caseId, setCaseId] = useState<string>(NIHSS_CASES[0].id);
  const [step, setStep] = useState<Step>('case');
  const [revealedNaming, setRevealedNaming] = useState<ReadonlySet<number>>(new Set());
  const [readingRevealed, setReadingRevealed] = useState(false);
  const [conversationRevealed, setConversationRevealed] = useState(false);
  const [studentScore, setStudentScore] = useState<NihssScore | null>(null);
  const [justification, setJustification] = useState('');
  const [docDraft, setDocDraft] = useState('');

  const recorder = useAudioRecorder(30);
  const recognition = useSpeechRecognition();

  const nihssCase = getNihssCase(caseId) ?? NIHSS_CASES[0];
  const evaluation = useMemo(
    () => (studentScore !== null ? evaluateScore(studentScore, nihssCase.referenceScore) : null),
    [studentScore, nihssCase],
  );
  const readingSelfCheck = useMemo(() => {
    if (!recognition.transcript) return null;
    const alignment = alignWords(nihssCase.readingCard, recognition.transcript);
    return { alignment, transcript: recognition.transcript };
  }, [nihssCase, recognition.transcript]);

  function resetRun(nextCaseId: string) {
    setCaseId(nextCaseId);
    setStep('case');
    setRevealedNaming(new Set());
    setReadingRevealed(false);
    setConversationRevealed(false);
    setStudentScore(null);
    setJustification('');
    setDocDraft('');
    recognition.clear();
    recorder.reset();
  }

  function revealNaming(index: number) {
    setRevealedNaming((previous) => new Set(previous).add(index));
  }

  function submitScore() {
    if (studentScore === null) return;
    setDocDraft(buildDocumentationDraft(nihssCase, studentScore, justification));
    setStep('feedback');
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="page-stack">
      <p style={WATERMARK_STYLE} role="note">
        TRAINING SIMULATION - NOT FOR CLINICAL USE
      </p>

      <section className="panel" aria-labelledby="nl-intro">
        <h2 className="section-title" id="nl-intro">
          How this practice works
        </h2>
        <p>
          Pick a fictional case, run the three language tasks in order (naming, reading,
          conversation), then commit to a practice score and a written justification. Only after
          that does the tool reveal the case key. The key was fixed by the case author when the
          case was written; no AI sets it, and your recording never changes it.
        </p>
        <p className="muted">
          This is a study aid for the language item, not the official scale and not a clinical
          instrument. The cards and objects are paraphrased practice material. Never use this flow
          on a real patient, and never copy its notes into a medical record.
        </p>
        <ol className="step-list" aria-label="Progress">
          {STEP_ORDER.map((entry, index) => (
            <li key={entry} aria-current={entry === step ? 'step' : undefined}>
              {index < stepIndex ? 'Done: ' : ''}
              {STEP_LABELS[entry]}
            </li>
          ))}
        </ol>
      </section>

      <EmergencyBanner />

      {step === 'case' && (
        <section className="panel" aria-labelledby="nl-case">
          <h2 className="section-title" id="nl-case">
            Step 1 of 5: Choose a simulated case
          </h2>
          <label className="form-label" htmlFor="nl-case-select">
            Case
          </label>
          <select
            id="nl-case-select"
            className="form-input"
            value={caseId}
            onChange={(event) => resetRun(event.target.value)}
          >
            {NIHSS_CASES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
          <p>{nihssCase.vignette}</p>
          <button type="button" className="btn btn-primary" onClick={() => setStep('naming')}>
            Start the naming task
          </button>
        </section>
      )}

      {step === 'naming' && (
        <section className="panel" aria-labelledby="nl-naming">
          <h2 className="section-title" id="nl-naming">
            Step 2 of 5: Naming task
          </h2>
          <p className="muted">
            Read each prompt to the simulated patient (in your head or aloud), guess what a person
            with this profile might say if you like, then reveal the scripted answer and note what
            you observed.
          </p>
          <ol className="step-list">
            {nihssCase.naming.map((item, index) => (
              <li key={index}>
                <strong>Prompt:</strong> {item.prompt}
                <br />
                {revealedNaming.has(index) ? (
                  <>
                    <strong>Patient:</strong> {item.patientResponse}
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => revealNaming(index)}>
                    Reveal patient answer
                  </button>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-primary"
            disabled={revealedNaming.size < nihssCase.naming.length}
            onClick={() => setStep('reading')}
          >
            Continue to the reading task
          </button>
          {revealedNaming.size < nihssCase.naming.length && (
            <p className="muted">Reveal every answer to continue.</p>
          )}
        </section>
      )}

      {step === 'reading' && (
        <section className="panel" aria-labelledby="nl-reading">
          <h2 className="section-title" id="nl-reading">
            Step 3 of 5: Reading task
          </h2>
          <p>
            The patient is asked to read this card aloud:
          </p>
          <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{nihssCase.readingCard}</p>
          <p className="muted">
            Optional administration practice: read the card aloud yourself and let the browser
            draft a transcript, to rehearse pacing your instructions. This checks your reading,
            never the patient.
          </p>
          <div className="badge-row">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!recorder.supported || recorder.status === 'recording'}
              onClick={() => {
                recognition.clear();
                recorder.start();
                if (recognition.supported) recognition.start('en-US');
              }}
            >
              Practice reading aloud
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={recorder.status !== 'recording'}
              onClick={() => {
                recorder.stop();
                recognition.stop();
              }}
            >
              Stop
            </button>
          </div>
          {recorder.error && <p role="alert">{recorder.error}</p>}
          {readingSelfCheck && (
            <p>
              Your practice reading matched {readingSelfCheck.alignment.correctCount} of{' '}
              {readingSelfCheck.alignment.targetWordCount} card words according to the browser
              transcript.
            </p>
          )}
          {readingRevealed ? (
            <p>
              <strong>Patient attempt:</strong> {nihssCase.readingPatientTranscript}
            </p>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setReadingRevealed(true)}>
              Reveal patient attempt
            </button>
          )}
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!readingRevealed}
              onClick={() => setStep('conversation')}
            >
              Continue to the conversation task
            </button>
          </div>
        </section>
      )}

      {step === 'conversation' && (
        <section className="panel" aria-labelledby="nl-conversation">
          <h2 className="section-title" id="nl-conversation">
            Step 4 of 5: Conversation task
          </h2>
          <p>
            <strong>You ask:</strong> {nihssCase.conversationPrompt}
          </p>
          {conversationRevealed ? (
            <p>
              <strong>Patient:</strong> {nihssCase.conversationPatientResponse}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConversationRevealed(true)}
            >
              Reveal patient response
            </button>
          )}
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!conversationRevealed}
              onClick={() => setStep('score')}
            >
              Continue to scoring
            </button>
          </div>
        </section>
      )}

      {step === 'score' && (
        <section className="panel" aria-labelledby="nl-score">
          <h2 className="section-title" id="nl-score">
            Step 5 of 5: Commit to a practice score
          </h2>
          <p className="muted">
            Weigh all three tasks together. The key stays hidden until you submit, and you cannot
            change your score afterwards without restarting the case.
          </p>
          <fieldset>
            <legend className="form-label">Your practice score for this simulated patient</legend>
            {LANGUAGE_SCORE_ANCHORS.map((anchor) => (
              <label key={anchor.score} className="check-row">
                <input
                  type="radio"
                  name="nl-score"
                  checked={studentScore === anchor.score}
                  onChange={() => setStudentScore(anchor.score)}
                />{' '}
                <strong>
                  {anchor.score} - {anchor.label}:
                </strong>{' '}
                {anchor.description}
              </label>
            ))}
          </fieldset>
          <label className="form-label" htmlFor="nl-justification">
            Justification (which observations drove your score?)
          </label>
          <textarea
            id="nl-justification"
            className="form-input"
            rows={4}
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="For example: naming mostly correct, reading fluent, conversation easy to follow..."
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={studentScore === null}
            onClick={submitScore}
          >
            Submit score and reveal the case key
          </button>
        </section>
      )}

      {step === 'feedback' && evaluation && studentScore !== null && (
        <section className="panel" aria-labelledby="nl-feedback">
          <h2 className="section-title" id="nl-feedback">
            Feedback
          </h2>
          <p>
            <strong>{evaluation.headline}</strong>
          </p>
          <ul className="result-list">
            <li>
              Your practice score: {studentScore} ({anchorFor(studentScore).label})
            </li>
            <li>
              Case key, fixed by the author: {nihssCase.referenceScore} (
              {anchorFor(nihssCase.referenceScore).label})
            </li>
          </ul>
          <p>{evaluation.detail}</p>
          <p>
            <strong>Why the author set that key:</strong> {nihssCase.authorRationale}
          </p>
          <h3>Anchor wording for every score</h3>
          <ul className="result-list">
            {LANGUAGE_SCORE_ANCHORS.map((anchor) => (
              <li key={anchor.score}>
                <strong>
                  {anchor.score} - {anchor.label}:
                </strong>{' '}
                {anchor.description}
              </li>
            ))}
          </ul>
          <label className="form-label" htmlFor="nl-doc">
            Documentation draft for your training notes (editable)
          </label>
          <textarea
            id="nl-doc"
            className="form-input"
            rows={6}
            value={docDraft}
            onChange={(event) => setDocDraft(event.target.value)}
          />
          <p className="muted">
            This draft describes a fictional patient for study feedback. It is watermarked as a
            simulation note and must never enter a real medical record.
          </p>
          <div className="badge-row">
            <button type="button" className="btn btn-primary" onClick={() => resetRun(caseId)}>
              Retry this case
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const next = NIHSS_CASES.find((entry) => entry.id !== caseId) ?? NIHSS_CASES[0];
                resetRun(next.id);
              }}
            >
              Try a different case
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
