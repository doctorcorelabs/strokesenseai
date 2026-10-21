import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cleanMetrics, handleVision } from '../src/handlers/vision.ts';
import type { EnvLike } from '../src/providers.ts';

// W-02: metrics must be a flat object of finite numbers, booleans, or
// short strings; string values are PII-redacted before they can reach
// the provider. W-03: an acute-symptom question gets the static
// emergency reply before any model call. W-08: the 8 KB metrics cap is
// measured in UTF-8 bytes, not UTF-16 code units.

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

function stubFetchCapturingBodies(): { bodies: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = async (_input: unknown, init?: { body?: unknown }) => {
    bodies.push(typeof init?.body === 'string' ? init.body : '');
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'A safe educational reply.' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  return { bodies, restore: () => (globalThis.fetch = original) };
}

test('W-02: flat numeric and boolean metrics pass validation and reach the model stage', async () => {
  const response = await handleVision(
    visionRequest({ featureId: 'face-analyzer', metrics: { mouthDelta: 0.2, visible: true } }),
    {},
  );
  assert.equal(response.status, 503);
});

test('W-02: a nested object metric value is rejected', async () => {
  const response = await handleVision(
    visionRequest({ featureId: 'face-analyzer', metrics: { note: { nested: 1 } } }),
    {},
  );
  assert.equal(response.status, 400);
});

test('W-02: an array metric value is rejected', async () => {
  const response = await handleVision(
    visionRequest({ featureId: 'face-analyzer', metrics: { series: [1, 2, 3] } }),
    {},
  );
  assert.equal(response.status, 400);
});

test('W-02: a null metric value is rejected', async () => {
  const response = await handleVision(
    visionRequest({ featureId: 'face-analyzer', metrics: { note: null } }),
    {},
  );
  assert.equal(response.status, 400);
});

test('W-02: a metric string longer than 80 characters is rejected', async () => {
  const response = await handleVision(
    visionRequest({ featureId: 'face-analyzer', metrics: { note: 'x'.repeat(81) } }),
    {},
  );
  assert.equal(response.status, 400);
});

test('W-02: cleanMetrics redacts PII inside metric string values', () => {
  const result = cleanMetrics({ note: 'contact user@example.com', delta: 0.5, ok: true });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.metrics.note, 'contact [email removed]');
    assert.equal(result.metrics.delta, 0.5);
    assert.equal(result.metrics.ok, true);
  }
});

test('W-02: an identifier typed into a metric string is redacted before the provider call', async () => {
  const stub = stubFetchCapturingBodies();
  try {
    const response = await handleVision(
      visionRequest({
        featureId: 'face-analyzer',
        metrics: { note: 'contact user@example.com', mouthDelta: 0.2 },
      }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.bodies.length, 1);
    const sent = JSON.parse(stub.bodies[0]) as { messages: { content: string }[] };
    const payload = JSON.parse(sent.messages[1].content) as { metrics: { note?: string } };
    assert.ok(!sent.messages[1].content.includes('user@example.com'));
    assert.equal(payload.metrics.note, 'contact [email removed]');
  } finally {
    stub.restore();
  }
});

test('W-03: an acute symptom question returns the emergency reply before the model', async () => {
  const stub = stubFetchCapturingBodies();
  try {
    const response = await handleVision(
      visionRequest({
        featureId: 'face-analyzer',
        metrics: { mouthDelta: 0.2 },
        question: 'My face is drooping right now, what do these numbers mean?',
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

test('W-08: the metrics cap is enforced in UTF-8 bytes, not string length', async () => {
  // 150 keys with a 20 character CJK string each: the JSON text is well
  // under 8192 UTF-16 code units but well over 8192 UTF-8 bytes.
  const metrics: Record<string, string> = {};
  for (let i = 0; i < 150; i += 1) metrics[`k${i}`] = 'あ'.repeat(20);
  assert.ok(JSON.stringify(metrics).length < 8192);
  const response = await handleVision(visionRequest({ featureId: 'face-analyzer', metrics }), {});
  assert.equal(response.status, 413);
});
