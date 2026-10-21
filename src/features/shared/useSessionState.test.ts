import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionState } from './useSessionState';

describe('useSessionState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle with zero elapsed', () => {
    const { result } = renderHook(() => useSessionState());
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsedMs).toBe(0);
  });

  it('accumulates elapsed time while running', () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current.start());
    expect(result.current.state).toBe('running');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.elapsedMs).toBe(1500);
  });

  it('freezes elapsed time on finish and stops ticking', () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => result.current.finish());
    expect(result.current.state).toBe('done');
    expect(result.current.elapsedMs).toBe(2000);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.elapsedMs).toBe(2000);
  });

  it('finish while idle is a no-op', () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current.finish());
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsedMs).toBe(0);
  });

  it('resets to idle and can restart cleanly', () => {
    const { result } = renderHook(() => useSessionState());
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => result.current.reset());
    expect(result.current.state).toBe('idle');
    expect(result.current.elapsedMs).toBe(0);
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.state).toBe('running');
    expect(result.current.elapsedMs).toBe(300);
  });

  it('clears its interval on unmount', () => {
    const { result, unmount } = renderHook(() => useSessionState());
    act(() => result.current.start());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
