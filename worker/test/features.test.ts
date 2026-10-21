import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleFeature, validateFeatureInput } from '../src/handlers/features.ts';
import type { EnvLike } from '../src/providers.ts';

// F-01: the emergency guard runs on every free-text field of the
// payload and answers before any provider call, even for kinds that
// are not chat (document-extract, speech-score). F-02: strict envelope
// and per-kind payload validation rejects malformed input. F-03: with
// no provider configured the handler answers a structured offline
// fallback (200, mode 'offline') instead of an error. F-04: model
// output is sanitized (links, markup, dosing) before it reaches the
// client, and client PII is redacted before it reaches the provider.

function featureRequest(body: unknown): Request {
  return new Request('https://example.test/api/feature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const configuredEnv: EnvLike = {
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

function stubFetch(reply: string): { bodies: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = async (_input: unknown, init?: { body?: unknown }) => {
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    return new Response(JSON.stringify({ choices: [{ message: { content: reply } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { bodies, restore: () => (globalThis.fetch = original) };
}

test('F-01: an acute report in a tutor-chat message gets the emergency reply before the model', async () => {
  const stub = stubFetch('should never be sent');
  try {
    const response = await handleFeature(
      featureRequest({
        featureId: 'adaptive-tutor',
        kind: 'tutor-chat',
        payload: { message: 'My face is drooping and my arm feels weak right now, explain FAST to me' },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; reply?: string };
    assert.equal(body.mode, 'emergency');
    assert.ok(body.reply?.includes('119'));
    assert.equal(stub.bodies.length, 0);
  } finally {
    stub.restore();
  }
});

test('F-01: an acute report buried in a document-extract text is blocked by the guard', async () => {
  const stub = stubFetch('should never be sent');
  try {
    const response = await handleFeature(
      featureRequest({
        featureId: 'discharge-lens',
        kind: 'document-extract',
        payload: {
          text: 'Discharge note. Since this morning the patient cannot lift her left arm and her speech is slurred.',
        },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string };
    assert.equal(body.mode, 'emergency');
    assert.equal(stub.bodies.length, 0);
  } finally {
    stub.restore();
  }
});

test('F-01: the emergency reply is served even when no provider is configured', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'adaptive-tutor',
      kind: 'tutor-chat',
      payload: { message: 'I think I am having a stroke, what is a stroke?' },
    }),
    {},
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { mode?: string };
  assert.equal(body.mode, 'emergency');
});

test('F-02: an unknown kind is rejected', async () => {
  const response = await handleFeature(
    featureRequest({ featureId: 'face-analyzer', kind: 'diagnose', payload: {} }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'unknown_kind');
});

test('F-02: an unknown featureId is rejected', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'not-a-feature',
      kind: 'guideline-qa',
      payload: { question: 'What is FAST?' },
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: { code?: string } };
  assert.equal(body.error?.code, 'unknown_feature');
});

test('F-02: an unexpected envelope key is rejected', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'guideline-navigator',
      kind: 'guideline-qa',
      payload: { question: 'What is FAST?' },
      history: [],
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
});

test('F-02: a nested metrics value is rejected for vision-describe', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'face-analyzer',
      kind: 'vision-describe',
      payload: { metrics: { note: { nested: 1 } } },
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
});

test('F-02: a missing required payload field is rejected', async () => {
  const result = validateFeatureInput({
    featureId: 'speech-analyzer',
    kind: 'speech-score',
    payload: { targetPhrase: 'The sun is shining' },
  });
  assert.equal(result.ok, false);
});

test('F-02: an off-allowlist guideline topic is rejected', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'guideline-navigator',
      kind: 'guideline-qa',
      payload: { question: 'What dose should I take?', topic: 'dosing' },
    }),
    configuredEnv,
  );
  assert.equal(response.status, 400);
});

test('F-02: a non-object body is rejected', async () => {
  const response = await handleFeature(featureRequest(['featureId', 'kind']), configuredEnv);
  assert.equal(response.status, 400);
});

test('F-02: a GET request is rejected with 405', async () => {
  const response = await handleFeature(
    new Request('https://example.test/api/feature', { method: 'GET' }),
    configuredEnv,
  );
  assert.equal(response.status, 405);
});

test('F-02: an oversized metrics block is rejected with 413 measured in UTF-8 bytes', async () => {
  const metrics: Record<string, string> = {};
  for (let i = 0; i < 150; i += 1) metrics[`k${i}`] = 'あ'.repeat(20);
  const response = await handleFeature(
    featureRequest({ featureId: 'face-analyzer', kind: 'vision-describe', payload: { metrics } }),
    configuredEnv,
  );
  assert.equal(response.status, 413);
});

test('F-03: without a provider a valid request gets the structured offline fallback', async () => {
  const response = await handleFeature(
    featureRequest({
      featureId: 'guideline-navigator',
      kind: 'guideline-qa',
      payload: { question: 'What does FAST stand for?', topic: 'fast' },
    }),
    {},
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    mode?: string;
    reply?: unknown;
    featureId?: string;
    kind?: string;
    fallback?: { reason?: string; message?: string };
  };
  assert.equal(body.mode, 'offline');
  assert.equal(body.reply, null);
  assert.equal(body.featureId, 'guideline-navigator');
  assert.equal(body.kind, 'guideline-qa');
  assert.equal(body.fallback?.reason, 'provider_not_configured');
  assert.ok((body.fallback?.message ?? '').length > 0);
});

test('F-04: a live reply has links, markup, and dosing removed', async () => {
  const stub = stubFetch(
    'Take 81 mg twice daily. See [the guide](https://example.org/guide) and <b>this page</b> at https://x.test now.',
  );
  try {
    const response = await handleFeature(
      featureRequest({
        featureId: 'guideline-navigator',
        kind: 'guideline-qa',
        payload: { question: 'How is blood pressure usually discussed after a stroke?' },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; reply?: string };
    assert.equal(body.mode, 'live');
    assert.ok(body.reply);
    assert.ok(!body.reply.includes('http'));
    assert.ok(!body.reply.includes('example.org'));
    assert.ok(!body.reply.includes('<b>'));
    assert.ok(body.reply.includes('[dosing detail removed]'));
    assert.ok(body.reply.includes('not a diagnosis'));
  } finally {
    stub.restore();
  }
});

test('F-04: PII in a document is redacted before the provider call', async () => {
  const stub = stubFetch('Structured summary of the document.');
  try {
    const response = await handleFeature(
      featureRequest({
        featureId: 'risk-extractor',
        kind: 'document-extract',
        payload: {
          text: 'Patient letter for user@example.com. Stated risk factors: hypertension and smoking.',
        },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.bodies.length, 1);
    assert.ok(!stub.bodies[0].includes('user@example.com'));
    assert.ok(stub.bodies[0].includes('[email removed]'));
  } finally {
    stub.restore();
  }
});

test('F-04: a speech-score request reaches the model with the cleaned transcript', async () => {
  const stub = stubFetch('Descriptive practice feedback.');
  try {
    const response = await handleFeature(
      featureRequest({
        featureId: 'speech-analyzer',
        kind: 'speech-score',
        payload: {
          transcript: 'the sun is shining today',
          targetPhrase: 'The sun is shining today',
          metrics: { durationSec: 2.4, wordsPerMinute: 150 },
        },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { mode?: string; kind?: string };
    assert.equal(body.mode, 'live');
    assert.equal(body.kind, 'speech-score');
    assert.equal(stub.bodies.length, 1);
    const sent = JSON.parse(stub.bodies[0]) as { messages: { content: string }[] };
    const payload = JSON.parse(sent.messages[1].content) as {
      untrustedPayload: { transcript?: string };
    };
    assert.equal(payload.untrustedPayload.transcript, 'the sun is shining today');
  } finally {
    stub.restore();
  }
});
