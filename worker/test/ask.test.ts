import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleAsk } from '../src/handlers/ask.ts';
import { issueConsentToken } from '../src/auth.ts';
import worker from '../src/index.ts';
import type { EnvLike } from '../src/providers.ts';
import type { Env } from '../src/types.ts';
import { CONSENT_NOTICE_VERSION } from '../../shared/contracts.ts';

// A-01: handler-level behavior, mirroring the tools emergency tests. The
// emergency guard must read the context field as well as the question
// (the P0 lesson), a normal question reaches the provider exactly once
// with the server-locked model, and PII is redacted before the call.
// A-02: router-level wiring through the real middleware chain: consent
// is required, the chat scope is enforced, and the rate limit bucket is
// keyed by the ask feature.

const ORIGIN = 'https://example.test';

function askRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.test/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

interface FetchCapture {
  calls: () => number;
  lastBody: () => Record<string, unknown> | null;
  restore: () => void;
}

function stubFetchReturningReply(): FetchCapture {
  const original = globalThis.fetch;
  let count = 0;
  let lastBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_url: unknown, init?: { body?: unknown }) => {
    count += 1;
    if (typeof init?.body === 'string') {
      lastBody = JSON.parse(init.body) as Record<string, unknown>;
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'A safe educational reply.' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  return { calls: () => count, lastBody: () => lastBody, restore: () => (globalThis.fetch = original) };
}

const configuredEnv: EnvLike = {
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

test('A-01: a symptom report in context triggers the emergency reply', async () => {
  const stub = stubFetchReturningReply();
  try {
    const response = await handleAsk(
      askRequest({
        question: 'What did I just try in the lab?',
        context: 'Face Lab note: my face is drooping and my arm is weak right now',
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; reply?: string };
    assert.equal(body.mode, 'emergency');
    assert.ok(body.reply?.includes('119'));
    assert.equal(stub.calls(), 0);
  } finally {
    stub.restore();
  }
});

test('A-01: a symptom report in the question triggers the emergency reply', async () => {
  const stub = stubFetchReturningReply();
  try {
    const response = await handleAsk(
      askRequest({ question: 'My face is drooping right now, what does this mean?' }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string };
    assert.equal(body.mode, 'emergency');
    assert.equal(stub.calls(), 0);
  } finally {
    stub.restore();
  }
});

test('A-01: a normal question returns a live reply from the locked model', async () => {
  const stub = stubFetchReturningReply();
  try {
    const response = await handleAsk(
      askRequest({
        question: 'What does FAST stand for?',
        context: 'Face Lab: 3 expression missions completed',
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      mode?: string;
      reply?: string;
      sources?: Array<{ title: string; url: string }>;
    };
    assert.equal(body.mode, 'live');
    assert.ok(body.reply?.includes('A safe educational reply.'));
    assert.equal(body.sources?.length, 2);
    assert.equal(stub.calls(), 1);
    const sent = stub.lastBody();
    assert.equal(sent?.model, 'openai/gpt-4o-mini');
    const provider = sent?.provider as { allow_fallbacks?: unknown; data_collection?: unknown };
    assert.equal(provider.allow_fallbacks, false);
    assert.equal(provider.data_collection, 'deny');
  } finally {
    stub.restore();
  }
});

test('A-01: personal data in the question is redacted before the provider call', async () => {
  const stub = stubFetchReturningReply();
  try {
    const response = await handleAsk(
      askRequest({ question: 'My email is someone@example.com, what does FAST stand for?' }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.calls(), 1);
    assert.ok(!JSON.stringify(stub.lastBody()).includes('someone@example.com'));
  } finally {
    stub.restore();
  }
});

test('A-01: invalid input is rejected before the guard and the provider', async () => {
  const empty = await handleAsk(askRequest({ question: '   ' }), configuredEnv);
  assert.equal(empty.status, 400);
  const emptyBody = (await empty.json()) as { error?: { code?: string } };
  assert.equal(emptyBody.error?.code, 'invalid_input');

  const history = await handleAsk(
    askRequest({ question: 'What is FAST?', history: [] }),
    configuredEnv,
  );
  assert.equal(history.status, 400);
});

// ---------------------------------------------------------------------------
// Router level (A-02): the middleware chain in worker/src/index.ts.
// ---------------------------------------------------------------------------

const routerEnv: Env = {
  ENVIRONMENT: 'development',
  ALLOWED_ORIGINS: ORIGIN,
  CONSENT_SECRET: 'test-consent-secret',
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

function routerAskRequest(body: Record<string, unknown>, token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: ORIGIN };
  if (token) headers['X-Consent-Token'] = token;
  return new Request('https://example.test/api/ask', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('A-02: the router rejects an ask request without a consent token', async () => {
  const response = await worker.fetch(routerAskRequest({ question: 'What is FAST?' }), routerEnv);
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'consent_required');
});

test('A-02: the router rejects a consent token that lacks the chat scope', async () => {
  const toolsOnly = await issueConsentToken(routerEnv, 'session-1', ['tools'], CONSENT_NOTICE_VERSION);
  const response = await worker.fetch(
    routerAskRequest({ question: 'What is FAST?' }, toolsOnly),
    routerEnv,
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'consent_invalid');
});

test('A-02: the router serves a live answer to a chat-scoped consent token', async () => {
  const stub = stubFetchReturningReply();
  try {
    const token = await issueConsentToken(routerEnv, 'session-1', ['chat'], CONSENT_NOTICE_VERSION);
    const response = await worker.fetch(
      routerAskRequest({ question: 'What does FAST stand for?' }, token),
      routerEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string };
    assert.equal(body.mode, 'live');
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

test('A-02: the rate limiter bucket for the ask route is keyed ask', async () => {
  const names: string[] = [];
  const denyingNamespace = {
    idFromName: (name: string) => name,
    get: (id: string) => ({
      fetch: async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.endsWith('/consume')) {
          names.push(id);
          return new Response(JSON.stringify({ allowed: false, retryAfter: 30 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ refunded: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }),
  };
  const limitedEnv: Env = { ...routerEnv, RATE_LIMITER: denyingNamespace as unknown as Env['RATE_LIMITER'] };
  const token = await issueConsentToken(limitedEnv, 'session-1', ['chat'], CONSENT_NOTICE_VERSION);
  const response = await worker.fetch(
    routerAskRequest({ question: 'What does FAST stand for?' }, token),
    limitedEnv,
  );
  assert.equal(response.status, 429);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'rate_limited');
  assert.ok(names.length >= 1);
  assert.ok(names[0].startsWith('ask:'), `expected an ask bucket, got ${names[0]}`);
});
