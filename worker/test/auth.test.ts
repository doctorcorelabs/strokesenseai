import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CONSENT_NOTICE_VERSION } from '../../shared/contracts.ts';
import { issueConsentToken, verifyConsentToken, verifyTurnstile } from '../src/auth.ts';
import type { Env } from '../src/types.ts';

// Development environment: no CONSENT_SECRET is configured, so tokens are
// signed with the development-only fallback secret inside auth.ts. That
// literal is part of the public source, which is acceptable here because
// these tests only exercise development behavior.
const devEnv: Env = { ENVIRONMENT: 'development' };
const DEV_SECRET = 'dev-only-secret';

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlEncodeText(text: string): string {
  return base64UrlEncode(new TextEncoder().encode(text));
}

// Craft a token by hand so tests can produce shapes issueConsentToken
// never would (expired, wrong algorithm header, wrong notice version).
async function craftToken(header: unknown, payload: unknown, secret: string): Promise<string> {
  const signingInput = `${base64UrlEncodeText(JSON.stringify(header))}.${base64UrlEncodeText(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: 'session-test',
    scopes: ['chat'],
    notice: CONSENT_NOTICE_VERSION,
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

test('issue and verify roundtrip in development preserves session, scopes, and notice version', async () => {
  const token = await issueConsentToken(devEnv, 'session-abc', ['chat', 'tools'], CONSENT_NOTICE_VERSION);
  const result = await verifyConsentToken(devEnv, token, 'chat');
  assert.equal(result.ok, true);
  assert.equal(result.sessionId, 'session-abc');
  assert.deepEqual(result.scopes, ['chat', 'tools']);
  assert.equal(result.noticeVersion, CONSENT_NOTICE_VERSION);
});

test('expired token is rejected', async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await craftToken(
    { alg: 'HS256', typ: 'JWT' },
    validPayload({ iat: now - 7200, exp: now - 3600 }),
    DEV_SECRET,
  );
  const result = await verifyConsentToken(devEnv, token, 'chat');
  assert.equal(result.ok, false);
});

test('token without the required scope is rejected', async () => {
  const token = await issueConsentToken(devEnv, 'session-abc', ['chat'], CONSENT_NOTICE_VERSION);
  const result = await verifyConsentToken(devEnv, token, 'vision');
  assert.equal(result.ok, false);
});

test('token carrying a stale notice version is rejected even with a valid signature', async () => {
  const token = await issueConsentToken(devEnv, 'session-abc', ['chat'], '1999-01-01');
  const result = await verifyConsentToken(devEnv, token, 'chat');
  assert.equal(result.ok, false);
});

test('token with a non-HS256 alg header is rejected even when HMAC-signed', async () => {
  const token = await craftToken({ alg: 'RS256', typ: 'JWT' }, validPayload(), DEV_SECRET);
  const result = await verifyConsentToken(devEnv, token, 'chat');
  assert.equal(result.ok, false);
});

test('alg none token with an empty signature is rejected', async () => {
  const signingInput = `${base64UrlEncodeText(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${base64UrlEncodeText(JSON.stringify(validPayload()))}`;
  const result = await verifyConsentToken(devEnv, `${signingInput}.`, 'chat');
  assert.equal(result.ok, false);
});

test('token signed with a different secret is rejected', async () => {
  const token = await craftToken({ alg: 'HS256', typ: 'JWT' }, validPayload(), 'some-other-secret');
  const result = await verifyConsentToken(devEnv, token, 'chat');
  assert.equal(result.ok, false);
});

test('issuance fails outside development when CONSENT_SECRET is missing', async () => {
  await assert.rejects(issueConsentToken({ ENVIRONMENT: 'production' }, 's', ['chat'], CONSENT_NOTICE_VERSION));
});

// Turnstile is disabled for this product by decision (2026-10-21): with no
// TURNSTILE_SECRET configured the check passes in every environment. It
// only verifies when a secret is configured.
test('verifyTurnstile passes in production when no secret is configured', async () => {
  const env: Env = { ENVIRONMENT: 'production' };
  assert.equal(await verifyTurnstile('', env), true);
  assert.equal(await verifyTurnstile('any-token', env), true);
});

test('verifyTurnstile passes in development when no secret is configured', async () => {
  assert.equal(await verifyTurnstile('', devEnv), true);
  assert.equal(await verifyTurnstile('any-token', devEnv), true);
});

test('verifyTurnstile rejects an empty token when a secret is configured', async () => {
  const env: Env = { ENVIRONMENT: 'production', TURNSTILE_SECRET: 'test-secret' };
  assert.equal(await verifyTurnstile('', env), false);
});

test('verifyTurnstile follows the siteverify outcome when a secret is configured', async () => {
  const env: Env = { ENVIRONMENT: 'production', TURNSTILE_SECRET: 'test-secret' };
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    assert.equal(await verifyTurnstile('token-ok', env), true);

    globalThis.fetch = async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    assert.equal(await verifyTurnstile('token-bad', env), false);

    globalThis.fetch = async () => {
      throw new Error('network unreachable');
    };
    assert.equal(await verifyTurnstile('token-x', env), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
