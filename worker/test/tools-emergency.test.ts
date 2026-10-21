import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleTools } from '../src/handlers/tools.ts';
import type { EnvLike } from '../src/providers.ts';
import { LAB_MODULES } from '../../shared/lab.ts';

// W-01: the static emergency check must read the context field as well
// as the question. A personal symptom report placed in context returns
// the deterministic emergency reply before any model call, while purely
// fictional display context still flows through to the model stage.

const modulesByTool = LAB_MODULES as unknown as Record<string, Record<string, unknown>>;
const sampleTool = Object.keys(modulesByTool)[0];
const sampleId = Object.keys(modulesByTool[sampleTool])[0];

function toolsRequest(body: Record<string, unknown>): Request {
  return new Request('https://example.test/api/tools', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function stubFetchReturningReply(): { calls: () => number; restore: () => void } {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => {
    count += 1;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'A safe educational reply.' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  return { calls: () => count, restore: () => (globalThis.fetch = original) };
}

const configuredEnv: EnvLike = {
  OPENROUTER_API_KEY: 'test-key',
  OPENROUTER_MODEL: 'openai/gpt-4o-mini',
};

test('W-01: a symptom report in context triggers the emergency reply', async () => {
  const stub = stubFetchReturningReply();
  try {
    const response = await handleTools(
      toolsRequest({
        tool: 'face',
        id: 'face-analyzer',
        context: 'Display note: my face is drooping and my arm is weak right now, I am home alone',
        question: 'Explain this module please',
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

test('W-01: a symptom report in the question still triggers the emergency reply', async () => {
  const response = await handleTools(
    toolsRequest({
      tool: sampleTool,
      id: sampleId,
      context: 'Schematic selection shown on screen',
      question: 'My face is drooping right now, what does this mean?',
    }),
    {},
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { mode?: string };
  assert.equal(body.mode, 'emergency');
});

test('W-01: fictional scenario context without a personal report does not trigger emergency', async () => {
  const response = await handleTools(
    toolsRequest({
      tool: sampleTool,
      id: sampleId,
      context: 'Simulation scenario display: the fictional patient shows face drooping',
      question: 'Explain this module please',
    }),
    {},
  );
  // Empty env: the request passed the guard and reached the model stage.
  assert.equal(response.status, 503);
});
