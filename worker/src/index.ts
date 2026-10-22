import { consumeRateLimit, refundRateLimit } from './ratelimit.ts';
import { verifyConsentToken, verifyTurnstile } from './auth.ts';
import { handleTools } from './handlers/tools.ts';
import { handleChat } from './handlers/chat.ts';
import { handleVision } from './handlers/vision.ts';
import { handleAudio } from './handlers/audio.ts';
import { handleConsentDelete, handleConsentPost } from './handlers/consent.ts';
import { handleSession } from './handlers/session.ts';
import { handleFeature } from './handlers/features.ts';
import { handleAsk } from './handlers/ask.ts';
import type { Env } from './types.ts';

export type { Env } from './types.ts';
export { RateLimiter } from './ratelimit.ts';

// Router and middleware chain for the StrokeSense AI Lab API.
// Order for protected feature endpoints is deliberate:
//   CORS -> Turnstile (only when configured) -> consent token -> rate limit -> handler
// CORS is a browser boundary only, never an authentication mechanism.
// Turnstile and consent are skipped for /api/session and /api/consent,
// which are the endpoints that establish them.

type Handler = (request: Request, env: Env) => Promise<Response>;

interface FeatureRoute {
  feature: string;
  scope: string;
  handler: Handler;
}

const FEATURE_ROUTES: Record<string, FeatureRoute> = {
  '/api/tools': { feature: 'tools', scope: 'tools', handler: handleTools },
  '/api/chat': { feature: 'chat', scope: 'chat', handler: handleChat },
  '/api/vision': { feature: 'vision', scope: 'vision', handler: handleVision },
  '/api/audio': { feature: 'audio', scope: 'audio', handler: handleAudio },
  '/api/feature': { feature: 'feature', scope: 'tools', handler: handleFeature },
  '/api/ask': { feature: 'ask', scope: 'chat', handler: handleAsk },
};

const API_PATHS = new Set([...Object.keys(FEATURE_ROUTES), '/api/session', '/api/consent']);
const PREFLIGHT_HEADERS = new Set(['content-type', 'x-consent-token', 'x-turnstile-token']);

function corsOrigin(request: Request, env: Env): string | null {
  const defaults = env.ENVIRONMENT === 'development' ? 'http://localhost:5173,http://127.0.0.1:5173' : '';
  const allowed = (env.ALLOWED_ORIGINS ?? defaults)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('Origin');
  if (!origin || origin === 'null' || !allowed.includes(origin)) return null;
  try {
    const url = new URL(origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)) return null;
    // Production origins must be https; http is only tolerated for localhost in development.
    if (env.ENVIRONMENT !== 'development' && url.protocol !== 'https:') return null;
    return origin;
  } catch {
    return null;
  }
}

function applyHeaders(response: Response, origin: string | null): Response {
  const wrapped = new Response(response.body, response);
  wrapped.headers.set('Cache-Control', 'no-store');
  wrapped.headers.set('X-Content-Type-Options', 'nosniff');
  wrapped.headers.set('Vary', 'Origin');
  if (origin) wrapped.headers.set('Access-Control-Allow-Origin', origin);
  return wrapped;
}

function json(data: unknown, status = 200, origin: string | null = null, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return applyHeaders(new Response(JSON.stringify(data), { status, headers }), origin);
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  origin: string | null = null,
  extra?: HeadersInit,
): Response {
  return json({ error: { code, message } }, status, origin, extra);
}

function allowedMethods(path: string): string[] {
  if (path === '/api/consent') return ['POST', 'DELETE'];
  return ['POST'];
}

function preflight(request: Request, path: string, origin: string): Response {
  const method = request.headers.get('Access-Control-Request-Method');
  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (
    !method ||
    !allowedMethods(path).includes(method) ||
    requestedHeaders.some((header) => !PREFLIGHT_HEADERS.has(header))
  ) {
    return errorResponse(403, 'preflight_not_allowed', 'Preflight is not allowed.', origin);
  }
  const response = new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': allowedMethods(path).join(', '),
      'Access-Control-Allow-Headers': 'Content-Type, X-Consent-Token, X-Turnstile-Token',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
    },
  });
  return applyHeaders(response, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    const origin = corsOrigin(request, env);

    if (path === '/health') {
      if (request.method !== 'GET') {
        return errorResponse(405, 'method_not_allowed', 'Method not allowed.', origin, { Allow: 'GET' });
      }
      // Liveness only: no configuration, secrets, or upstream checks are exposed.
      return json({ status: 'ok' }, 200, origin);
    }

    if (!API_PATHS.has(path)) {
      return errorResponse(404, 'not_found', 'Not found.', origin);
    }

    // An empty ALLOWED_ORIGINS in production rejects every API request here.
    if (!origin) {
      return errorResponse(403, 'origin_not_allowed', 'Origin is not allowed.');
    }

    if (request.method === 'OPTIONS') return preflight(request, path, origin);

    if (!allowedMethods(path).includes(request.method)) {
      return errorResponse(405, 'method_not_allowed', 'Method not allowed.', origin, {
        Allow: [...allowedMethods(path), 'OPTIONS'].join(', '),
      });
    }

    try {
      let ip = request.headers.get('CF-Connecting-IP');
      if (!ip && env.ENVIRONMENT === 'development') ip = 'local-development';
      if (!ip) {
        // Without a trustworthy client IP the rate limiter cannot work fairly.
        return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.', origin);
      }

      const isBootstrapPath = path === '/api/session' || path === '/api/consent';

      if (!isBootstrapPath) {
        const turnstileToken = request.headers.get('X-Turnstile-Token') ?? '';
        if (!(await verifyTurnstile(turnstileToken, env, ip))) {
          return errorResponse(403, 'turnstile_failed', 'Bot verification failed.', origin);
        }
      }

      const route = FEATURE_ROUTES[path];
      if (route) {
        const consentToken = request.headers.get('X-Consent-Token');
        if (!consentToken) {
          return errorResponse(401, 'consent_required', 'Consent is required for this feature.', origin);
        }
        const consent = await verifyConsentToken(env, consentToken, route.scope);
        if (!consent.ok) {
          return errorResponse(
            401,
            'consent_invalid',
            'Consent token is invalid, expired, or does not cover this feature.',
            origin,
          );
        }
      }

      const feature = route?.feature ?? (path === '/api/session' ? 'session' : 'consent');
      const limit = await consumeRateLimit(env, feature, ip);
      if (!limit.ok) {
        return errorResponse(429, 'rate_limited', 'Too many requests. Please try again later.', origin, {
          'Retry-After': String(Math.max(1, Math.ceil(limit.retryAfter ?? 60))),
        });
      }

      let handler: Handler;
      if (route) handler = route.handler;
      else if (path === '/api/session') handler = handleSession;
      else handler = request.method === 'DELETE' ? handleConsentDelete : handleConsentPost;

      const response = await handler(request, env);
      if (route && response.status >= 500) {
        // An upstream or provider failure must not consume the user's
        // quota: refund the feature token (and the global token, which
        // feature routes also drew). Refund is best effort and its
        // failure never changes the response (planning contract,
        // audit SEC-05).
        await refundRateLimit(env, route.feature, ip).catch(() => undefined);
      }
      return applyHeaders(response, origin);
    } catch {
      // Never return provider payloads, credentials, or exception text.
      return errorResponse(503, 'service_unavailable', 'Service is temporarily unavailable.', origin);
    }
  },
};
