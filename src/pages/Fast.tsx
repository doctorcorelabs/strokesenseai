import { useEffect, useRef, useState } from 'react';
import { needsUrgentAction } from '../safety';
import type { FastAnswer } from '../safety';

type Answers = (FastAnswer | null)[];

const STEPS: {
  letter: string;
  title: string;
  question: string;
  guidance: string;
}[] = [
  {
    letter: 'F',
    title: 'Face',
    question: 'Does one side of the face look drooped or uneven when smiling?',
    guidance:
      'Ask the person to smile. Look for a sudden change on one side. Do not delay calling to finish this check.',
  },
  {
    letter: 'A',
    title: 'Arms',
    question: 'Is one arm weak, or unable to stay raised?',
    guidance:
      'Ask the person to raise both arms. Watch for one arm drifting down. Do not force movement.',
  },
  {
    letter: 'S',
    title: 'Speech',
    question: 'Is speech slurred, unusual, or hard to understand?',
    guidance:
      'Ask the person to repeat a simple sentence. Difficulty speaking, or difficulty understanding speech, counts.',
  },
];

const ANSWER_OPTIONS: { value: FastAnswer; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

export default function FastPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>([null, null, null]);
  const [otherSymptoms, setOtherSymptoms] = useState(false);
  const [finished, setFinished] = useState(false);
  // Escalation latches: once a warning sign or uncertainty triggers it, the
  // alert stays visible even if answers are changed afterwards. It is only
  // released by the explicit acknowledgement button or by restarting, never
  // silently by editing an answer.
  const [latchedUrgent, setLatchedUrgent] = useState(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const skipFirstFocus = useRef(true);

  const urgent = needsUrgentAction(answers, otherSymptoms);
  const showUrgent = urgent || latchedUrgent;
  const current = STEPS[step];
  const answered = answers[step] !== null;

  // Announce step changes to assistive technology by moving focus to the
  // new step heading (the initial page load keeps the shell's focus).
  useEffect(() => {
    if (skipFirstFocus.current) {
      skipFirstFocus.current = false;
      return;
    }
    if (finished) {
      resultHeading.current?.focus();
    } else {
      stepHeading.current?.focus();
    }
  }, [step, finished]);

  function choose(value: FastAnswer) {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
    // A fresh warning-sign or uncertainty selection (re)arms the latch.
    // Changing an answer away never releases it (see latchedUrgent above).
    if (value === 'yes' || value === 'unsure') setLatchedUrgent(true);
  }

  function toggleOtherSymptoms(checked: boolean) {
    setOtherSymptoms(checked);
    if (checked) setLatchedUrgent(true);
  }

  function restart() {
    setStep(0);
    setAnswers([null, null, null]);
    setOtherSymptoms(false);
    setFinished(false);
    setLatchedUrgent(false);
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">StrokeSense AI Lab / FAST</p>
        <h1>Manual FAST check</h1>
        <p className="muted">
          A guide for what to look for, not a detector. You never need to finish this check before
          calling for help.
        </p>
      </header>

      <aside className="panel alert-emergency" aria-label="Emergency notice">
        <h2 className="section-title">Sudden symptoms? Do not wait.</h2>
        <p>Call 119 in Indonesia now, even if the symptoms disappear.</p>
        <a className="btn btn-primary" href="tel:119">
          Call 119 now
        </a>
      </aside>

      {!finished ? (
        <section className="panel" aria-labelledby="fast-step">
          <p className="eyebrow">
            Step {step + 1} of {STEPS.length} - {current.letter} / {current.title}
          </p>
          <h2 className="section-title" id="fast-step" tabIndex={-1} ref={stepHeading}>
            {current.question}
          </h2>
          <p className="muted">{current.guidance}</p>
          <div className="card-grid" role="group" aria-label={`Answer for ${current.title}`}>
            {ANSWER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`panel choice-card${answers[step] === option.value ? ' is-selected' : ''}`}
                aria-pressed={answers[step] === option.value}
                onClick={() => choose(option.value)}
              >
                <strong>{option.label}</strong>
              </button>
            ))}
          </div>

          {latchedUrgent && (
            <div className="alert-emergency" role="alert">
              <p>
                <strong>Do not wait to finish.</strong> You selected a warning sign or
                uncertainty. Call 119 now and let emergency professionals assess the person.
                This warning stays here even if you change an answer; it only goes away when
                you confirm help is coming or restart the check.
              </p>
              <a className="btn btn-primary" href="tel:119">
                Call 119 now
              </a>{' '}
              <button
                type="button"
                className="btn"
                onClick={() => setLatchedUrgent(false)}
              >
                I have called 119 or help is on the way
              </button>
            </div>
          )}

          <div className="wizard-actions">
            <button
              type="button"
              className="btn"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!answered}
                onClick={() => setStep(step + 1)}
              >
                {showUrgent ? 'Continue checklist (optional)' : 'Next step'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!answered}
                onClick={() => setFinished(true)}
              >
                See result
              </button>
            )}
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={otherSymptoms}
              onChange={(event) => toggleOtherSymptoms(event.target.checked)}
            />{' '}
            Beyond FAST: I also noticed another sudden symptom (vision changes, loss of balance,
            numbness, or a severe unexplained headache).
          </label>
        </section>
      ) : (
        <section className="panel" aria-labelledby="fast-result">
          {showUrgent ? (
            <>
              <h2 className="section-title" id="fast-result" tabIndex={-1} ref={resultHeading}>
                Get emergency help now.
              </h2>
              <p>
                A warning sign or uncertainty was selected. The person needs urgent medical
                assessment. Do not wait for an AI result or for symptoms to improve, and do not
                drive the person yourself if an ambulance is available.
              </p>
            </>
          ) : (
            <>
              <h2 className="section-title" id="fast-result" tabIndex={-1} ref={resultHeading}>
                This check cannot rule out stroke.
              </h2>
              <p>
                Not noticing FAST signs does not mean the person is safe. Sudden vision or balance
                problems, a sudden severe headache, or any suspicion of stroke still needs
                emergency help.
              </p>
            </>
          )}
          <p>
            If you noted when the person was last known well, tell the dispatcher. That information
            stayed on this page and was not sent anywhere.
          </p>
          <div className="wizard-actions">
            <a className="btn btn-primary" href="tel:119">
              Call 119 now
            </a>
            <a className="btn" href="#emergency">
              Emergency checklist
            </a>
            <button type="button" className="btn" onClick={restart}>
              Restart check
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
