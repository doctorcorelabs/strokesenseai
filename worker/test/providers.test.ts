import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  callWorkersAi,
  MODEL_REQUEST_FAILED,
  MODEL_TIMEOUT,
  WORKERS_AI_NOT_CONFIGURED,
} from '../src/providers.ts';
import type { EnvLike } from '../src/providers.ts';

// W-14: callWorkersAi must be time-bounded like the OpenRouter path.
// The Workers AI binding accepts no abort signal, so the timeout is a
// Promise.race; these tests pin the configured, fast, malformed, and
// hanging-binding behaviours.

test('callWorkersAi throws when the AI binding is not configured', async () => {
  await assert.rejects(
    () => callWorkersAi({} as EnvLike, 'Explain FAST.'),
    (error: unknown) => error instanceof Error && error.message === WORKERS_AI_NOT_CONFIGURED,
  );
});

test('callWorkersAi returns a string result', async () => {
  const env = { AI: { run: async () => 'plain text result' } } as EnvLike;
  assert.equal(await callWorkersAi(env, 'prompt'), 'plain text result');
});

test('callWorkersAi returns the response field of an object result', async () => {
  const env = { AI: { run: async () => ({ response: 'structured result' }) } } as EnvLike;
  assert.equal(await callWorkersAi(env, 'prompt'), 'structured result');
});

test('callWorkersAi rejects a malformed result', async () => {
  const env = { AI: { run: async () => ({ unexpected: true }) } } as EnvLike;
  await assert.rejects(
    () => callWorkersAi(env, 'prompt'),
    (error: unknown) => error instanceof Error && error.message === MODEL_REQUEST_FAILED,
  );
});

test(
  'W-14: callWorkersAi times out when the binding hangs',
  { timeout: 30_000 },
  async () => {
    const env = { AI: { run: () => new Promise<unknown>(() => {}) } } as EnvLike;
    await assert.rejects(
      () => callWorkersAi(env, 'prompt'),
      (error: unknown) => error instanceof Error && error.message === MODEL_TIMEOUT,
    );
  },
);
