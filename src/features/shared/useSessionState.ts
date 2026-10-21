import { useCallback, useEffect, useRef, useState } from 'react';

export type SessionState = 'idle' | 'running' | 'done';

export interface SessionControls {
  /** Current phase of the practice session. */
  state: SessionState;
  /** Milliseconds elapsed in the current (or last finished) session. */
  elapsedMs: number;
  /** Start a session. Safe to call again after finish or reset: it restarts the timer. */
  start: () => void;
  /** End the running session and freeze the elapsed time. No-op when not running. */
  finish: () => void;
  /** Return to idle and clear the elapsed time. */
  reset: () => void;
}

const TICK_MS = 100;

/**
 * Minimal practice-session state machine shared by every Phase 1 lab:
 * idle, then running with a ticking timer, then done with the elapsed
 * time frozen. The interval is always cleaned up on finish, reset, and
 * unmount, so a lab can never leak a timer by forgetting it.
 */
export function useSessionState(): SessionControls {
  const [state, setState] = useState<SessionState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState('running');
    intervalRef.current = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, TICK_MS);
  }, [clearTimer]);

  const finish = useCallback(() => {
    if (startedAtRef.current === null) return;
    setElapsedMs(Date.now() - startedAtRef.current);
    clearTimer();
    startedAtRef.current = null;
    setState('done');
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    startedAtRef.current = null;
    setElapsedMs(0);
    setState('idle');
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { state, elapsedMs, start, finish, reset };
}
