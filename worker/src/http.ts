// Shared HTTP response helpers for all Worker handlers.
// Error shape is always { error: { code, message } } with safe, user-facing
// messages only. Never put provider payloads, credentials, or exception
// text into a response built with these helpers.

export function json(data: unknown, status = 200, origin?: string | null): Response {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Vary', 'Origin');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(JSON.stringify(data), { status, headers });
}

export function apiError(code: string, message: string, status: number, origin?: string | null): Response {
  return json({ error: { code, message } }, status, origin);
}

export function requestOrigin(request: Request): string | null {
  return request.headers.get('Origin');
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Reads a request body as text with a hard byte cap. Returns null when the
// body exceeds the cap or cannot be decoded as UTF-8.
export async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const lengthHeader = request.headers.get('Content-Length');
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

// Parses a bounded JSON request body. Distinguishes "too large" from
// "invalid JSON" so handlers can answer 413 vs 400 correctly.
export async function parseBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; reason: 'too_large' | 'invalid_json' }> {
  const text = await readBoundedText(request, maxBytes);
  if (text === null) return { ok: false, reason: 'too_large' };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}
