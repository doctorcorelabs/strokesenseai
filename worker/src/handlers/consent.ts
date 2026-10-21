// Consent endpoints. POST issues a server-signed consent token (HS256 JWT,
// 2 hour expiry) for an explicit scope list, using issueConsentToken from
// auth.ts. DELETE acknowledges withdrawal.
//
// Phase 0 note: consent records are not persisted yet. The D1 audit
// binding exists in the environment but is intentionally not written by
// this handler until the persistence phase, so nothing here pretends to
// store a record. Withdrawal in this phase means the client discards its
// token; tokens also expire on their own after 2 hours.

import { CONSENT_NOTICE_VERSION } from '../../../shared/contracts.ts';
import { issueConsentToken } from '../auth.ts';
import type { Env } from '../types.ts';
import { apiError, isRecord, json, parseBoundedJson, requestOrigin } from '../http.ts';

const BODY_MAX_BYTES = 32_768;
export const CONSENT_SCOPES = ['chat', 'vision', 'audio', 'tools'] as const;
export const CONSENT_EXPIRES_IN = 7_200;

export async function handleConsentPost(request: Request, env: Env): Promise<Response> {
  const origin = requestOrigin(request);
  if (request.method !== 'POST') {
    return apiError('method_not_allowed', 'Method not allowed.', 405, origin);
  }
  const parsed = await parseBoundedJson(request, BODY_MAX_BYTES);
  if (!parsed.ok) {
    return parsed.reason === 'too_large'
      ? apiError('payload_too_large', 'Request body is too large.', 413, origin)
      : apiError('invalid_json', 'Request body must be valid JSON.', 400, origin);
  }
  const body = parsed.value;
  if (!isRecord(body)) return apiError('invalid_input', 'Expected a JSON object.', 400, origin);
  if (Object.keys(body).some((key) => !['sessionId', 'scopes', 'noticeVersion'].includes(key))) {
    return apiError('invalid_input', 'Expected sessionId, scopes, and noticeVersion only.', 400, origin);
  }
  if (typeof body.sessionId !== 'string' || !body.sessionId || body.sessionId.length > 100) {
    return apiError('invalid_input', 'sessionId must be a nonempty string of at most 100 characters.', 400, origin);
  }
  if (typeof body.noticeVersion !== 'string' || !body.noticeVersion || body.noticeVersion.length > 50) {
    return apiError('invalid_input', 'noticeVersion must be a nonempty string of at most 50 characters.', 400, origin);
  }
  if (body.noticeVersion !== CONSENT_NOTICE_VERSION) {
    // Clients cannot pick their own notice version: consent is only issued
    // against the notice text currently in force (shared/contracts.ts).
    return apiError(
      'notice_version_mismatch',
      'This consent notice version is no longer in force. Reload and review the current notice.',
      400,
      origin,
    );
  }
  if (
    !Array.isArray(body.scopes) ||
    body.scopes.length === 0 ||
    body.scopes.some(
      (scope) => typeof scope !== 'string' || !(CONSENT_SCOPES as readonly string[]).includes(scope),
    )
  ) {
    return apiError(
      'invalid_input',
      `scopes must be a nonempty subset of: ${CONSENT_SCOPES.join(', ')}.`,
      400,
      origin,
    );
  }
  const scopes = [...new Set(body.scopes as string[])];
  try {
    const token = await issueConsentToken(env, body.sessionId, scopes, body.noticeVersion);
    return json({ token, expiresIn: CONSENT_EXPIRES_IN }, 200, origin);
  } catch {
    return apiError('not_configured', 'Consent signing is not configured.', 503, origin);
  }
}

export async function handleConsentDelete(request: Request, env: Env): Promise<Response> {
  void env;
  const origin = requestOrigin(request);
  if (request.method !== 'DELETE') {
    return apiError('method_not_allowed', 'Method not allowed.', 405, origin);
  }
  // No server-side consent record exists to delete in this phase (see the
  // note at the top of this file). The withdrawal is acknowledged so the
  // client can discard its token immediately.
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(null, { status: 204, headers });
}
