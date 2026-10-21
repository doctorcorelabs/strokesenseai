import { useState } from 'react';
import {
  CheckCircle2,
  GraduationCap,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ConsentNotice } from '../../components/ui';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../safety';
import { getApiBase, requestConsentToken, requestToolExplanation } from '../../ai/client';
import { matchOfflineTopic, offlineGuideFor } from '../../ai/offline';
import type { TutorQuestion } from './question-bank';
import { DIFFICULTY_LABELS, TOPIC_LABELS } from './question-bank';
import type { TutorProgress } from './tutor-logic';
import {
  loadProgress,
  pickNextQuestion,
  recordAnswer,
  resetProgress,
  saveProgress,
  summarizeProgress,
} from './tutor-logic';
import './research-platform.css';

/**
 * Adaptive AI Tutor workspace: a local stroke question bank whose
 * difficulty and topic mix follow the learner's recent answers, plus an
 * optional ask-the-AI box that reuses the shared Worker client.
 *
 * Progress lives only in this browser's localStorage on this device. It is
 * never uploaded; the only network path is the explicit Ask AI request,
 * which sends just the typed question after recorded consent.
 */
export default function AdaptiveTutor() {
  const api = getApiBase();
  const [progress, setProgress] = useState<TutorProgress>(() => loadProgress());
  const [current, setCurrent] = useState<TutorQuestion | null>(() => pickNextQuestion(loadProgress()));
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const [askText, setAskText] = useState('');
  const [consent, setConsent] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [aiMode, setAiMode] = useState<'guide' | 'live' | 'emergency'>('guide');
  const [aiError, setAiError] = useState('');
  const [aiPending, setAiPending] = useState(false);

  const summary = summarizeProgress(progress);
  const answeredCorrectly = revealed && selected !== null && current !== null && selected === current.answerIndex;

  function choose(optionIndex: number) {
    if (revealed || !current) return;
    const updated = recordAnswer(progress, current, optionIndex === current.answerIndex);
    setProgress(updated);
    saveProgress(updated);
    setSelected(optionIndex);
    setRevealed(true);
  }

  function next() {
    setCurrent(pickNextQuestion(progress));
    setSelected(null);
    setRevealed(false);
  }

  function restartBank() {
    const cleared: TutorProgress = { ...progress, seenIds: [], missedIds: [], recentResults: [] };
    setProgress(cleared);
    saveProgress(cleared);
    setCurrent(pickNextQuestion(cleared));
    setSelected(null);
    setRevealed(false);
  }

  function fullReset() {
    const fresh = resetProgress();
    setProgress(fresh);
    setCurrent(pickNextQuestion(fresh));
    setSelected(null);
    setRevealed(false);
  }

  async function askAi() {
    if (aiPending) return;
    const questionText = askText.trim();
    setAiError('');
    // The emergency check runs before consent and before any network call,
    // exactly as in the shared ToolCoach.
    if (mentionsAcuteSigns(questionText)) {
      setAiReply(EMERGENCY_TEXT);
      setAiMode('emergency');
      return;
    }
    if (!api) {
      const topic = matchOfflineTopic(questionText);
      if (topic) {
        setAiReply(topic.reply);
      } else if (questionText) {
        setAiReply(
          `${offlineGuideFor('adaptive-tutor')} Free-form questions need the live AI, which is not configured in this build, so this prewritten guide is the offline answer.`,
        );
      } else {
        setAiReply(offlineGuideFor('adaptive-tutor'));
      }
      setAiMode('guide');
      return;
    }
    if (!consent) {
      setAiError(
        'Acknowledge the data-sharing notice before requesting live AI. The question bank above works fully without sending anything.',
      );
      return;
    }
    setAiPending(true);
    try {
      const consentToken = await requestConsentToken(['tools']);
      const weakest = summary.weakestTopic ? TOPIC_LABELS[summary.weakestTopic] : 'not identified yet';
      const result = await requestToolExplanation(
        {
          tool: 'research',
          id: 'adaptive-tutor',
          context:
            `Adaptive AI Tutor practice. The learner is at ${DIFFICULTY_LABELS[progress.level]} ` +
            `and their weakest topic so far is ${weakest}. Answer as study guidance for the ` +
            'question asked, tied to FAST recognition, NIHSS items, vascular anatomy, or risk factors.',
          question: questionText || 'How should I structure my practice with this tutor?',
        },
        { consentToken },
      );
      setAiReply(result.reply);
      setAiMode(result.mode);
    } catch (caught) {
      setAiError(
        caught instanceof Error
          ? caught.message
          : 'Live AI could not respond. The question bank remains available.',
      );
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="rp-stack">
      <section className="panel" aria-labelledby="tutor-quiz">
        <h2 className="section-title" id="tutor-quiz">
          <GraduationCap size={20} aria-hidden="true" /> Adaptive practice
        </h2>
        <div className="rp-level-row">
          <span className="badge badge-lab">{DIFFICULTY_LABELS[progress.level]}</span>
          <span className="muted">
            {summary.totalAnswered} answered, {summary.totalCorrect} correct
            {summary.accuracy !== null ? ` (${Math.round(summary.accuracy * 100)} percent)` : ''}
          </span>
        </div>
        <p className="muted">
          Difficulty rises after a run of correct answers and eases after a run of misses. The
          tutor also favours your weakest topic. Progress is stored only in this browser on this
          device and can be cleared at any time below.
        </p>

        {current ? (
          <>
            <p className="eyebrow">
              {TOPIC_LABELS[current.topic]} - {DIFFICULTY_LABELS[current.difficulty]}
            </p>
            <h3>{current.prompt}</h3>
            <div className="rp-options" role="group" aria-label="Answer options">
              {current.options.map((option, index) => {
                const isAnswer = index === current.answerIndex;
                const isPicked = index === selected;
                const className = revealed
                  ? `rp-option${isAnswer ? ' is-correct' : ''}${isPicked && !isAnswer ? ' is-wrong' : ''}`
                  : 'rp-option';
                return (
                  <button
                    key={option}
                    type="button"
                    className={className}
                    disabled={revealed}
                    onClick={() => choose(index)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div
                className={`rp-feedback ${answeredCorrectly ? 'is-correct' : 'is-wrong'}`}
                role="status"
              >
                <strong>
                  {answeredCorrectly ? (
                    <>
                      <CheckCircle2 size={16} aria-hidden="true" /> Correct.
                    </>
                  ) : (
                    <>
                      <XCircle size={16} aria-hidden="true" /> Not quite. The correct answer is:{' '}
                      {current.options[current.answerIndex]}.
                    </>
                  )}
                </strong>
                <p>{current.explanation}</p>
                <div className="rp-actions">
                  <button type="button" className="btn btn-primary" onClick={next}>
                    Next question
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p>
              You have worked through the whole local bank
              {progress.missedIds.length === 0 ? ' with nothing left in the retry list' : ''}.
              Well done. You can run the bank again, or clear everything and start fresh.
            </p>
            <div className="rp-actions">
              <button type="button" className="btn btn-primary" onClick={restartBank}>
                Practice the bank again
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="tutor-progress">
        <h2 className="section-title" id="tutor-progress">
          Your pattern so far
        </h2>
        <p>{summary.recommendation}</p>
        <div className="rp-topic-bars">
          {summary.perTopic.map((entry) => (
            <div className="rp-bar-row" key={entry.topic}>
              <span>{entry.label}</span>
              <span className="rp-bar-track" aria-hidden="true">
                <span
                  className="rp-bar-fill"
                  style={{ width: `${Math.round((entry.accuracy ?? 0) * 100)}%` }}
                />
              </span>
              <span className="muted">
                {entry.asked === 0 ? 'Not tried yet' : `${entry.correct} of ${entry.asked} correct`}
              </span>
            </div>
          ))}
        </div>
        <div className="rp-actions">
          <button type="button" className="btn btn-ghost" onClick={fullReset}>
            <RotateCcw size={16} aria-hidden="true" /> Reset all progress
          </button>
        </div>
        <p className="muted">
          Recommendations describe this practice history only. They are not an assessment of
          clinical competence.
        </p>
      </section>

      <section className="panel" aria-labelledby="tutor-ask">
        <h2 className="section-title" id="tutor-ask">
          Ask the tutor
        </h2>
        <p className="muted">
          Ask a study question about FAST, the NIHSS, vascular territories, or risk factors.
          {api
            ? ' With live AI configured and your consent, only your question and a short practice summary are sent.'
            : ' Live AI is not configured in this build, so questions are answered from prewritten local guides.'}
        </p>
        {aiReply && (
          <div className="rp-feedback is-correct" role="status" aria-live="polite">
            <strong>
              {aiMode === 'emergency'
                ? 'Emergency guidance'
                : aiMode === 'live'
                  ? 'AI answer (may be wrong, check it against the bank explanations)'
                  : 'Local guide answer'}
            </strong>
            <p>{aiReply}</p>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void askAi();
          }}
        >
          <label className="rp-label" htmlFor="tutor-ask-input">
            Your study question (optional)
          </label>
          <div className="rp-ask-row">
            <input
              id="tutor-ask-input"
              className="form-input"
              value={askText}
              maxLength={600}
              placeholder="For example: how do I remember ACA versus MCA signs?"
              onChange={(event) => setAskText(event.target.value)}
              disabled={aiPending}
            />
            <button className="btn btn-primary" disabled={aiPending} type="submit">
              {aiPending ? (
                <LoaderCircle className="rp-spinner" size={16} aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              {aiPending ? 'Asking...' : api ? 'Ask AI' : 'Show local guide'}
            </button>
          </div>
          {api && (
            <ConsentNotice
              scopeLabel="your question and a short summary of your tutor level and weakest topic"
              checked={consent}
              onChange={setConsent}
            />
          )}
        </form>
        {aiError && (
          <p role="alert" className="rp-error">
            {aiError}
          </p>
        )}
      </section>
    </div>
  );
}

export { AdaptiveTutor as AdaptiveTutorWorkspace };
