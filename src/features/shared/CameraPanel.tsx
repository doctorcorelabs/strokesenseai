import { useCallback, useEffect, useRef, useState } from 'react';
import { TOKENS } from './theme';

export type CameraStatus = 'idle' | 'requesting' | 'live' | 'denied' | 'unavailable' | 'error';

/** Stop every track of a media stream. Safe to call with null or twice. */
export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // A track that was already stopped must not break cleanup.
    }
  }
}

export interface CameraPanelProps {
  /** Called with a JPEG data URL whenever the user takes a snapshot. */
  onSnapshot?: (dataUrl: string) => void;
  /** Which camera to request. Defaults to the front camera. */
  facingMode?: 'user' | 'environment';
}

/**
 * Camera input with honest failure states: permission denied, no camera
 * available, and unexpected errors are each reported as themselves and
 * never replaced with a fake preview. The stream is always stopped when
 * the panel unmounts or the user stops it, and snapshots are drawn to a
 * canvas locally; nothing leaves the tab from this component.
 */
export default function CameraPanel({ onSnapshot, facingMode = 'user' }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [errorDetail, setErrorDetail] = useState('');
  const [snapshot, setSnapshot] = useState<string | null>(null);

  const releaseStream = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  async function start() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    setStatus('requesting');
    setErrorDetail('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        const played = video.play() as unknown;
        if (played instanceof Promise) {
          played.catch(() => undefined);
        }
      }
      setStatus('live');
    } catch (err) {
      const name = (err as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus('unavailable');
      } else {
        setErrorDetail(err instanceof Error ? err.message : 'Unknown camera error.');
        setStatus('error');
      }
    }
  }

  function stop() {
    releaseStream();
    setStatus('idle');
  }

  function takeSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || status !== 'live') return;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSnapshot(dataUrl);
    onSnapshot?.(dataUrl);
  }

  const live = status === 'live';

  return (
    <section className="panel" aria-label="Camera input">
      <h3 className="section-title">Camera</h3>

      <div
        style={{
          background: TOKENS.deep,
          borderRadius: TOKENS.radiusSm,
          overflow: 'hidden',
          aspectRatio: '4 / 3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          ref={videoRef}
          data-testid="camera-video"
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: live ? 'block' : 'none' }}
        />
        {!live ? (
          <p style={{ color: '#ffffff', padding: '1rem', textAlign: 'center', margin: 0 }}>
            {status === 'requesting' ? 'Waiting for camera permission...' : 'Camera preview is off.'}
          </p>
        ) : null}
      </div>

      {status === 'denied' ? (
        <div role="alert" style={{ marginTop: '1rem' }}>
          <p>
            <strong>Camera permission was denied.</strong> This lab cannot measure anything
            without the camera, and it will not guess a result instead.
          </p>
          <p className="muted">
            Allow camera access in your browser site settings for this page, then try again.
          </p>
        </div>
      ) : null}

      {status === 'unavailable' ? (
        <p role="note" style={{ marginTop: '1rem' }}>
          <strong>No camera is available</strong> in this browser or context. Camera access needs
          a secure (HTTPS) page and a device with a camera. You can still read the guide for this
          lab.
        </p>
      ) : null}

      {status === 'error' ? (
        <div role="alert" style={{ marginTop: '1rem' }}>
          <p>
            <strong>The camera could not be started.</strong>
            {errorDetail ? ` ${errorDetail}` : ''}
          </p>
          <p className="muted">Close other apps that may be using the camera, then try again.</p>
        </div>
      ) : null}

      <div className="wizard-actions">
        {!live ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={start}
            disabled={status === 'requesting'}
          >
            {status === 'requesting' ? 'Starting camera...' : 'Start camera'}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={takeSnapshot}>
              Take snapshot
            </button>
            <button type="button" className="btn" onClick={stop}>
              Stop camera
            </button>
          </>
        )}
      </div>

      <canvas ref={canvasRef} hidden aria-hidden="true" />

      {snapshot ? (
        <figure style={{ margin: '1rem 0 0' }}>
          <img
            src={snapshot}
            alt="Snapshot preview captured from the camera"
            style={{ borderRadius: TOKENS.radiusSm, border: `1px solid ${TOKENS.line}` }}
          />
          <figcaption className="muted">
            Snapshot preview. The image stays in this tab unless you explicitly choose to share
            derived measurements.
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
