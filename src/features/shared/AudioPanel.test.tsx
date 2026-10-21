import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioPanel, { formatDuration } from './AudioPanel';

class MockMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: unknown) {}

  start() {
    this.state = 'recording';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
  }

  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
}

function setMediaDevices(value: unknown) {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value,
  });
}

function fakeStream(trackStop: () => void): MediaStream {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

describe('formatDuration', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_400)).toBe('0:09');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(600_000)).toBe('10:00');
  });
});

describe('AudioPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    setMediaDevices(undefined);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('records, reports the blob and duration, and offers playback', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(trackStop));
    setMediaDevices({ getUserMedia });
    const onRecording = vi.fn();

    render(<AudioPanel onRecording={onRecording} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
    expect(screen.getByText(/Recording:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));

    expect(await screen.findByText(/Recorded:/)).toBeInTheDocument();
    expect(onRecording).toHaveBeenCalledTimes(1);
    const [blob, duration] = onRecording.mock.calls[0] as [Blob, number];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/webm');
    expect(typeof duration).toBe('number');
    expect(screen.getByTestId('audio-playback')).toHaveAttribute('src', 'blob:mock-url');
    expect(trackStop).toHaveBeenCalled();
  });

  it('reports permission denied as itself', async () => {
    const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    setMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(denied) });

    render(<AudioPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone permission was denied');
  });

  it('falls back clearly when MediaRecorder is not supported', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    setMediaDevices({ getUserMedia: vi.fn() });

    render(<AudioPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));

    expect(await screen.findByText(/not available/)).toBeInTheDocument();
  });
});
