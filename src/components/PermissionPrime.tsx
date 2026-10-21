// PermissionPrime: one shared priming pattern for device permissions,
// modeled on the FAST CameraStage, which the UX audits rated the clearest
// of the four separate camera implementations this repo grew.
//
// The contract, the same in every lab:
// - Before getUserMedia is ever called, the person reads one sentence on
//   why the device is needed and one sentence on where the data goes (on
//   this device, never uploaded), and only then presses Start.
// - If access fails, every lab shows the same structure: what happened,
//   what to do about it, a Try again button, and working exit buttons to
//   routes that need no device (synthetic demo, upload, manual practice).
//   Exits are buttons with real handlers, never dead text.
// - Failures are classified honestly, the way the shared CameraPanel does
//   it: denied is not unavailable is not some other error, because each
//   one points at a different fix.

import { Camera, Mic } from 'lucide-react';
import './PermissionPrime.css';

export type PermissionDevice = 'camera' | 'microphone';

/** denied: the person or browser refused. unavailable: no device or no
 * API in this context. error: anything else, for example the device is
 * busy in another app. */
export type PermissionFailure = 'denied' | 'unavailable' | 'error';

export interface PermissionExit {
  label: string;
  onSelect: () => void;
}

/** Classify a getUserMedia rejection the same way everywhere. */
export function permissionFailureFromError(error: unknown): PermissionFailure {
  const name = (error as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'error';
}

const DEVICE_NOUN: Record<PermissionDevice, string> = {
  camera: 'camera',
  microphone: 'microphone',
};

const DEFAULT_PRIVACY: Record<PermissionDevice, string> = {
  camera: 'The video is processed on this device and is never uploaded or stored.',
  microphone: 'The audio is processed on this device and is never uploaded or stored.',
};

function ExitRow({ device, exits }: { device: PermissionDevice; exits: PermissionExit[] }) {
  if (exits.length === 0) return null;
  return (
    <div className="permission-exits">
      <span className="muted">Or continue without the {DEVICE_NOUN[device]}:</span>
      <div className="permission-exit-row">
        {exits.map((exit) => (
          <button key={exit.label} type="button" className="btn" onClick={exit.onSelect}>
            {exit.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The priming card shown before a device is requested. `why` is one
 * sentence on what the device is for in this lab; the privacy sentence
 * defaults to the on-device statement and may be overridden when a lab
 * needs a more precise one (for example a preview that is shown but not
 * analyzed). The Start button lives inside the card, after both
 * sentences, so nobody meets the browser permission prompt without
 * context.
 */
export default function PermissionPrime({
  device,
  why,
  privacyNote,
  onStart,
  exits = [],
  startLabel,
}: {
  device: PermissionDevice;
  why: string;
  privacyNote?: string;
  onStart: () => void;
  exits?: PermissionExit[];
  startLabel?: string;
}) {
  const Icon = device === 'camera' ? Camera : Mic;
  return (
    <div className="permission-prime">
      <p className="permission-prime-why">{why}</p>
      <p className="muted">{privacyNote ?? DEFAULT_PRIVACY[device]}</p>
      <div className="permission-prime-actions">
        <button type="button" className="btn btn-primary" onClick={onStart}>
          <Icon size={16} aria-hidden="true" /> {startLabel ?? `Start ${DEVICE_NOUN[device]}`}
        </button>
      </div>
      <ExitRow device={device} exits={exits} />
    </div>
  );
}

const FAILURE_HEADLINE: Record<PermissionFailure, Record<PermissionDevice, string>> = {
  denied: {
    camera: 'Camera permission was denied.',
    microphone: 'Microphone permission was denied.',
  },
  unavailable: {
    camera: 'No camera is available in this browser.',
    microphone: 'No microphone is available in this browser.',
  },
  error: {
    camera: 'The camera could not be started.',
    microphone: 'The microphone could not be started.',
  },
};

const FAILURE_GUIDANCE: Record<PermissionFailure, string> = {
  denied:
    'Allow access in your browser site settings for this page, then try again. Nothing was recorded.',
  unavailable:
    'Device access needs a secure (HTTPS) page and a connected device. Nothing was recorded.',
  error:
    'Another app may be using the device, or it stopped responding. Close other apps that use it, then try again. Nothing was recorded.',
};

/**
 * The uniform blocked state. Same structure in every lab: a headline
 * that names what actually happened, one guidance sentence, a Try again
 * button when retrying makes sense, and the same working exit buttons
 * the priming card offered.
 */
export function PermissionDenied({
  device,
  failure,
  onRetry,
  exits = [],
}: {
  device: PermissionDevice;
  failure: PermissionFailure;
  onRetry?: () => void;
  exits?: PermissionExit[];
}) {
  return (
    <div className="permission-denied" role="alert">
      <p>
        <strong>{FAILURE_HEADLINE[failure][device]}</strong>
      </p>
      <p className="muted">{FAILURE_GUIDANCE[failure]}</p>
      {(onRetry || exits.length > 0) && (
        <div className="permission-denied-actions">
          {onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
          {exits.map((exit) => (
            <button key={exit.label} type="button" className="btn" onClick={exit.onSelect}>
              {exit.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
