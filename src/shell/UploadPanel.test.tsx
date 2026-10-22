import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UploadPanel from './UploadPanel';

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not rendered');
  return input as HTMLInputElement;
}

function pickFile(container: HTMLElement, file: File) {
  fireEvent.change(fileInput(container), { target: { files: [file] } });
}

function sizedFile(name: string, type: string, bytes: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('UploadPanel', () => {
  it('always shows the exact on-device privacy line', () => {
    render(<UploadPanel accept="image" label="Upload a photo of your face" onFile={() => undefined} />);
    expect(
      screen.getByText('Your file is analyzed on this device. It is never uploaded or stored.'),
    ).toBeInTheDocument();
  });

  it('replaces the privacy line with a custom one when privacyLine is passed', () => {
    render(
      <UploadPanel
        accept="both"
        label="Upload a photo or video"
        onFile={() => undefined}
        privacyLine="Frames from your file are sent to the AI service for analysis. Nothing is stored by this site."
      />,
    );
    expect(
      screen.getByText(
        'Frames from your file are sent to the AI service for analysis. Nothing is stored by this site.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Your file is analyzed on this device. It is never uploaded or stored.'),
    ).not.toBeInTheDocument();
  });

  it('maps the accept prop onto the hidden input', () => {
    const { container, rerender } = render(
      <UploadPanel accept="image" label="Upload a photo" onFile={() => undefined} />,
    );
    expect(fileInput(container).accept).toBe('image/*');
    rerender(<UploadPanel accept="video" label="Upload a video" onFile={() => undefined} />);
    expect(fileInput(container).accept).toBe('video/*');
    rerender(<UploadPanel accept="both" label="Upload a file" onFile={() => undefined} />);
    expect(fileInput(container).accept).toBe('image/*,video/*');
  });

  it('passes a valid image file to onFile and shows its name and size', () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadPanel accept="image" label="Upload a photo of your face" onFile={onFile} />,
    );
    const file = new File(['photo-bytes'], 'my-face.png', { type: 'image/png' });
    pickFile(container, file);
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByText('my-face.png')).toBeInTheDocument();
    expect(screen.getByText('11 B')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change file' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('rejects a file of the wrong type with a friendly in-panel message', () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadPanel accept="image" label="Upload a photo of your face" onFile={onFile} />,
    );
    pickFile(container, new File(['pdf'], 'notes.pdf', { type: 'application/pdf' }));
    expect(onFile).not.toHaveBeenCalled();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/not an image/);
    expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument();
  });

  it('rejects a video when only images are accepted, and an image when only video is', () => {
    const onFile = vi.fn();
    const { container, rerender } = render(
      <UploadPanel accept="image" label="Upload a photo" onFile={onFile} />,
    );
    pickFile(container, new File(['v'], 'clip.mp4', { type: 'video/mp4' }));
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/not an image/);

    rerender(<UploadPanel accept="video" label="Upload a video" onFile={onFile} />);
    pickFile(container, new File(['i'], 'face.jpg', { type: 'image/jpeg' }));
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/not a video/);
  });

  it('rejects an image over the 25 MB limit', () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadPanel accept="image" label="Upload a photo" onFile={onFile} />,
    );
    pickFile(container, sizedFile('huge.png', 'image/png', 26 * 1024 * 1024));
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/over the 25 MB limit/);
  });

  it('rejects a video over the 200 MB limit but accepts one under it', () => {
    const onFile = vi.fn();
    const { container } = render(
      <UploadPanel accept="video" label="Upload a video of your arm" onFile={onFile} />,
    );
    pickFile(container, sizedFile('long.mp4', 'video/mp4', 201 * 1024 * 1024));
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/over the 200 MB limit/);

    const ok = sizedFile('short.mp4', 'video/mp4', 12 * 1024 * 1024);
    pickFile(container, ok);
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(ok);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('12 MB')).toBeInTheDocument();
  });

  it('remove returns the panel to its empty state and calls onClear', () => {
    const onFile = vi.fn();
    const onClear = vi.fn();
    const { container } = render(
      <UploadPanel accept="both" label="Upload a photo or video" onFile={onFile} onClear={onClear} />,
    );
    pickFile(container, new File(['x'], 'face.jpg', { type: 'image/jpeg' }));
    expect(screen.getByText('face.jpg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('face.jpg')).not.toBeInTheDocument();
    expect(screen.getByText(/drop it here/)).toBeInTheDocument();
  });

  it('opens the picker from the keyboard with Enter and Space', () => {
    const { container } = render(
      <UploadPanel accept="image" label="Upload a photo of your face" onFile={() => undefined} />,
    );
    const input = fileInput(container);
    const clickSpy = vi.spyOn(input, 'click');
    const zone = screen.getByRole('button', { name: /Upload a photo of your face/ });
    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.keyDown(zone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });
});
