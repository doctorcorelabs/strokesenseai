import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraPanel from './CameraPanel';

function setMediaDevices(value: unknown) {
  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value,
  });
}

function fakeStream(trackStop: () => void): MediaStream {
  return {
    getTracks: () => [{ stop: trackStop }],
    getVideoTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;
}

describe('CameraPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    setMediaDevices(undefined);
    vi.restoreAllMocks();
  });

  it('goes live with a mocked stream, snapshots to canvas, and stops tracks on stop', async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream(trackStop));
    setMediaDevices({ getUserMedia });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,xyz',
    );
    const onSnapshot = vi.fn();

    render(<CameraPanel onSnapshot={onSnapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));

    expect(await screen.findByRole('button', { name: 'Stop camera' })).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'user' }, audio: false });

    fireEvent.click(screen.getByRole('button', { name: 'Take snapshot' }));
    expect(onSnapshot).toHaveBeenCalledWith('data:image/jpeg;base64,xyz');
    expect(screen.getByAltText('Snapshot preview captured from the camera')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
    expect(trackStop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start camera' })).toBeInTheDocument();
  });

  it('stops tracks when unmounted while live', async () => {
    const trackStop = vi.fn();
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(fakeStream(trackStop)) });

    const { unmount } = render(<CameraPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
    expect(await screen.findByRole('button', { name: 'Stop camera' })).toBeInTheDocument();

    unmount();
    expect(trackStop).toHaveBeenCalled();
  });

  it('reports permission denied as itself', async () => {
    const denied = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });
    setMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(denied) });

    render(<CameraPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Camera permission was denied');
    expect(screen.queryByRole('button', { name: 'Stop camera' })).not.toBeInTheDocument();
  });

  it('reports a missing camera API as unavailable', async () => {
    setMediaDevices(undefined);

    render(<CameraPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));

    expect(await screen.findByText(/No camera is available/)).toBeInTheDocument();
  });
});
