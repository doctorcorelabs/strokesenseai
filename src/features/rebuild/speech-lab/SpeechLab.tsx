// Speech Lab (rebuilt, R1).
//
// One target sentence, one recording, one word map. The reader picks a
// sentence (or keeps the default), reads it aloud once, and immediately
// sees which words the browser recognizer transcribed as written, which
// it heard differently, and which it did not hear, with the raw
// transcript shown exactly as received. The single-recording flow
// replaces the old analyzer's two record cycles before the first value.
//
// The machinery is reused, not rewritten: useSpeechRecognition and
// useAudioRecorder from speech-core do the capturing, and the
// deterministic alignWords from speech-core/analysis does the matching.
// What is new here is the shell framing, the honest per-browser privacy
// priming shown before any microphone request, the live word highlight
// and pace zones, and the tap-along fallback for browsers without
// speech recognition (Firefox), which is a first-class mode whose
// results are recorded as taps, never as a transcript.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { getFeature } from '../../../../shared/registry';
import { LabShell, ResultSheet } from '../../../shell';
import PermissionPrime from '../../../components/PermissionPrime';
import { alignWords, analyzeReading, normalizeWords } from '../../speech-core/analysis';
import type { AlignedWord, ReadingAnalysis } from '../../speech-core/analysis';
import { TEST_PHRASES, recognitionLocale } from '../../speech-core/phrases';
import { useAudioRecorder } from '../../speech-core/useAudioRecorder';
import {
  speechRecognitionSupported,
  useSpeechRecognition,
} from '../../speech-core/useSpeechRecognition';
import {
  EXAMPLE_HEARD,
  EXAMPLE_TARGET,
  PACE_ZONE_LABELS,
  liveWordMap,
  paceSentence,
  paceZone,
} from './speechLabLogic';
import type { LiveWord, PaceZone } from './speechLabLogic';

const DEFAULT_PHRASE_ID = 'en-fox';

// ---------------------------------------------------------------------------
// Shared display pieces
// ---------------------------------------------------------------------------

const WORD_STYLES: Record<AlignedWord['status'], CSSProperties> = {
  correct: { borderBottom: '3px solid #2e7d32' },
  substituted: { background: '#fde68a', borderRadius: 4, padding: '0 4px' },
  missing: {
    background: '#fecaca',
    borderRadius: 4,
    padding: '0 4px',
    textDecoration: 'line-through',
  },
  extra: { background: '#e5e7eb', borderRadius: 4, padding: '0 4px', fontStyle: 'italic' },
};

const STATUS_TITLES: Record<AlignedWord['status'], string> = {
  correct: 'Heard as written',
  substituted: 'Heard differently',
  missing: 'Not heard',
  extra: 'Extra word heard',
};

/** Final word map for a finished alignment (example or real reading). */
function WordMap({ items }: { items: AlignedWord[] }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', lineHeight: 2 }}>
        {items.map((item, index) => (
          <span key={index} style={WORD_STYLES[item.status]} title={STATUS_TITLES[item.status]}>
            {item.status === 'extra' ? `+ ${item.heard ?? ''}` : (item.target ?? '')}
            {item.status === 'substituted' && (
              <span
                className="muted"
                style={{ display: 'block', fontSize: '0.75em', lineHeight: 1.2 }}
              >
                heard: {item.heard}
              </span>
            )}
          </span>
        ))}
      </div>
      <p className="muted">
        Legend: green underline = heard as written. Yellow = heard differently, with the word
        that was heard shown under it. Red strikethrough = not heard. Grey with + = extra word
        heard.
      </p>
    </div>
  );
}

const LIVE_STYLES: Record<LiveWord['state'], CSSProperties> = {
  matched: { background: '#bbf7d0', borderRadius: 4, padding: '0 4px' },
  different: { background: '#fde68a', borderRadius: 4, padding: '0 4px' },
  skipped: { background: '#fecaca', borderRadius: 4, padding: '0 4px' },
  upcoming: { opacity: 0.45, padding: '0 4px' },
};

/** Live word highlight that follows the in-progress transcript. */
function LiveTokens({ words }: { words: LiveWord[] }) {
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', lineHeight: 2, fontSize: '1.25rem', fontWeight: 600 }}
      aria-live="polite"
    >
      {words.map((entry, index) => (
        <span key={index} style={LIVE_STYLES[entry.state]}>
          {entry.word}
          {entry.state === 'different' && entry.heard && (
            <span
              className="muted"
              style={{ display: 'block', fontSize: '0.6em', lineHeight: 1.2, fontWeight: 400 }}
            >
              heard: {entry.heard}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Three-zone pace meter. The main display shows zone labels only. */
function PaceMeter({ zone }: { zone: PaceZone }) {
  const zones: PaceZone[] = ['slow', 'steady', 'fast'];
  return (
    <div
      role="img"
      aria-label={`Pace zone: ${PACE_ZONE_LABELS[zone]}`}
      style={{ display: 'flex', gap: 6, maxWidth: 420 }}
    >
      {zones.map((entry) => (
        <div
          key={entry}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '6px 0',
            borderRadius: 6,
            border: '1px solid #cbd5e1',
            background: entry === zone ? '#126454' : '#f1f5f9',
            color: entry === zone ? '#ffffff' : '#334155',
            fontWeight: entry === zone ? 700 : 400,
          }}
        >
          {PACE_ZONE_LABELS[entry]}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: the finished example
// ---------------------------------------------------------------------------

function SpeechExample() {
  const example = useMemo(() => alignWords(EXAMPLE_TARGET, EXAMPLE_HEARD), []);
  return (
    <>
      <h2 className="section-title">See a finished word map</h2>
      <p>
        The reader read this sentence aloud: <strong lang="en">{EXAMPLE_TARGET}</strong>
      </p>
      <p className="muted">
        Example result. This map was written as an example, not measured from anyone:
      </p>
      <WordMap items={example.items} />
      <p>
        In this example the recognizer heard one word differently (rain came back as train)
        and missed one word entirely. A mismatch like this shows what the recognizer heard,
        not how well the person spoke.
      </p>
      <p className="muted">The example reading was also paced in the steady zone:</p>
      <PaceMeter zone="steady" />
      <p className="muted">
        No microphone is used for the example. Your turn asks for the microphone only after
        you have read where your voice goes.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------
// Outcomes
// ---------------------------------------------------------------------------

type Outcome =
  | { kind: 'reading'; analysis: ReadingAnalysis; rawTranscript: string }
  | { kind: 'cannot'; reason: string; suggestion: string }
  | { kind: 'tap'; followed: number; total: number; zone: PaceZone | null };

// ---------------------------------------------------------------------------
// Tap-along workspace (browsers without speech recognition, or chosen)
// ---------------------------------------------------------------------------

function TapWorkspace({
  phraseText,
  onOutcome,
}: {
  phraseText: string;
  onOutcome: (outcome: Outcome) => void;
}) {
  const words = useMemo(() => phraseText.split(/\s+/).filter(Boolean), [phraseText]);
  const [tapIndex, setTapIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  function tapWord(index: number) {
    if (finished || index !== tapIndex) return;
    if (startedAtRef.current === null) startedAtRef.current = performance.now();
    setTapIndex(index + 1);
  }

  function finish() {
    const startedAt = startedAtRef.current;
    const durationSeconds =
      startedAt === null ? 0 : Math.max(0, (performance.now() - startedAt) / 1000);
    const zone =
      tapIndex > 0 && durationSeconds > 0
        ? paceZone((tapIndex / durationSeconds) * 60)
        : null;
    setFinished(true);
    onOutcome({ kind: 'tap', followed: tapIndex, total: words.length, zone });
  }

  return (
    <section className="panel" aria-labelledby="sl-tap">
      <h2 className="section-title" id="sl-tap">
        Tap along with the example
      </h2>
      <p>
        This browser has no speech recognition, or you chose this mode, so there is no
        microphone step. Read the sentence in your head or out loud and tap each word below
        in order as you reach it, the way you would follow the example reading. The result is
        recorded as follow-along taps, never as a transcript of your voice.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', lineHeight: 2 }}>
        {words.map((word, index) => (
          <button
            key={index}
            type="button"
            className="btn"
            disabled={finished || index < tapIndex}
            onClick={() => tapWord(index)}
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              background: index < tapIndex ? '#bbf7d0' : undefined,
              opacity: index > tapIndex ? 0.55 : 1,
            }}
          >
            {word}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="muted">
        {tapIndex === 0
          ? 'Tap the first word when you start reading.'
          : finished
            ? `You followed ${tapIndex} of ${words.length} words.`
            : `Following along: ${tapIndex} of ${words.length} words tapped.`}
      </p>
      <div className="badge-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={tapIndex === 0 || finished}
          onClick={finish}
        >
          Finish
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setTapIndex(0);
            setFinished(false);
            startedAtRef.current = null;
          }}
        >
          Start over
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The lab
// ---------------------------------------------------------------------------

export default function SpeechLab() {
  const feature = getFeature('speech-lab');

  const [phraseId, setPhraseId] = useState(DEFAULT_PHRASE_ID);
  const phrase = TEST_PHRASES.find((entry) => entry.id === phraseId) ?? TEST_PHRASES[0];
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const asrSupported = useMemo(() => speechRecognitionSupported(), []);
  const [tapChosen, setTapChosen] = useState(false);
  const mode: 'mic' | 'tap' = !asrSupported || tapChosen ? 'tap' : 'mic';

  // Microphone workspace state.
  const [primed, setPrimed] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'finalizing'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorder = useAudioRecorder(30);
  const recognition = useSpeechRecognition();
  const startedAtRef = useRef(0);
  const pendingDurationRef = useRef(0);
  const latestHeardRef = useRef('');
  const phraseTextRef = useRef(phrase.text);
  phraseTextRef.current = phrase.text;

  useEffect(() => {
    latestHeardRef.current = [recognition.transcript, recognition.interim]
      .filter(Boolean)
      .join(' ')
      .trim();
  }, [recognition.transcript, recognition.interim]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - startedAtRef.current) / 1000);
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase]);

  // One recording produces the first value directly: when the recognizer
  // winds down after Stop, the finished transcript is aligned at once.
  useEffect(() => {
    if (phase !== 'finalizing' || recognition.listening) return;
    const heard = latestHeardRef.current.trim();
    if (!heard) {
      setOutcome({
        kind: 'cannot',
        reason:
          'No words were transcribed from that reading. The recognizer may not have heard you, or it may have stopped before you finished.',
        suggestion:
          'Move closer to the microphone, reduce background noise, and read the sentence once more. You can also switch to tap-along mode from the start of this step.',
      });
    } else {
      setOutcome({
        kind: 'reading',
        analysis: analyzeReading(phraseTextRef.current, heard, pendingDurationRef.current),
        rawTranscript: heard,
      });
    }
    setPhase('idle');
  }, [phase, recognition.listening]);

  function changePhrase(id: string) {
    setPhraseId(id);
    setOutcome(null);
    setPhase('idle');
    recognition.clear();
    latestHeardRef.current = '';
    recorder.reset();
  }

  function startReading() {
    setOutcome(null);
    recognition.clear();
    latestHeardRef.current = '';
    recorder.reset();
    recorder.start();
    recognition.start(recognitionLocale());
    startedAtRef.current = performance.now();
    setElapsed(0);
    setPhase('recording');
  }

  function stopReading() {
    if (phase !== 'recording') return;
    pendingDurationRef.current = Math.max(
      0,
      (performance.now() - startedAtRef.current) / 1000,
    );
    recognition.stop();
    recorder.stop();
    setPhase('finalizing');
  }

  if (!feature) {
    return (
      <section className="panel">
        <h2 className="section-title">Speech Lab is not registered</h2>
        <p>The registry has no entry for this lab, so there is nothing honest to show.</p>
      </section>
    );
  }

  // ----- Step 2 content -----------------------------------------------------

  const liveHeard = [recognition.transcript, recognition.interim].filter(Boolean).join(' ');
  const liveMap = liveWordMap(phrase.text, liveHeard);
  const liveWordCount = normalizeWords(liveHeard).length;
  const liveZone =
    phase === 'recording' && elapsed >= 2 && liveWordCount > 0
      ? paceZone((liveWordCount / elapsed) * 60)
      : null;

  const micWorkspace = (
    <div className="page-stack">
      {!primed ? (
        <section className="panel" aria-labelledby="sl-prime">
          <h2 className="section-title" id="sl-prime">
            Before the microphone
          </h2>
          <PermissionPrime
            device="microphone"
            why="The microphone lets the browser hear you read one short sentence, so the lab can line the transcript up against that sentence word by word."
            privacyNote="In Chrome and Edge, your voice is sent to the browser provider (Google or Microsoft) to be transcribed; in Safari it is handled by Apple. It is not transcribed purely on this device. This site receives only the transcript text, and your recording stays in this tab."
            startLabel="Continue to the reading"
            onStart={() => setPrimed(true)}
            exits={[
              { label: 'Use tap-along mode instead', onSelect: () => setTapChosen(true) },
            ]}
          />
        </section>
      ) : (
        <>
          <section className="panel" aria-labelledby="sl-sentence">
            <h2 className="section-title" id="sl-sentence">
              1. Choose a sentence
            </h2>
            <label className="form-label" htmlFor="sl-phrase-select">
              Sentence to read
            </label>
            <select
              id="sl-phrase-select"
              className="form-input"
              value={phrase.id}
              onChange={(event) => changePhrase(event.target.value)}
            >
              {TEST_PHRASES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.text}
                </option>
              ))}
            </select>
            <p className="muted">{phrase.note}</p>
          </section>

          <section className="panel" aria-labelledby="sl-read">
            <h2 className="section-title" id="sl-read">
              2. Read it once
            </h2>
            {phase === 'idle' && !liveHeard ? (
              <p lang="en" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {phrase.text}
              </p>
            ) : (
              <LiveTokens words={liveMap.words} />
            )}
            {liveMap.extraWords.length > 0 && (
              <p className="muted">Extra words heard: {liveMap.extraWords.join(', ')}</p>
            )}
            <div className="badge-row">
              {phase === 'recording' ? (
                <button type="button" className="btn btn-primary" onClick={stopReading}>
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={phase === 'finalizing'}
                  onClick={startReading}
                >
                  {outcome ? 'Read again' : 'Start reading'}
                </button>
              )}
              <span aria-live="polite">
                {phase === 'recording'
                  ? `Listening: ${elapsed.toFixed(1)} s`
                  : phase === 'finalizing'
                    ? 'Finishing the transcript...'
                    : ''}
              </span>
            </div>
            {liveZone && (
              <>
                <p className="muted">Your pace so far:</p>
                <PaceMeter zone={liveZone} />
              </>
            )}
            {!recorder.supported && (
              <p className="muted">
                This browser cannot record audio, so there will be no recording to play back.
                The transcript still works.
              </p>
            )}
            {recorder.error && <p role="alert">{recorder.error}</p>}
            {recognition.error && <p role="alert">{recognition.error}</p>}
          </section>
        </>
      )}
    </div>
  );

  const tryIt =
    mode === 'tap' ? (
      <div className="page-stack">
        <section className="panel" aria-labelledby="sl-tap-sentence">
          <h2 className="section-title" id="sl-tap-sentence">
            Choose a sentence
          </h2>
          <label className="form-label" htmlFor="sl-tap-phrase-select">
            Sentence to follow
          </label>
          <select
            id="sl-tap-phrase-select"
            className="form-input"
            value={phrase.id}
            onChange={(event) => changePhrase(event.target.value)}
          >
            {TEST_PHRASES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.text}
              </option>
            ))}
          </select>
          <p className="muted">{phrase.note}</p>
        </section>
        <TapWorkspace
          key={phrase.id}
          phraseText={phrase.text}
          onOutcome={(next) => setOutcome(next)}
        />
      </div>
    ) : (
      micWorkspace
    );

  // ----- Step 3 content -----------------------------------------------------

  let result: ReactNode = undefined;
  if (outcome?.kind === 'cannot') {
    result = (
      <ResultSheet
        headline="The recognizer could not hear a reading this time."
        limitLine={feature.limitations}
        modeLabel="Browser transcription"
        cannotAnalyze={{ reason: outcome.reason, suggestion: outcome.suggestion }}
      />
    );
  } else if (outcome?.kind === 'tap') {
    const tapWords = phrase.text.split(/\s+/).filter(Boolean);
    result = (
      <ResultSheet
        headline={`You tapped along with ${outcome.followed} of ${outcome.total} words.`}
        limitLine={feature.limitations}
        modeLabel="Follow-along taps"
      >
        <p>
          These were follow-along taps, not a microphone reading and not a transcript of your
          voice. They show which words you followed in the example's order, nothing about how
          your speech sounds.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', lineHeight: 2 }}>
          {tapWords.map((word, index) => (
            <span
              key={index}
              style={{
                background: index < outcome.followed ? '#bbf7d0' : '#f1f5f9',
                borderRadius: 4,
                padding: '0 4px',
                opacity: index < outcome.followed ? 1 : 0.55,
              }}
            >
              {word}
            </span>
          ))}
        </div>
        {outcome.zone && (
          <>
            <p>{paceSentence(outcome.zone)}</p>
            <PaceMeter zone={outcome.zone} />
          </>
        )}
      </ResultSheet>
    );
  } else if (outcome?.kind === 'reading') {
    const { analysis, rawTranscript } = outcome;
    const tempoZone = analysis.tempo ? paceZone(analysis.tempo.wordsPerMinute) : null;
    result = (
      <ResultSheet
        headline={`${analysis.alignment.correctCount} of ${analysis.alignment.targetWordCount} words were transcribed exactly as written.`}
        limitLine={feature.limitations}
        modeLabel="Browser transcription"
      >
        <p>
          A mismatch shows what the recognizer heard, not how well you speak. Recognizers
          mishear accents, background noise, and quiet voices, and they are known to perform
          worse on post-stroke speech.
        </p>
        <WordMap items={analysis.alignment.items} />
        {tempoZone && analysis.tempo ? (
          <>
            <p>{paceSentence(tempoZone)}</p>
            <PaceMeter zone={tempoZone} />
          </>
        ) : (
          <p className="muted">Pace was not measured for this reading.</p>
        )}

        <h3>Listen and compare</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: '1 1 260px' }}>
            <p>
              <strong>Example reading</strong>
            </p>
            <p className="muted">
              This lab does not include a recorded human example, so the example side is the
              finished word map from step 1 rather than audio. Nothing here pretends to be a
              recording it is not.
            </p>
            <WordMap items={alignWords(EXAMPLE_TARGET, EXAMPLE_HEARD).items} />
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <p>
              <strong>Your reading</strong>
            </p>
            {recorder.audioUrl ? (
              <>
                <audio controls src={recorder.audioUrl}>
                  Your browser does not support audio playback.
                </audio>
                <p className="muted">
                  Your recording stays in this tab and is never uploaded by this site.
                </p>
              </>
            ) : (
              <p className="muted">
                No recording is available to play back in this browser. The word map above is
                your result.
              </p>
            )}
          </div>
        </div>

        <details>
          <summary>See the transcript exactly as received, and the numbers</summary>
          <p>Transcript exactly as the recognizer returned it:</p>
          <blockquote>{rawTranscript}</blockquote>
          <ul className="result-list">
            <li>
              Words heard differently: {analysis.alignment.substitutions}. Words not heard:{' '}
              {analysis.alignment.deletions}. Extra words heard:{' '}
              {analysis.alignment.insertions}.
            </li>
            {analysis.tempo && (
              <li>
                Pace in numbers: {analysis.tempo.wordsPerMinute} words per minute over{' '}
                {analysis.tempo.durationSeconds.toFixed(1)} seconds.
              </li>
            )}
          </ul>
        </details>
      </ResultSheet>
    );
  }

  return (
    <LabShell
      feature={feature}
      example={<SpeechExample />}
      tryIt={tryIt}
      result={result}
      onExampleAlt={() => setTapChosen(true)}
    />
  );
}
