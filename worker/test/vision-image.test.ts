import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleVision, normalizeVisionReply } from '../src/handlers/vision.ts';
import { issueConsentToken } from '../src/auth.ts';
import worker from '../src/index.ts';
import type { EnvLike } from '../src/providers.ts';
import type { Env } from '../src/types.ts';
import { CONSENT_NOTICE_VERSION } from '../../shared/contracts.ts';

// V-IMG: image mode on POST /api/vision. Handler level: strict input
// validation (task allowlist, 1 to 6 JPEG or PNG data URLs, per-image
// size cap), the emergency guard over note plus task context before any
// model call, and a multimodal provider call on the server-locked model
// with no temperature and fallbacks denied. Router level: consent is
// required, the vision scope is enforced, and the rate limit bucket is
// keyed by the vision feature.

const ORIGIN = 'https://example.test';
const PNG_URL = `data:image/png;base64,${'A'.repeat(120)}`;
const JPG_URL = `data:image/jpeg;base64,${'B'.repeat(120)}`;
const MODEL_JSON =
  '{"headline":"Both mouth corners appear to rise in the later frames.","observations":["The left corner appears to rise slightly less than the right."],"cannotAnalyze":false,"reason":null}';

function visionRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.test/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const configuredEnv: EnvLike = {
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

interface FetchCapture {
  calls: () => number;
  lastBody: () => Record<string, unknown> | null;
  restore: () => void;
}

function stubFetchReturning(content: string): FetchCapture {
  const original = globalThis.fetch;
  let count = 0;
  let lastBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_url: unknown, init?: { body?: unknown }) => {
    count += 1;
    if (typeof init?.body === 'string') {
      lastBody = JSON.parse(init.body) as Record<string, unknown>;
    }
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { calls: () => count, lastBody: () => lastBody, restore: () => (globalThis.fetch = original) };
}

test('V-IMG: a valid image request returns the model JSON with mode live-ai', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'face-video', images: [PNG_URL, JPG_URL] }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; reply?: string; sources?: unknown[] };
    assert.equal(body.mode, 'live-ai');
    assert.deepEqual(body.sources, []);
    const reply = JSON.parse(body.reply ?? '') as {
      headline?: string;
      observations?: string[];
      cannotAnalyze?: boolean;
      reason?: unknown;
    };
    assert.equal(reply.headline, 'Both mouth corners appear to rise in the later frames.');
    assert.equal(reply.cannotAnalyze, false);
    assert.equal(reply.reason, null);

    assert.equal(stub.calls(), 1);
    const sent = stub.lastBody();
    assert.equal(sent?.model, 'openai/gpt-4o-mini');
    assert.ok(!('temperature' in (sent ?? {})), 'temperature must never be sent');
    const provider = sent?.provider as {
      allow_fallbacks?: unknown;
      require_parameters?: unknown;
      data_collection?: unknown;
    };
    assert.equal(provider.allow_fallbacks, false);
    assert.equal(provider.require_parameters, true);
    assert.equal(provider.data_collection, 'deny');
    const messages = sent?.messages as { role: string; content: unknown }[];
    const parts = messages[1].content as { type: string; text?: string; image_url?: { url: string } }[];
    assert.equal(parts[0].type, 'text');
    assert.ok(parts[0].text?.includes('2 images are attached as frames in time order'));
    const imageParts = parts.filter((part) => part.type === 'image_url');
    assert.equal(imageParts.length, 2);
    assert.equal(imageParts[0].image_url?.url, PNG_URL);
    assert.equal(imageParts[1].image_url?.url, JPG_URL);
  } finally {
    stub.restore();
  }
});

test('V-IMG: a non-JSON model reply is wrapped into the stable client shape', async () => {
  const stub = stubFetchReturning('The arm appears to stay in place across the frames.');
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'fast-arm', images: [PNG_URL] }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; reply?: string };
    assert.equal(body.mode, 'live-ai');
    const reply = JSON.parse(body.reply ?? '') as {
      headline?: string;
      observations?: string[];
      cannotAnalyze?: boolean;
      reason?: unknown;
    };
    assert.equal(reply.headline, 'AI analysis');
    assert.deepEqual(reply.observations, ['The arm appears to stay in place across the frames.']);
    assert.equal(reply.cannotAnalyze, false);
    assert.equal(reply.reason, null);
  } finally {
    stub.restore();
  }
});

test('V-IMG: normalizeVisionReply passes valid JSON through and wraps plain text', () => {
  assert.equal(normalizeVisionReply(MODEL_JSON), MODEL_JSON);
  const wrapped = JSON.parse(normalizeVisionReply('plain words')) as { headline?: string };
  assert.equal(wrapped.headline, 'AI analysis');
});

test('V-IMG: an acute-symptom note returns the emergency reply before the model', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const response = await handleVision(
      visionRequest({
        mode: 'image',
        task: 'face-video',
        images: [PNG_URL],
        note: 'My face is drooping and my arm is weak right now',
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

test('V-IMG: more than 6 images are rejected', async () => {
  const response = await handleVision(
    visionRequest({
      mode: 'image',
      task: 'face-photo',
      images: [PNG_URL, PNG_URL, PNG_URL, PNG_URL, PNG_URL, PNG_URL, PNG_URL],
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'invalid_input');
});

test('V-IMG: zero images are rejected', async () => {
  const response = await handleVision(
    visionRequest({ mode: 'image', task: 'face-photo', images: [] }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
});

test('V-IMG: a GIF data URL is rejected', async () => {
  const response = await handleVision(
    visionRequest({
      mode: 'image',
      task: 'face-photo',
      images: [`data:image/gif;base64,${'A'.repeat(120)}`],
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'invalid_input');
});

test('V-IMG: an unknown task is rejected', async () => {
  const response = await handleVision(
    visionRequest({ mode: 'image', task: 'scan-brain', images: [PNG_URL] }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'unknown_task');
});

test('V-IMG: a single image over the per-image character cap is rejected', async () => {
  const response = await handleVision(
    visionRequest({
      mode: 'image',
      task: 'face-photo',
      images: [`data:image/png;base64,${'A'.repeat(2_000_000)}`],
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'invalid_input');
});

// ---------------------------------------------------------------------------
// Router level: the middleware chain in worker/src/index.ts.
// ---------------------------------------------------------------------------

const routerEnv: Env = {
  ENVIRONMENT: 'development',
  ALLOWED_ORIGINS: ORIGIN,
  CONSENT_SECRET: 'test-consent-secret',
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

function routerVisionRequest(body: Record<string, unknown>, token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: ORIGIN };
  if (token) headers['X-Consent-Token'] = token;
  return new Request('https://example.test/api/vision', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

test('V-IMG router: an image request without a consent token is rejected', async () => {
  const response = await worker.fetch(
    routerVisionRequest({ mode: 'image', task: 'face-photo', images: [PNG_URL] }),
    routerEnv,
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'consent_required');
});

test('V-IMG router: a consent token without the vision scope is rejected', async () => {
  const chatOnly = await issueConsentToken(routerEnv, 'session-1', ['chat'], CONSENT_NOTICE_VERSION);
  const response = await worker.fetch(
    routerVisionRequest({ mode: 'image', task: 'face-photo', images: [PNG_URL] }, chatOnly),
    routerEnv,
  );
  assert.equal(response.status, 401);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'consent_invalid');
});

test('V-IMG router: a vision-scoped token is served a live-ai answer', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const token = await issueConsentToken(routerEnv, 'session-1', ['vision'], CONSENT_NOTICE_VERSION);
    const response = await worker.fetch(
      routerVisionRequest({ mode: 'image', task: 'hand-video', images: [PNG_URL, PNG_URL] }, token),
      routerEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string };
    assert.equal(body.mode, 'live-ai');
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

test('V-IMG router: the rate limiter bucket for the vision route is keyed vision', async () => {
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
  const token = await issueConsentToken(limitedEnv, 'session-1', ['vision'], CONSENT_NOTICE_VERSION);
  const response = await worker.fetch(
    routerVisionRequest({ mode: 'image', task: 'face-photo', images: [PNG_URL] }, token),
    limitedEnv,
  );
  assert.equal(response.status, 429);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'rate_limited');
  assert.ok(names.length >= 1);
  assert.ok(names[0].startsWith('vision:'), `expected a vision bucket, got ${names[0]}`);
});
