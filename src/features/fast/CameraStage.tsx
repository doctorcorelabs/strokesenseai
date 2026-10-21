import { useEffect, useRef, useState } from 'react';
import { Camera, VideoOff } from 'lucide-react';
import { CannotAnalyzePanel } from '../../components/ui';
import type { StageId } from './session';

type CameraStatus = 'idle' | 'live' | 'denied' | 'unsupported';

/**
 * Draw the framing guides for the active stage. The guides are alignment
 * aids only: an ellipse to center a face, a shoulder line and two arm
 * zones for the raise task. Nothing here detects or measures anatomy;
 * the measurements in this lab are the human checklist observations.
 */
function drawGuides(ctx: CanvasRenderingContext2D, w: number, h: number, stageId: StageId) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(215, 233, 220, 0.9)';
  ctx.lineWidth = Math.max(2, w * 0.004);
  ctx.setLineDash([w * 0.02, w * 0.014]);
  if (stageId === 'face') {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.17, h * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.63);
    ctx.lineTo(w * 0.62, h * 0.63);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.4);
    ctx.lineTo(w * 0.92, h * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.08);
    ctx.lineTo(w * 0.25, h * 0.92);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.75, h * 0.08);
    ctx.lineTo(w * 0.75, h * 0.92);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * Camera panel for the face and arm stages. The camera starts only when
 * the person presses the button, the stream stays on this device, and
 * nothing is recorded or uploaded. In demo mode no camera is touched at
 * all and a synthetic placeholder is shown instead.
 */
export default function CameraStage({
  stageId,
  demoMode,
}: {
  stageId: StageId;
  demoMode: boolean;
}) {
  const [status, setStatus] = useState<CameraStatus>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const stageRef = useRef(stageId);
  stageRef.current = stageId;

  function stop() {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // Switching to demo mode or unmounting always releases the camera.
  useEffect(() => {
    if (demoMode && streamRef.current) {
      stop();
      setStatus('idle');
    }
  }, [demoMode]);

  useEffect(() => stop, []);

  function runOverlayLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (video.videoWidth > 0 && canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    if (canvas.width > 0) drawGuides(ctx, canvas.width, canvas.height, stageRef.current);
    rafRef.current = requestAnimationFrame(runOverlayLoop);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('live');
      runOverlayLoop();
    } catch {
      setStatus('denied');
    }
  }

  if (demoMode) {
    return (
      <div>
        <div className="fast-demo-frame" aria-label="Synthetic demo view">
          <div>
            <div className="fast-demo-ring" aria-hidden="true" />
            <p>
              <strong>Synthetic demo view.</strong> No camera is used in demo mode. Practice the
              task timing and the checklist with an imagined volunteer, and mark data quality as
              limited, because demo data is not a real measurement.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="fast-camera">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview, mirrored" />
        <canvas ref={canvasRef} aria-hidden="true" />
        {status !== 'live' && (
          <div className="fast-camera-idle">
            <p>
              Camera is off. It starts only when you press Start camera, and the video never
              leaves this device.
            </p>
          </div>
        )}
      </div>
      <div className="fast-controls-row">
        {status === 'live' ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              stop();
              setStatus('idle');
            }}
          >
            <VideoOff size={16} aria-hidden="true" /> Stop camera
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void start()}>
            <Camera size={16} aria-hidden="true" /> Start camera
          </button>
        )}
        <span className="muted" role="status">
          {status === 'live'
            ? 'Camera on. Line up the face or shoulders with the guides, then run the timer.'
            : status === 'denied' || status === 'unsupported'
              ? 'Camera unavailable. You can still observe directly, or mark this stage as cannot analyze.'
              : 'The framing guides are alignment aids only. They do not measure anything.'}
        </span>
      </div>
      {(status === 'denied' || status === 'unsupported') && (
        <CannotAnalyzePanel
          role="alert"
          reason={
            status === 'denied'
              ? 'Camera access was not granted, or the camera is in use by another app, so this stage has no camera view.'
              : 'This browser does not offer camera access, so this stage has no camera view.'
          }
          guidance="Observing the person directly and answering the checklist is still valid practice. If you cannot observe either, use the mark as cannot analyze control below; the stage will be reported as cannot analyze and will not be filled in by another stage."
        />
      )}
    </div>
  );
}
