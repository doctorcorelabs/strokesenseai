import { useCallback, useEffect, useRef, useState } from 'react';
import { stopStream } from './CameraPanel';

/** Format milliseconds as m:ss for durations and timers. */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export type AudioStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'recorded'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface AudioPanelProps {
  /** Called once per finished recording with the blob and its duration. */
  onRecording?: (blob: Blob, durationMs: number) => void;
  /** Optional automatic stop, in seconds. */
  maxDurationSec?: number;
}

/**
 * Microphone recording with playback and honest failure states. Uses
 * MediaRecorder when the browser provides it and reports a clear
 * fallback when recording is not supported or permission is denied.
 * The microphone stream is released as soon as recording stops, and
 * recordings only exist as an in-tab object URL.
 */
export default function AudioPanel({ onRecording, maxDurationSec }: AudioPanelProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);

  const [status, setStatus] = useState<AudioStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState('');

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseAll = useCallback(() => {
    clearTimer();
    stopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, [clearTimer]);

  useEffect(() => releaseAll, [releaseAll]);

  function handleRecorderStop() {
    clearTimer();
    const recorder = recorderRef.current;
    const startedAt = startedAtRef.current;
    const duration = startedAt !== null ? Date.now() - startedAt : 0;
    startedAtRef.current = null;
    const blob = new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' });
    chunksRef.current = [];
    stopStream(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setAudioUrl(url);
    setDurationMs(duration);
    setStatus('recorded');
    onRecording?.(blob, duration);
  }

  async function start() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setStatus('unavailable');
      return;
    }
    setStatus('requesting');
    setErrorDetail('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('unavailable');
      } else {
        setErrorDetail(err instanceof Error ? err.message : 'Unknown microphone error.');
        setStatus('error');
      }
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = handleRecorderStop;
    recorder.start();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setStatus('recording');
    timerRef.current = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (maxDurationSec !== undefined && elapsed >= maxDurationSec * 1000) {
          stop();
        }
      }
    }, 200);
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  function discard() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setAudioUrl(null);
    setDurationMs(0);
    setElapsedMs(0);
    setStatus('idle');
  }

  const recording = status === 'recording';

  return (
    <section className="panel" aria-label="Audio recording">
      <h3 className="section-title">Microphone</h3>

      <p aria-live="polite" style={{ margin: '0 0 0.5rem' }}>
        {recording ? (
          <>
            <strong>Recording:</strong> {formatDuration(elapsedMs)}
            {maxDurationSec !== undefined ? ` of ${formatDuration(maxDurationSec * 1000)}` : ''}
          </>
        ) : status === 'recorded' ? (
          <>
            <strong>Recorded:</strong> {formatDuration(durationMs)}
          </>
        ) : (
          'Not recording.'
        )}
      </p>

      {status === 'denied' ? (
        <div role="alert">
          <p>
            <strong>Microphone permission was denied.</strong> This lab cannot measure speech
            without the microphone, and it will not guess a result instead.
          </p>
          <p className="muted">
            Allow microphone access in your browser site settings for this page, then try again.
          </p>
        </div>
      ) : null}

      {status === 'unavailable' ? (
        <p role="note">
          <strong>Audio recording is not available</strong> in this browser. Recording needs a
          browser with MediaRecorder support and a secure (HTTPS) page. You can still read the
          guide for this lab.
        </p>
      ) : null}

      {status === 'error' ? (
        <div role="alert">
          <p>
            <strong>The microphone could not be started.</strong>
            {errorDetail ? ` ${errorDetail}` : ''}
          </p>
        </div>
      ) : null}

      {audioUrl ? (
        <audio
          data-testid="audio-playback"
          controls
          src={audioUrl}
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          Your browser does not support audio playback.
        </audio>
      ) : null}

      <div className="wizard-actions">
        {!recording ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={start}
            disabled={status === 'requesting'}
          >
            {status === 'requesting' ? 'Starting microphone...' : 'Start recording'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={stop}>
            Stop recording
          </button>
        )}
        {status === 'recorded' ? (
          <button type="button" className="btn" onClick={discard}>
            Discard and record again
          </button>
        ) : null}
      </div>
    </section>
  );
}
