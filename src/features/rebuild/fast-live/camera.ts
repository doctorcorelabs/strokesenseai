// Shared camera stream handling for the FAST Live Check vision stages.
//
// One small hook owns getUserMedia so the face and arm stages start,
// stop, and fail the camera in exactly the same way. Failures are
// classified with the shared PermissionPrime helper, because a denied
// permission, a missing camera, and a busy camera each need a
// different fix from the person holding the device.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  permissionFailureFromError,
  type PermissionFailure,
} from '../../../components/PermissionPrime';

export type CameraStatus = 'idle' | 'starting' | 'live' | 'failed';

export interface CameraStream {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  failure: PermissionFailure | null;
  start: () => Promise<boolean>;
  stop: () => void;
}

export function useCameraStream(): CameraStream {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [failure, setFailure] = useState<PermissionFailure | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus('idle');
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setFailure('unavailable');
      setStatus('failed');
      return false;
    }
    setStatus('starting');
    setFailure(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setStatus('live');
      return true;
    } catch (error) {
      setFailure(permissionFailureFromError(error));
      setStatus('failed');
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, status, failure, start, stop };
}
