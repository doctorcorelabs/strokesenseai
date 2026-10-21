import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PermissionPrime, { PermissionDenied, permissionFailureFromError } from './PermissionPrime';
import FaceAnalyzerLab from '../features/vision-face/FaceAnalyzerLab';

describe('PermissionPrime', () => {
  it('primes before the request: why, on-device privacy, then the Start button', () => {
    const onStart = vi.fn();
    render(
      <PermissionPrime
        device="camera"
        why="A live preview helps you frame a face before a snapshot."
        onStart={onStart}
      />,
    );
    expect(screen.getByText(/frame a face before a snapshot/)).toBeInTheDocument();
    expect(
      screen.getByText('The video is processed on this device and is never uploaded or stored.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start camera/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('uses the microphone wording and audio privacy for microphone devices', () => {
    render(<PermissionPrime device="microphone" why="We listen to a short reading." onStart={() => undefined} />);
    expect(screen.getByRole('button', { name: /Start microphone/ })).toBeInTheDocument();
    expect(
      screen.getByText('The audio is processed on this device and is never uploaded or stored.'),
    ).toBeInTheDocument();
  });

  it('renders exits as working buttons, not text', () => {
    const onDemo = vi.fn();
    render(
      <PermissionPrime
        device="camera"
        why="For framing."
        onStart={() => undefined}
        exits={[{ label: 'Use the synthetic demo instead', onSelect: onDemo }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use the synthetic demo instead' }));
    expect(onDemo).toHaveBeenCalledTimes(1);
  });
});

describe('PermissionDenied', () => {
  it('names the failure, gives the fix, and keeps retry and exits working', () => {
    const onRetry = vi.fn();
    const onUpload = vi.fn();
    render(
      <PermissionDenied
        device="camera"
        failure="denied"
        onRetry={onRetry}
        exits={[{ label: 'Upload a photo instead', onSelect: onUpload }]}
      />,
    );
    expect(screen.getByText('Camera permission was denied.')).toBeInTheDocument();
    expect(screen.getByText(/browser site settings/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing was recorded/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Upload a photo instead' }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an unavailable device from a denial', () => {
    render(<PermissionDenied device="camera" failure="unavailable" />);
    expect(screen.getByText('No camera is available in this browser.')).toBeInTheDocument();
    expect(screen.queryByText(/permission was denied/)).not.toBeInTheDocument();
  });
});

describe('permissionFailureFromError', () => {
  it('classifies DOMException names the same way as the shared CameraPanel', () => {
    expect(permissionFailureFromError(new DOMException('x', 'NotAllowedError'))).toBe('denied');
    expect(permissionFailureFromError(new DOMException('x', 'SecurityError'))).toBe('denied');
    expect(permissionFailureFromError(new DOMException('x', 'NotFoundError'))).toBe('unavailable');
    expect(permissionFailureFromError(new DOMException('x', 'OverconstrainedError'))).toBe(
      'unavailable',
    );
    expect(permissionFailureFromError(new DOMException('x', 'NotReadableError'))).toBe('error');
    expect(permissionFailureFromError(new Error('boom'))).toBe('error');
  });
});

describe('Face Analyzer camera entry (integration)', () => {
  it('shows the priming card in camera mode, with a working synthetic exit', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('tab', { name: /Camera snapshot/i }));
    expect(screen.getByText(/frame a face inside the guide oval/)).toBeInTheDocument();
    expect(
      screen.getByText('The video is processed on this device and is never uploaded or stored.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use the synthetic lab instead' }));
    expect(screen.getByRole('heading', { name: 'Synthetic lab' })).toBeInTheDocument();
  });

  it('shows the uniform unavailable state when the browser offers no camera', async () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('tab', { name: /Camera snapshot/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start camera/ }));
    expect(await screen.findByText('No camera is available in this browser.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload a photo instead' })).toBeInTheDocument();
  });
});
