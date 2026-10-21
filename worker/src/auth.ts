import { CONSENT_NOTICE_VERSION } from '../../shared/contracts.ts';
import type { Env } from './types.ts';

// Turnstile verification and server-issued consent tokens.
// Consent tokens are HS256 JWTs signed with CONSENT_SECRET via WebCrypto.
// They expire after 2 hours and carry an explicit scope list, so consent
// given for one feature (for example chat) never covers another (vision).

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5_000;
const CONSENT_TTL_SECONDS = 2 * 60 * 60;
const DEV_ONLY_SECRET = 'dev-only-secret';

export interface ConsentVerification {
  ok: boolean;
  sessionId?: string;
  scopes?: string[];
  noticeVersion?: string;
}

interface ConsentPayload {
  sub: string;
  scopes: string[];
  notice: string;
  iat: number;
  exp: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Verify a Cloudflare Turnstile token server-side. When no secret is
// configured the check only passes in development; production fails closed.
export async function verifyTurnstile(token: string, env: Env, ip?: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET?.trim();
  if (!secret) return env.ENVIRONMENT === 'development';
  if (!token) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.set('secret', secret);
    form.set('response', token);
    if (ip) form.set('remoteip', ip);
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return record(data) && data.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

function base64UrlDecode(text: string): Uint8Array {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function consentSecret(env: Env): string | null {
  const secret = env.CONSENT_SECRET?.trim();
  if (secret) return secret;
  return env.ENVIRONMENT === 'development' ? DEV_ONLY_SECRET : null;
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

// Issue a signed consent token for a session. The notice version is embedded
// and verification rejects any token whose version differs from the version
// in force (CONSENT_NOTICE_VERSION in shared/contracts.ts), so publishing a
// new consent notice invalidates previously issued tokens.
export async function issueConsentToken(
  env: Env,
  sessionId: string,
  scopes: string[],
  noticeVersion: string,
): Promise<string> {
  const secret = consentSecret(env);
  if (!secret) throw new Error('CONSENT_SECRET is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const payload: ConsentPayload = {
    sub: sessionId,
    scopes: [...scopes],
    notice: noticeVersion,
    iat: now,
    exp: now + CONSENT_TTL_SECONDS,
  };
  const signingInput = `${base64UrlEncodeText(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64UrlEncodeText(JSON.stringify(payload))}`;
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Verify a consent token: signature, structure, expiry, required scope,
// and that the embedded notice version is the version currently in force.
export async function verifyConsentToken(
  env: Env,
  token: string,
  requiredScope: string,
): Promise<ConsentVerification> {
  const secret = consentSecret(env);
  if (!secret || !token) return { ok: false };
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false };
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  try {
    const header: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerPart)));
    if (!record(header) || header.alg !== 'HS256') return { ok: false };
    const key = await hmacKey(secret, 'verify');
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signaturePart),
      new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
    if (!valid) return { ok: false };
    const payload: unknown = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
    if (
      !record(payload) ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      !Array.isArray(payload.scopes) ||
      payload.scopes.some((scope) => typeof scope !== 'string') ||
      typeof payload.notice !== 'string' ||
      payload.notice !== CONSENT_NOTICE_VERSION ||
      typeof payload.exp !== 'number' ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return { ok: false };
    }
    const scopes = payload.scopes as string[];
    if (!scopes.includes(requiredScope)) return { ok: false };
    return { ok: true, sessionId: payload.sub, scopes, noticeVersion: payload.notice };
  } catch {
    return { ok: false };
  }
}
