// UploadPanel: the one file picker every upload-first lab shares.
//
// The rebuilt vision labs (Face Lab, Movement Lab, FAST Live) take a
// photo or a video the person already has instead of depending on a
// live camera. This component is only the picker: it validates the
// chosen file lightly on the client, shows what was picked, and hands
// the File to the feature through onFile. It never renders a media
// preview; showing and analyzing the file is the feature's job.
//
// The privacy line is part of the component, not the feature, so it
// cannot be forgotten. The default line says the file is analyzed on
// this device and is never uploaded or stored, and it says exactly
// that. A feature that really does send the file to a service must
// override it with the privacyLine prop and say exactly where the
// file goes; the default must never be left standing where it would
// be untrue.

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import './upload.css';

export interface UploadPanelProps {
  /** Which kind of file this lab takes. */
  accept: 'image' | 'video' | 'both';
  /** Called with the file once it passes validation. */
  onFile: (file: File) => void;
  /** The main invitation text, for example "Upload a photo of your face". */
  label: string;
  /** Optional guidance about what the file should show. */
  hint?: string;
  /** Disables picking, dropping, and the change/remove actions. */
  disabled?: boolean;
  /** Called when the person removes the selected file. */
  onClear?: () => void;
  /** The privacy line under the picker. Defaults to the on-device
   * line; labs whose analysis runs through the AI service pass their
   * own exact line so the panel never claims the wrong thing. */
  privacyLine?: string;
}

const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;

const ACCEPT_ATTRIBUTE: Record<UploadPanelProps['accept'], string> = {
  image: 'image/*',
  video: 'video/*',
  both: 'image/*,video/*',
};

type FileKind = 'image' | 'video';

function kindOf(file: File): FileKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

/** Returns a friendly rejection message, or null when the file is usable. */
function validate(file: File, accept: UploadPanelProps['accept']): string | null {
  const kind = kindOf(file);
  if (kind === null || (accept !== 'both' && kind !== accept)) {
    if (accept === 'image') {
      return 'That file is not an image. Please choose an image file, for example a JPG or PNG photo.';
    }
    if (accept === 'video') {
      return 'That file is not a video. Please choose a video file, for example an MP4 recording.';
    }
    return 'That file is not an image or a video. Please choose an image or video file.';
  }
  if (kind === 'image' && file.size > IMAGE_MAX_BYTES) {
    return `That image is ${formatSize(file.size)}, which is over the 25 MB limit. Please choose a smaller image.`;
  }
  if (kind === 'video' && file.size > VIDEO_MAX_BYTES) {
    return `That video is ${formatSize(file.size)}, which is over the 200 MB limit. Please choose a shorter or smaller video.`;
  }
  return null;
}

export default function UploadPanel({
  accept,
  onFile,
  label,
  hint,
  disabled = false,
  onClear,
  privacyLine = 'Your file is analyzed on this device. It is never uploaded or stored.',
}: UploadPanelProps) {
  const inputId = useId();
  const labelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  // Clicking the label or calling input.click() makes a click event
  // bubble up from the input itself; the zone must not answer that
  // with a second picker opening.
  const handleZoneClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === inputRef.current) return;
    openPicker();
  };

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validate(file, accept);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSelected({ name: file.name, size: file.size });
    onFile(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    takeFile(event.target.files?.[0]);
    // Reset so picking the same file again still fires a change event.
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    takeFile(event.dataTransfer.files?.[0]);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleRemove = () => {
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onClear?.();
  };

  // While no file is picked, the whole zone is the control: clickable,
  // keyboard focusable, and labelled by the label element. Once a file
  // is picked the zone becomes a plain summary card, so the Change and
  // Remove buttons inside it are never nested inside another control.
  const picking = selected === null;

  return (
    <div className="upload-panel">
      <div
        className={`upload-zone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
        role={picking ? 'button' : undefined}
        tabIndex={picking && !disabled ? 0 : undefined}
        aria-labelledby={picking ? labelId : undefined}
        aria-disabled={picking && disabled ? true : undefined}
        onClick={picking ? handleZoneClick : undefined}
        onKeyDown={picking ? handleKeyDown : undefined}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          id={inputId}
          className="upload-input"
          type="file"
          accept={ACCEPT_ATTRIBUTE[accept]}
          disabled={disabled}
          onChange={handleChange}
          tabIndex={-1}
        />
        <label id={labelId} htmlFor={inputId} className="upload-label">
          {label}
        </label>
        {selected ? (
          <div className="upload-selected">
            <p className="upload-file-name">{selected.name}</p>
            <p className="upload-file-size">{formatSize(selected.size)}</p>
            <div className="upload-actions">
              <button type="button" className="btn" disabled={disabled} onClick={openPicker}>
                Change file
              </button>
              <button type="button" className="btn" disabled={disabled} onClick={handleRemove}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-empty">
            {hint ? <p className="upload-hint">{hint}</p> : null}
            <p className="upload-drop-note">Tap to choose a file, or drop it here.</p>
          </div>
        )}
      </div>

      {error ? (
        <p className="upload-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      <p className="upload-privacy">{privacyLine}</p>
    </div>
  );
}
