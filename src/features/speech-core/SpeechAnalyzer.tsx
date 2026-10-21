// Dysarthria and Slurred Speech Analyzer (speech-analyzer).
//
// Practice workspace: read a known standard sentence aloud, let the
// browser transcribe it (or type what was said), and see a deterministic
// word-by-word alignment against the target plus descriptive tempo and
// acoustic numbers. This measures how machine transcription hears the
// reading. It is not a dysarthria detector, not a clinical score, and it
// never compares the reader with native speaker norms: the only
// comparison offered is with the reader's own baseline recording.

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CannotAnalyzePanel, EmergencyBanner, UncertaintyNote } from '../../components/ui';
import {
  analyzeReading,
  analyzeWaveform,
  compareToBaseline,
} from './analysis';
import type { AlignedWord, ReadingAnalysis } from './analysis';
import { TEST_PHRASES, recognitionLocale } from './phrases';
import { decodeSamples, useAudioRecorder } from './useAudioRecorder';
import { useSpeechRecognition } from './useSpeechRecognition';

type GateChoice = 'unset' | 'practice' | 'now';

const TEST_DEFAULT_PHRASE = 'en-fox';

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

function WordHighlight({ analysis }: { analysis: ReadingAnalysis }) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px', lineHeight: 2 }}>
        {analysis.alignment.items.map((item, index) => (
          <span key={index} style={WORD_STYLES[item.status]} title={item.status}>
            {item.status === 'extra' ? `+ ${item.heard ?? ''}` : (item.target ?? '')}
            {item.status === 'substituted' && (
              <span className="muted" style={{ display: 'block', fontSize: '0.75em', lineHeight: 1.2 }}>
                heard: {item.heard}
              </span>
            )}
          </span>
        ))}
      </div>
      <p className="muted">
        Legend: green underline = word matched. Yellow = a different word was heard. Red
        strikethrough = target word missing. Grey with + = extra word inserted.
      </p>
    </div>
  );
}

export default function SpeechAnalyzer() {
  const [gate, setGate] = useState<GateChoice>('unset');
  const phrases = TEST_PHRASES;
  const [phraseId, setPhraseId] = useState<string>(TEST_DEFAULT_PHRASE);
  const phrase = phrases.find((entry) => entry.id === phraseId) ?? phrases[0];

  const recorder = useAudioRecorder(30);
  const recognition = useSpeechRecognition();
  const [transcript, setTranscript] = useState('');
  const [manualDuration, setManualDuration] = useState('');
  const [result, setResult] = useState<ReadingAnalysis | null>(null);
  const [baseline, setBaseline] = useState<ReadingAnalysis | null>(null);
  const [cannotReason, setCannotReason] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const comparison = useMemo(
    () => (result && baseline && result !== baseline ? compareToBaseline(result, baseline) : null),
    [result, baseline],
  );

  function startCapture() {
    setCannotReason(null);
    setResult(null);
    recognition.clear();
    setTranscript('');
    recorder.start();
    if (recognition.supported) recognition.start(recognitionLocale());
  }

  function stopCapture() {
    recorder.stop();
    recognition.stop();
    if (recognition.transcript) setTranscript(recognition.transcript);
  }

  async function runAnalysis() {
    const heard = transcript.trim();
    if (!heard) {
      setResult(null);
      setCannotReason(
        'There is no transcript to analyze yet. Record a reading, let the browser transcribe it, or type what was said into the transcript box.',
      );
      return;
    }
    setCannotReason(null);
    setAnalyzing(true);
    try {
      let waveform = null;
      if (recorder.blob) {
        const decoded = await decodeSamples(recorder.blob);
        if (decoded) waveform = analyzeWaveform(decoded.samples, decoded.sampleRate);
      }
      const typedDuration = Number.parseFloat(manualDuration);
      const duration = recorder.blob
        ? recorder.durationSeconds
        : Number.isFinite(typedDuration)
          ? typedDuration
          : 0;
      setResult(analyzeReading(phrase.text, heard, duration, waveform));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="sa-disclaimer">
        <h2 className="section-title" id="sa-disclaimer">
          Before you start
        </h2>
        <p>
          <strong>Practice tool, not a medical test.</strong> This analyzer shows how clearly a
          machine transcript matches a sentence you chose to read. It does not detect dysarthria,
          it does not produce a clinical score, and a clean result cannot rule out stroke or any
          other condition.
        </p>
        <p className="muted">
          Honest limitation: generic speech recognition is known to perform poorly on post-stroke
          speech, and accents affect it too. That is why results are only ever compared with your
          own baseline recording, never with native speaker norms. Recordings stay in this tab and
          are never uploaded by this tool.
        </p>
        <fieldset>
          <legend className="form-label">Which of these describes you right now?</legend>
          <label className="check-row">
            <input
              type="radio"
              name="sa-gate"
              checked={gate === 'practice'}
              onChange={() => setGate('practice')}
            />{' '}
            I am practicing: my speech feels normal to me, or I am using a sample recording.
          </label>
          <label className="check-row">
            <input
              type="radio"
              name="sa-gate"
              checked={gate === 'now'}
              onChange={() => setGate('now')}
            />{' '}
            My speech is slurred or hard to understand right now.
          </label>
        </fieldset>
      </section>

      {gate === 'now' && <EmergencyBanner />}
      {gate === 'now' && (
        <p role="alert">
          The analyzer is paused. Slurred speech that is happening now is a possible stroke sign:
          call 119 in Indonesia immediately instead of practicing with this tool.
        </p>
      )}

      {gate === 'practice' && (
        <>
          <section className="panel" aria-labelledby="sa-phrase">
            <h2 className="section-title" id="sa-phrase">
              1. Choose a sentence
            </h2>
            <label className="form-label" htmlFor="sa-phrase-select">
              Standard sentence
            </label>
            <select
              id="sa-phrase-select"
              className="form-input"
              value={phrase.id}
              onChange={(event) => {
                setPhraseId(event.target.value);
                setResult(null);
              }}
            >
              {phrases.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.text}
                </option>
              ))}
            </select>
            <p className="muted">{phrase.note}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 600 }} lang="en">
              {phrase.text}
            </p>
          </section>

          <section className="panel" aria-labelledby="sa-record">
            <h2 className="section-title" id="sa-record">
              2. Record your reading (up to 30 seconds)
            </h2>
            {!recorder.supported && (
              <p className="muted">
                This browser cannot record audio. Skip to step 3 and type the transcript instead.
              </p>
            )}
            <div className="badge-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!recorder.supported || recorder.status === 'recording'}
                onClick={startCapture}
              >
                Start recording
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={recorder.status !== 'recording'}
                onClick={stopCapture}
              >
                Stop
              </button>
              <span aria-live="polite">
                {recorder.status === 'recording'
                  ? `Recording: ${recorder.elapsedSeconds.toFixed(1)} s`
                  : recorder.status === 'recorded'
                    ? `Recorded: ${recorder.durationSeconds.toFixed(1)} s`
                    : ''}
              </span>
            </div>
            <p className="muted">
              Speech recognition uses your browser's built-in speech recognition.
            </p>
            {recorder.error && <p role="alert">{recorder.error}</p>}
            {recorder.audioUrl && (
              <audio controls src={recorder.audioUrl}>
                Your browser does not support audio playback.
              </audio>
            )}
            <p className="muted">
              {recognition.supported
                ? 'While you record, the browser speech recognizer drafts the transcript below. In most browsers that recognizer runs through the browser vendor service. You can correct the transcript before analyzing.'
                : 'Automatic transcription is not available in this browser, so type what was said in step 3.'}
            </p>
            {recognition.listening && recognition.interim && (
              <p className="muted" aria-live="polite">
                Hearing: {recognition.interim}
              </p>
            )}
            {recognition.error && <p role="alert">{recognition.error}</p>}
          </section>

          <section className="panel" aria-labelledby="sa-transcript">
            <h2 className="section-title" id="sa-transcript">
              3. Transcript and analysis
            </h2>
            <label className="form-label" htmlFor="sa-transcript-box">
              Transcript of the reading (always editable)
            </label>
            <textarea
              id="sa-transcript-box"
              className="form-input"
              rows={3}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Type or correct what was actually said..."
            />
            {!recorder.blob && (
              <>
                <label className="form-label" htmlFor="sa-duration">
                  Reading duration in seconds (only needed for tempo when you did not record)
                </label>
                <input
                  id="sa-duration"
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={manualDuration}
                  onChange={(event) => setManualDuration(event.target.value)}
                />
              </>
            )}
            <div className="badge-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={runAnalysis}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing...' : 'Analyze reading'}
              </button>
              {result && !baseline && (
                <button type="button" className="btn btn-ghost" onClick={() => setBaseline(result)}>
                  Save as my baseline
                </button>
              )}
              {baseline && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setBaseline(null)}
                >
                  Clear baseline
                </button>
              )}
            </div>
            {cannotReason && (
              <CannotAnalyzePanel role="alert" reason={cannotReason} guidance="Record or type a transcript first. The analyzer reports the missing input instead of inventing a result." />
            )}
          </section>

          {result && (
            <section className="panel" aria-labelledby="sa-results">
              <h2 className="section-title" id="sa-results">
                What the machine heard
              </h2>
              <WordHighlight analysis={result} />
              <ul className="result-list">
                <li>
                  Word error rate: <strong>{Math.round(result.alignment.wer * 100)}%</strong> (
                  {result.alignment.correctCount} of {result.alignment.targetWordCount} target
                  words matched; {result.alignment.substitutions} replaced,{' '}
                  {result.alignment.deletions} missing, {result.alignment.insertions} extra)
                </li>
                {result.tempo ? (
                  <li>
                    Pace: <strong>{result.tempo.wordsPerMinute} words per minute</strong>, about{' '}
                    {result.tempo.syllablesPerSecond} syllables per second over{' '}
                    {result.tempo.durationSeconds.toFixed(1)} seconds
                  </li>
                ) : (
                  <li>Pace: not measured, because no recording duration was available.</li>
                )}
                {result.waveform ? (
                  <>
                    <li>
                      Pauses: about <strong>{Math.round(result.waveform.pauseRatio * 100)}%</strong>{' '}
                      of the recording was near silence
                    </li>
                    <li>
                      Loudness evenness (variation): <strong>{result.waveform.intensityVariability}</strong>
                      ; estimated syllable beats:{' '}
                      <strong>{result.waveform.estimatedSyllableRate} per second</strong>
                    </li>
                  </>
                ) : (
                  <li>Acoustic panel: not available for this take.</li>
                )}
              </ul>
              {baseline && comparison && <p>{comparison.summary}</p>}
              {baseline && !comparison && (
                <p className="muted">This reading is your saved baseline. Record again to compare.</p>
              )}
              <UncertaintyNote>
                These numbers describe one short recording and one machine transcript. Speech
                recognition errors, microphone quality, and background noise all move them. They
                are practice feedback only, never a finding about your health.
              </UncertaintyNote>
            </section>
          )}
        </>
      )}
    </div>
  );
}
