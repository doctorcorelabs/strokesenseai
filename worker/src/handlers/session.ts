// POST /api/session handler: creates a fresh server-side session id.
// The id is an opaque UUID; session state (consent, history, quotas) is
// keyed by it in later phases. Nothing about the client is stored here.

import type { Env } from '../types.ts';
import { apiError, json, requestOrigin } from '../http.ts';

export async function handleSession(request: Request, env: Env): Promise<Response> {
  void env;
  const origin = requestOrigin(request);
  if (request.method !== 'POST') {
    return apiError('method_not_allowed', 'Method not allowed.', 405, origin);
  }
  return json({ sessionId: crypto.randomUUID() }, 200, origin);
}
