// Web Speech API transcription (browser built-in speech recognition).
//
// Support is uneven: Chromium-based browsers ship it, others do not. This
// hook reports support honestly and the UI falls back to typing the
// transcript by hand, which always stays available and editable. Note
// that in most browsers this recognition runs through the browser
// vendor's service; the UI says so next to the control.

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const holder = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return holder.SpeechRecognition ?? holder.webkitSpeechRecognition;
}

/** True when this browser exposes the Web Speech API recognizer. */
export function speechRecognitionSupported(): boolean {
  return recognitionCtor() !== undefined;
}

export interface SpeechRecognitionState {
  supported: boolean;
  listening: boolean;
  /** Final transcript accumulated so far. */
  transcript: string;
  /** In-progress words that may still change. */
  interim: string;
  error: string | null;
  start: (locale: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionState {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = speechRecognitionSupported();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const clear = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  const start = useCallback(
    (locale: string) => {
      const Ctor = recognitionCtor();
      if (!Ctor) {
        setError('Speech recognition is not available in this browser. Type the transcript instead.');
        return;
      }
      stop();
      setError(null);
      const recognition = new Ctor();
      recognitionRef.current = recognition;
      recognition.lang = locale;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        setTranscript(finalText.trim());
        setInterim(interimText.trim());
      };
      recognition.onerror = () => {
        setError(
          'Speech recognition stopped with an error. Check the microphone and browser permission, or type the transcript instead.',
        );
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      try {
        recognition.start();
        setListening(true);
      } catch {
        setError('Speech recognition could not start. Type the transcript instead.');
        setListening(false);
      }
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, clear };
}
