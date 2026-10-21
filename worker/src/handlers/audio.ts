// POST /api/audio handler. In this phase speech transcription is not
// configured yet: the handler validates the upload format and size, then
// answers 503 asr_not_configured. Audio bytes are never stored, logged,
// or forwarded anywhere.

import type { Env } from '../types.ts';
import { apiError, requestOrigin } from '../http.ts';

const MAX_AUDIO_BYTES = 1_500_000;

export async function handleAudio(request: Request, env: Env): Promise<Response> {
  void env;
  const origin = requestOrigin(request);
  if (request.method !== 'POST') {
    return apiError('method_not_allowed', 'Method not allowed.', 405, origin);
  }

  const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const isAudio = contentType.startsWith('audio/');
  const isMultipart = contentType === 'multipart/form-data';
  if (!isAudio && !isMultipart) {
    return apiError(
      'unsupported_media_type',
      'Content-Type must be an audio type or multipart/form-data.',
      415,
      origin,
    );
  }

  const lengthHeader = request.headers.get('Content-Length');
  if (lengthHeader) {
    if (!/^\d+$/.test(lengthHeader)) {
      return apiError('invalid_input', 'Invalid Content-Length header.', 400, origin);
    }
    if (Number(lengthHeader) > MAX_AUDIO_BYTES) {
      return apiError('payload_too_large', 'Audio must be at most 1.5 MB.', 413, origin);
    }
  } else if (request.body) {
    // Without a declared length, measure the streamed body with the same cap.
    const reader = request.body.getReader();
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_AUDIO_BYTES) {
          await reader.cancel();
          return apiError('payload_too_large', 'Audio must be at most 1.5 MB.', 413, origin);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Format and size are valid, but no transcription provider is wired up
  // in this phase.
  return apiError(
    'asr_not_configured',
    'Speech transcription is not available yet in this phase. Your audio was not stored or sent anywhere.',
    503,
    origin,
  );
}
