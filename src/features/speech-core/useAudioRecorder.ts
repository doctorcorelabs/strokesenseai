// Browser microphone recording with MediaRecorder.
//
// Audio lives in memory only: the finished take is exposed as an object
// URL for playback plus the raw Blob so the caller can run local waveform
// analysis. Nothing is uploaded or persisted by this hook. The take is
// capped (30 seconds by default, matching the speech pipeline limit in
// the planning document) and recording stops itself at the cap.

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'recording' | 'recorded' | 'error';

export interface AudioRecorder {
  status: RecorderStatus;
  /** True when this browser can record at all. */
  supported: boolean;
  /** Elapsed seconds of the current or last take, one decimal place. */
  elapsedSeconds: number;
  /** Playback URL of the finished take, or null. */
  audioUrl: string | null;
  /** The finished take, for local analysis. Null until a take completes. */
  blob: Blob | null;
  /** Measured duration of the finished take in seconds. */
  durationSeconds: number;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

function recorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function useAudioRecorder(maxSeconds = 30): AudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const supported = recorderSupported();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    } else {
      stopTracks();
    }
  }, [clearTimer, stopTracks]);

  const start = useCallback(() => {
    if (!supported) {
      setError('Recording is not available in this browser. You can type the transcript instead.');
      setStatus('error');
      return;
    }
    setError(null);
    setBlob(null);
    setDurationSeconds(0);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    chunksRef.current = [];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          const duration = (performance.now() - startedAtRef.current) / 1000;
          const take = new Blob(chunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          setBlob(take);
          setDurationSeconds(Math.round(duration * 10) / 10);
          setElapsedSeconds(Math.round(duration * 10) / 10);
          setAudioUrl(URL.createObjectURL(take));
          setStatus('recorded');
          stopTracks();
        };
        recorder.start(250);
        startedAtRef.current = performance.now();
        setStatus('recording');
        setElapsedSeconds(0);
        timerRef.current = window.setInterval(() => {
          const elapsed = (performance.now() - startedAtRef.current) / 1000;
          setElapsedSeconds(Math.round(elapsed * 10) / 10);
          if (elapsed >= maxSeconds) stop();
        }, 100);
      })
      .catch(() => {
        setError(
          'Microphone access was not granted. Check the browser permission, or type the transcript instead.',
        );
        setStatus('error');
      });
  }, [audioUrl, maxSeconds, stop, stopTracks, supported]);

  const reset = useCallback(() => {
    stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setBlob(null);
    setDurationSeconds(0);
    setElapsedSeconds(0);
    setError(null);
    setStatus('idle');
  }, [audioUrl, stop]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
    };
  }, [clearTimer, stopTracks]);

  return {
    status,
    supported,
    elapsedSeconds,
    audioUrl,
    blob,
    durationSeconds,
    error,
    start,
    stop,
    reset,
  };
}

/**
 * Decode a recorded take locally and return its samples for waveform
 * analysis. Returns null when decoding is unavailable or fails; callers
 * treat that as "no acoustic panel", never as a silent zero.
 */
export async function decodeSamples(
  blob: Blob,
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  const AudioContextCtor =
    typeof window !== 'undefined'
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined;
  if (!AudioContextCtor) return null;
  try {
    const context = new AudioContextCtor();
    try {
      const buffer = await blob.arrayBuffer();
      const decoded = await context.decodeAudioData(buffer);
      return { samples: decoded.getChannelData(0), sampleRate: decoded.sampleRate };
    } finally {
      await context.close().catch(() => undefined);
    }
  } catch {
    return null;
  }
}
