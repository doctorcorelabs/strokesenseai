// Speech stage of the FAST Live Check.
//
// One target sentence is read aloud. The browser speech recognizer
// transcribes it, and the deterministic word alignment from the
// speech tools builds the word map: heard as written, heard
// differently (with the word that was heard), or not heard. The raw
// transcript is always shown exactly as received.
//
// The privacy facts of this stage are different from the camera
// stages, and the planning document insists they are stated in place:
// in Chrome and Edge the audio goes to the browser provider's servers
// for transcription. That sentence is on screen before the microphone
// can start. When the browser has no recognizer at all (Firefox), the
// stage becomes a clearly labelled typing practice instead, and the
// sheet records it as typed, never as transcribed speech.

import { useEffect, useRef, useState } from 'react';
import PermissionPrime from '../../../components/PermissionPrime';
import {
  speechRecognitionSupported,
  useSpeechRecognition,
} from '../../speech-core/useSpeechRecognition';
import { WordMapView } from './bits';
import { TARGET_SENTENCE, buildWordMap } from './session-logic';
import type { SpeechStageOutcome } from './types';

const PRIVACY_SENTENCE =
  'When you record, your voice is transcribed by your browser provider (for example Google in Chrome, Apple in Safari). This site receives only the text.';

const HOW_IT_WORKS =
  'Speech recognition guesses words from sound and often mishears accents, noise, and quiet voices. A mismatch shows what the recognizer heard, not how well you speak.';

const TYPING_LABEL = 'Typing practice (speech recognition is not available in this browser)';

type Phase = 'intro' | 'listening' | 'card';

export default function SpeechStage({
  guided,
  onFinish,
}: {
  guided: boolean;
  onFinish: (outcome: SpeechStageOutcome) => void;
}) {
  const supported = speechRecognitionSupported();
  const [mode, setMode] = useState<'voice' | 'typing' | 'guided'>(
    guided ? 'guided' : supported ? 'voice' : 'typing',
  );
  const [phase, setPhase] = useState<Phase>('intro');
  const [typedText, setTypedText] = useState('');
  const [outcome, setOutcome] = useState<SpeechStageOutcome | null>(null);
  const recognition = useSpeechRecognition();
  const wasListeningRef = useRef(false);

  useEffect(() => {
    if (guided) setMode('guided');
  }, [guided]);

  const skip = () => onFinish({ status: 'skipped' });

  const completeWithText = (text: string, source: 'recognizer' | 'typed') => {
    const trimmed = text.trim();
    if (!trimmed) {
      setOutcome({
        status: 'could-not',
        reason:
          source === 'recognizer'
            ? 'No words were transcribed. The recognizer heard silence, or it could not pick up your voice.'
            : 'No text was entered, so there is nothing to compare with the target sentence.',
        suggestion:
          'Move closer to the microphone, read the sentence once at a normal volume, or type the sentence instead.',
      });
    } else {
      const map = buildWordMap(TARGET_SENTENCE, trimmed);
      setOutcome({
        status: 'measured',
        mode: source,
        transcript: trimmed,
        entries: map.entries,
        correctCount: map.correctCount,
        targetCount: map.targetCount,
        extraWords: map.extraWords,
      });
    }
    setPhase('card');
  };

  // Finalize when a listening session ends: the recognizer stopped on
  // its own (end of the sentence pause) or the person pressed stop.
  useEffect(() => {
    if (phase !== 'listening') return;
    if (recognition.listening) {
      wasListeningRef.current = true;
      return;
    }
    if (wasListeningRef.current) {
      wasListeningRef.current = false;
      const heard = recognition.transcript.trim() || recognition.interim.trim();
      completeWithText(heard, 'recognizer');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recognition.listening]);

  const redo = () => {
    recognition.clear();
    setTypedText('');
    setOutcome(null);
    setPhase('intro');
  };

  // ---------------------------------------------------------------------
  // Guided example mode
  // ---------------------------------------------------------------------
  if (mode === 'guided') {
    const exampleMap = buildWordMap(TARGET_SENTENCE, 'The sky is dear and blue today');
    return (
      <section className="panel fast-stage" aria-label="Speech stage, guided example">
        <div className="fast-guided-banner" role="note">
          Guided example - not a measurement
        </div>
        <h3 className="section-title">Speech - guided example</h3>
        <p>Read this sentence out loud:</p>
        <p className="fast-target">&ldquo;{TARGET_SENTENCE}&rdquo;</p>
        <p>
          In the teaching example, the recognizer heard one word differently. This is the word
          map it produced:
        </p>
        <WordMapView entries={exampleMap.entries} />
        <p>
          {exampleMap.correctCount} of {exampleMap.targetCount} words transcribed exactly as
          written.
        </p>
        <p className="muted">{HOW_IT_WORKS}</p>
        <div className="fast-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onFinish({ status: 'example' })}
          >
            See my observation sheet
          </button>
          <button type="button" className="btn" onClick={skip}>
            Skip this stage
          </button>
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------
  // Result card shared by voice and typing outcomes
  // ---------------------------------------------------------------------
  const resultCard =
    phase === 'card' && outcome ? (
      <div className="fast-stage-card">
        {outcome.status === 'measured' ? (
          <>
            <p className="fast-card-headline">Your speech stage is recorded.</p>
            <p className="fast-target">&ldquo;{TARGET_SENTENCE}&rdquo;</p>
            <WordMapView entries={outcome.entries} />
            <p>
              {outcome.correctCount} of {outcome.targetCount} words{' '}
              {outcome.mode === 'recognizer' ? 'transcribed' : 'typed'} exactly as written.
            </p>
            <blockquote className="fast-transcript">
              {outcome.mode === 'recognizer' ? 'Transcribed as: ' : 'Typed text: '}
              &ldquo;{outcome.transcript}&rdquo;
            </blockquote>
            {outcome.extraWords.length > 0 ? (
              <p className="muted">Extra words heard: {outcome.extraWords.join(', ')}</p>
            ) : null}
            <p className="muted">{HOW_IT_WORKS}</p>
            <div className="fast-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onFinish(outcome)}
              >
                See my observation sheet
              </button>
              <button type="button" className="btn" onClick={redo}>
                Redo speech stage
              </button>
            </div>
          </>
        ) : outcome.status === 'could-not' ? (
          <>
            <p className="fast-card-headline">
              The speech stage could not be measured this time.
            </p>
            <p>{outcome.reason}</p>
            <p className="muted">{outcome.suggestion}</p>
            <div className="fast-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onFinish(outcome)}
              >
                See my observation sheet
              </button>
              <button type="button" className="btn" onClick={redo}>
                Redo speech stage
              </button>
            </div>
          </>
        ) : null}
      </div>
    ) : null;

  // ---------------------------------------------------------------------
  // Typing practice (no recognizer in this browser, or chosen fallback)
  // ---------------------------------------------------------------------
  if (mode === 'typing') {
    return (
      <section className="panel fast-stage" aria-label="Speech stage">
        <div className="fast-stage-head">
          <h3 className="section-title">Speech</h3>
          {phase !== 'card' ? (
            <button type="button" className="btn btn-ghost" onClick={skip}>
              Skip this stage
            </button>
          ) : null}
        </div>
        <p className="fast-typing-label">
          {supported ? 'Typing practice (you chose to type instead of recording)' : TYPING_LABEL}
        </p>
        <p>
          Type the sentence from the example step, from memory. The same word by word
          comparison runs on your typed text, and the sheet records this stage as typed, not
          as transcribed speech.
        </p>
        <details className="fast-peek">
          <summary>Remind me of the sentence</summary>
          <p className="fast-target">&ldquo;{TARGET_SENTENCE}&rdquo;</p>
        </details>
        {phase !== 'card' ? (
          <>
            <label className="fast-type-label" htmlFor="fast-typed-text">
              The sentence, as you remember it
            </label>
            <textarea
              id="fast-typed-text"
              className="fast-textarea"
              rows={2}
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              placeholder="Type the sentence here"
            />
            <div className="fast-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={typedText.trim().length === 0}
                onClick={() => completeWithText(typedText, 'typed')}
              >
                Compare my text
              </button>
              {supported ? (
                <button type="button" className="btn" onClick={() => setMode('voice')}>
                  Use my voice instead
                </button>
              ) : null}
            </div>
          </>
        ) : (
          resultCard
        )}
      </section>
    );
  }

  // ---------------------------------------------------------------------
  // Voice mode
  // ---------------------------------------------------------------------
  return (
    <section className="panel fast-stage" aria-label="Speech stage">
      <div className="fast-stage-head">
        <h3 className="section-title">Speech</h3>
        {phase !== 'card' ? (
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Skip this stage
          </button>
        ) : null}
      </div>

      {phase !== 'card' ? (
        <>
          <p>Read this sentence out loud, once, at a normal volume:</p>
          <p className="fast-target">&ldquo;{TARGET_SENTENCE}&rdquo;</p>
          <p className="fast-privacy">{PRIVACY_SENTENCE}</p>

          {phase === 'intro' ? (
            <PermissionPrime
              device="microphone"
              why="The microphone listens while you read the target sentence out loud, so the lab can compare the words that were heard with the sentence."
              privacyNote={PRIVACY_SENTENCE}
              startLabel="Record my reading"
              onStart={() => {
                recognition.clear();
                setPhase('listening');
                recognition.start('en-US');
              }}
              exits={[
                { label: 'Use the guided example', onSelect: () => setMode('guided') },
                { label: 'Type instead', onSelect: () => setMode('typing') },
              ]}
            />
          ) : (
            <div className="fast-listening">
              <p className="fast-listening-status" role="status">
                {recognition.listening ? (
                  <>
                    <span className="fast-listening-dot" aria-hidden="true" /> Listening. Read the
                    sentence now.
                  </>
                ) : (
                  'Finishing the transcript...'
                )}
              </p>
              {recognition.interim ? (
                <p className="muted">Heard so far: {recognition.interim}</p>
              ) : null}
              {recognition.transcript ? (
                <p className="muted">Heard so far: {recognition.transcript}</p>
              ) : null}
              <div className="fast-actions">
                <button type="button" className="btn btn-primary" onClick={() => recognition.stop()}>
                  I have finished reading
                </button>
              </div>
            </div>
          )}

          {recognition.error ? (
            <div className="fast-note" role="alert">
              <p>{recognition.error}</p>
              <div className="fast-actions">
                <button type="button" className="btn" onClick={() => setMode('typing')}>
                  Type instead
                </button>
                <button type="button" className="btn" onClick={() => setMode('guided')}>
                  Use the guided example
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        resultCard
      )}
    </section>
  );
}
