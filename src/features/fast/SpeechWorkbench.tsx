import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { LIMITS } from '../../../shared/limits';
import { STANDARD_SENTENCE, wordOverlap } from './session';

// Minimal typing for the optional on-device Web Speech recognition API.
// It is used only when the browser offers it; typing the transcript is
// always available and nothing depends on recognition existing.
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type RecState = 'idle' | 'recording' | 'recorded';

/**
 * Speech stage workbench: the standard sentence, a simple on-device audio
 * recorder with playback, and a transcript box (typed, or filled by the
 * browser's own speech recognition where available). The recording and
 * the transcript never leave this device in this lab; the word overlap is
 * computed locally by the tested wordOverlap function.
 */
export default function SpeechWorkbench({
  transcript,
  onTranscriptChange,
}: {
  transcript: string;
  onTranscriptChange: (text: string) => void;
}) {
  const [recState, setRecState] = useState<RecState>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recError, setRecError] = useState('');
  const [listening, setListening] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef(0);
  const startedAtRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const overlap = useMemo(() => wordOverlap(transcript), [transcript]);
  const recognizerAvailable = recognitionCtor() !== null;

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
      recognitionRef.current?.stop();
    };
  }, []);

  function stopRecording() {
    window.clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }

  async function startRecording() {
    setRecError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecError(
        'This browser cannot record audio. You can still type what you heard in the transcript box below.',
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
        setRecState('recorded');
      };
      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      setRecSeconds(0);
      setRecState('recording');
      timerRef.current = window.setInterval(() => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        setRecSeconds(seconds);
        if (seconds >= LIMITS.audioSeconds) stopRecording();
      }, 200);
    } catch {
      setRecError(
        'Microphone access was not granted. You can still type what you heard in the transcript box below.',
      );
    }
  }

  function deleteRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecSeconds(0);
    setRecState('idle');
  }

  function toggleRecognition() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i += 1) {
        const alternative = event.results[i]?.[0];
        if (alternative) parts.push(alternative.transcript);
      }
      onTranscriptChange(parts.join(' '));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  return (
    <div>
      <p className="muted">Standard sentence to repeat:</p>
      <p className="fast-sentence">&ldquo;{STANDARD_SENTENCE}&rdquo;</p>

      <div className="fast-controls-row" role="group" aria-label="Audio recorder">
        {recState === 'recording' ? (
          <button type="button" className="btn" onClick={stopRecording}>
            <Square size={16} aria-hidden="true" /> Stop recording
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void startRecording()}>
            <Mic size={16} aria-hidden="true" /> Record the repetition
          </button>
        )}
        {recState === 'recording' && (
          <span className="muted" role="status">
            <span className="fast-record-dot" aria-hidden="true" /> Recording,{' '}
            {Math.floor(recSeconds)} of {LIMITS.audioSeconds} seconds. The recording stays on
            this device.
          </span>
        )}
        {recState === 'recorded' && audioUrl && (
          <>
            {/* The recording is a local practice artifact for listen-back only. */}
            <audio controls src={audioUrl} aria-label="Your recording, stored only on this device" />
            <button type="button" className="btn" onClick={deleteRecording}>
              <Trash2 size={16} aria-hidden="true" /> Delete recording
            </button>
          </>
        )}
      </div>
      {recError && (
        <p role="alert" className="muted">
          {recError}
        </p>
      )}

      <label className="form-label" htmlFor="fast-transcript">
        What was said (transcript)
      </label>
      <textarea
        id="fast-transcript"
        className="textarea"
        rows={3}
        value={transcript}
        maxLength={300}
        placeholder="Type what you heard, or use voice recognition if your browser offers it."
        onChange={(event) => onTranscriptChange(event.target.value)}
      />
      <div className="fast-controls-row">
        {recognizerAvailable && (
          <button type="button" className="btn" onClick={toggleRecognition}>
            <Mic size={16} aria-hidden="true" />
            {listening ? 'Stop voice recognition' : 'Fill transcript with voice recognition'}
          </button>
        )}
        <span className="muted" role="status">
          Word match: {overlap.matchedCount} of {overlap.totalCount} target words heard. This is a
          practice clarity measure, not a score.
        </span>
      </div>
      <div className="fast-word-row" aria-label="Target sentence word match">
        {overlap.targetWords.map((entry, index) => (
          <span key={`${entry.word}-${index}`} className={`fast-word${entry.matched ? '' : ' is-missed'}`}>
            {entry.word}
          </span>
        ))}
      </div>
    </div>
  );
}
