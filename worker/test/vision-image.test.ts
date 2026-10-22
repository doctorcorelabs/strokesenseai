import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleVision, normalizeLocalizerReply, normalizeVisionReply } from '../src/handlers/vision.ts';
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

function systemPromptSentToProvider(stub: FetchCapture): string {
  const messages = stub.lastBody()?.messages as { role: string; content: unknown }[] | undefined;
  const system = messages?.find((message) => message.role === 'system');
  return typeof system?.content === 'string' ? system.content : '';
}

function userTextSentToProvider(stub: FetchCapture): string {
  const messages = stub.lastBody()?.messages as { role: string; content: unknown }[] | undefined;
  const user = messages?.find((message) => message.role === 'user');
  const parts = user?.content as { type: string; text?: string }[] | undefined;
  return parts?.[0]?.text ?? '';
}

test('V-IMG: a single fast-face image carries the single-image rule, not a frame-count refusal', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'fast-face', images: [PNG_URL] }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.calls(), 1);
    const system = systemPromptSentToProvider(stub);
    assert.ok(system.includes('When only one image is attached'));
    assert.ok(system.includes('cannot be judged from a single still image'));
    assert.ok(system.includes('never a reason to set "cannotAnalyze" to true'));
    assert.ok(!system.includes('not enough frames to compare'));
    assert.ok(system.includes('If only one image is attached, describe the facial expression'));
    assert.ok(userTextSentToProvider(stub).includes('One image is attached.'));
  } finally {
    stub.restore();
  }
});

test('V-IMG: a single fast-arm image carries the single-image rule, not a frame-count refusal', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'fast-arm', images: [PNG_URL] }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.calls(), 1);
    const system = systemPromptSentToProvider(stub);
    assert.ok(system.includes('When only one image is attached'));
    assert.ok(system.includes('cannot be judged from a single still image'));
    assert.ok(system.includes('never a reason to set "cannotAnalyze" to true'));
    assert.ok(!system.includes('not enough frames to compare'));
    assert.ok(system.includes('If only one image is attached, describe the position and posture of each arm'));
    assert.ok(userTextSentToProvider(stub).includes('One image is attached.'));
  } finally {
    stub.restore();
  }
});

test('V-IMG: several fast-face frames keep the cross-frame comparison instructions', async () => {
  const stub = stubFetchReturning(MODEL_JSON);
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'fast-face', images: [PNG_URL, JPG_URL, PNG_URL] }),
      configuredEnv,
    );
    assert.equal(response.status, 200);
    assert.equal(stub.calls(), 1);
    const system = systemPromptSentToProvider(stub);
    assert.ok(
      system.includes('If several frames are attached, describe the visible movement of the mouth corners'),
    );
    assert.ok(userTextSentToProvider(stub).includes('3 images are attached as frames in time order'));
  } finally {
    stub.restore();
  }
});

test('V-IMG: a single-image fast-face reply that records the still-image limit passes through intact', async () => {
  const singleImageJson =
    '{"headline":"The mouth corners appear uneven in this photo.","observations":["The left mouth corner appears lower than the right in this image.","Movement over time cannot be judged from a single still image."],"cannotAnalyze":false,"reason":null}';
  const stub = stubFetchReturning(singleImageJson);
  try {
    const response = await handleVision(
      visionRequest({ mode: 'image', task: 'fast-face', images: [PNG_URL] }),
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
    assert.equal(reply.headline, 'The mouth corners appear uneven in this photo.');
    assert.deepEqual(reply.observations, [
      'The left mouth corner appears lower than the right in this image.',
      'Movement over time cannot be judged from a single still image.',
    ]);
    assert.equal(reply.cannotAnalyze, false);
    assert.equal(reply.reason, null);
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

// ---------------------------------------------------------------------------
// V-LOC: the face-localizer task on image mode. It runs a dedicated
// system prompt and a strict server-side normalizer: the extended reply
// shape is rebuilt from validated fields only, confidence is clamped to
// the single-photo ceiling, and a cannotAnalyze result never carries
// candidates. The emergency guard still runs before any model call.
// ---------------------------------------------------------------------------

interface LocalizerReply {
  headline?: string;
  observations?: string[];
  cannotAnalyze?: boolean;
  reason?: string | null;
  pattern?: string;
  lesionCandidates?: {
    site: string;
    tract: string;
    vessel: string;
    confidence: string;
    rationale: string;
  }[];
  possibilities?: { name: string; note: string }[];
}

const LOCALIZER_CANDIDATE = {
  site: 'Face area of the motor cortex (lower precentral gyrus), left side',
  tract: 'Corticobulbar tract',
  vessel: 'Precentral branch of the superior division of the middle cerebral artery',
  confidence: 'moderate',
  rationale: 'Forehead sparing points to a lesion above the facial nucleus.',
};

const LOCALIZER_JSON = JSON.stringify({
  headline:
    'The visible pattern is most consistent with a central pattern: the right lower face looks weaker while the forehead appears spared.',
  observations: [
    'The right mouth corner sits lower than the left.',
    'Forehead wrinkles still form on the right side.',
  ],
  cannotAnalyze: false,
  reason: null,
  pattern: 'central-umn',
  lesionCandidates: [
    LOCALIZER_CANDIDATE,
    {
      site: 'Genu of the internal capsule, left side',
      tract: 'Corticobulbar fibers in the genu',
      vessel: 'Lateral lenticulostriate arteries',
      confidence: 'low',
      rationale: 'A capsular lesion can give the same face pattern.',
    },
  ],
  possibilities: [
    {
      name: 'Ischemic stroke in MCA territory',
      note: 'Fits a central pattern; limb signs would strengthen it.',
    },
    {
      name: 'Small subcortical infarct',
      note: 'Also fits; one photo cannot separate cortical from capsular.',
    },
  ],
});

async function localizerReply(content: string, note?: string): Promise<{ status: number; body: { mode?: string; task?: string; reply?: string }; stub: FetchCapture }> {
  const stub = stubFetchReturning(content);
  try {
    const response = await handleVision(
      visionRequest({
        mode: 'image',
        task: 'face-localizer',
        images: [PNG_URL],
        ...(note ? { note } : {}),
      }),
      configuredEnv,
    );
    const body = (await response.json()) as { mode?: string; task?: string; reply?: string };
    return { status: response.status, body, stub };
  } catch (error) {
    stub.restore();
    throw error;
  }
}

test('V-LOC: a valid structured localizer reply passes through intact', async () => {
  const { status, body, stub } = await localizerReply(LOCALIZER_JSON);
  try {
    assert.equal(status, 200);
    assert.equal(body.mode, 'live-ai');
    assert.equal(body.task, 'face-localizer');
    const reply = JSON.parse(body.reply ?? '') as LocalizerReply;
    assert.equal(reply.cannotAnalyze, false);
    assert.equal(reply.reason, null);
    assert.equal(reply.pattern, 'central-umn');
    assert.deepEqual(reply.lesionCandidates, JSON.parse(LOCALIZER_JSON).lesionCandidates);
    assert.deepEqual(reply.possibilities, JSON.parse(LOCALIZER_JSON).possibilities);

    assert.equal(stub.calls(), 1);
    const sent = stub.lastBody();
    assert.equal(sent?.max_tokens, 2500);
    const messages = sent?.messages as { role: string; content: unknown }[];
    const system = messages[0].content as string;
    assert.ok(system.includes('Face Lesion Localizer'));
    assert.ok(system.includes('pontine trap'));
    assert.ok(!system.includes('Never localize a lesion'), 'localizer must not inherit the shared prohibition block');
    const parts = messages[1].content as { type: string; text?: string }[];
    assert.ok(parts[0].text?.includes('Assess the visible signals'));
  } finally {
    stub.restore();
  }
});

test('V-LOC: a model confidence of high is downgraded to moderate', async () => {
  const content = JSON.stringify({
    headline: 'A pattern worth exploring.',
    observations: ['The left mouth corner sits lower than the right.'],
    cannotAnalyze: false,
    reason: null,
    pattern: 'peripheral-lmn',
    lesionCandidates: [
      { ...LOCALIZER_CANDIDATE, confidence: 'high' },
      { ...LOCALIZER_CANDIDATE, confidence: 'certain' },
    ],
    possibilities: [],
  });
  const { status, body, stub } = await localizerReply(content);
  try {
    assert.equal(status, 200);
    const reply = JSON.parse(body.reply ?? '') as LocalizerReply;
    assert.deepEqual(
      reply.lesionCandidates?.map((candidate) => candidate.confidence),
      ['moderate', 'low'],
    );
  } finally {
    stub.restore();
  }
});

test('V-LOC: a cannotAnalyze result empties the pattern and both lists', async () => {
  const content = JSON.stringify({
    headline: 'This photo cannot be analyzed.',
    observations: [],
    cannotAnalyze: true,
    reason: 'The image is too blurred to judge the face.',
    pattern: 'peripheral-lmn',
    lesionCandidates: [LOCALIZER_CANDIDATE],
    possibilities: [{ name: 'Bell palsy', note: 'Should be discarded by the server.' }],
  });
  const { status, body, stub } = await localizerReply(content);
  try {
    assert.equal(status, 200);
    const reply = JSON.parse(body.reply ?? '') as LocalizerReply;
    assert.equal(reply.cannotAnalyze, true);
    assert.equal(reply.reason, 'The image is too blurred to judge the face.');
    assert.equal(reply.pattern, '');
    assert.deepEqual(reply.lesionCandidates, []);
    assert.deepEqual(reply.possibilities, []);
  } finally {
    stub.restore();
  }
});

test('V-LOC: broken fields are dropped or coerced and lists are capped', async () => {
  const extraCandidate = (n: number) => ({ ...LOCALIZER_CANDIDATE, site: `Site ${n}` });
  const extraPossibility = (n: number) => ({ name: `Possibility ${n}`, note: 'A note.' });
  const content = JSON.stringify({
    headline: 'A mixed reply with several broken fields.',
    observations: ['A usable observation.', 42, '', null],
    cannotAnalyze: false,
    reason: 'should be nulled because cannotAnalyze is false',
    pattern: 'sideways',
    lesionCandidates: [
      extraCandidate(1),
      { site: 'Missing the other fields' },
      'not an object',
      extraCandidate(2),
      extraCandidate(3),
      extraCandidate(4),
    ],
    possibilities: [
      { name: 'Missing its note' },
      extraPossibility(1),
      extraPossibility(2),
      extraPossibility(3),
      extraPossibility(4),
      extraPossibility(5),
      extraPossibility(6),
    ],
    unexpectedField: 'must be dropped',
  });
  const { status, body, stub } = await localizerReply(content);
  try {
    assert.equal(status, 200);
    const reply = JSON.parse(body.reply ?? '') as LocalizerReply & Record<string, unknown>;
    assert.equal(reply.pattern, 'unclear');
    assert.equal(reply.reason, null);
    assert.deepEqual(reply.observations, ['A usable observation.']);
    assert.deepEqual(
      reply.lesionCandidates?.map((candidate) => candidate.site),
      ['Site 1', 'Site 2', 'Site 3'],
    );
    assert.equal(reply.possibilities?.length, 5);
    assert.ok(!('unexpectedField' in reply));
  } finally {
    stub.restore();
  }
});

test('V-LOC: a non-JSON model reply falls back to a safe cannotAnalyze result', async () => {
  const { status, body, stub } = await localizerReply('This is definitely Bell palsy, case closed.');
  try {
    assert.equal(status, 200);
    const reply = JSON.parse(body.reply ?? '') as LocalizerReply;
    assert.equal(reply.cannotAnalyze, true);
    assert.equal(reply.headline, 'AI analysis');
    assert.equal(reply.pattern, '');
    assert.deepEqual(reply.lesionCandidates, []);
    assert.deepEqual(reply.possibilities, []);
    assert.ok(typeof reply.reason === 'string' && reply.reason.length > 0);
  } finally {
    stub.restore();
  }
  const direct = JSON.parse(normalizeLocalizerReply('not json at all')) as LocalizerReply;
  assert.equal(direct.cannotAnalyze, true);
  assert.deepEqual(direct.lesionCandidates, []);
});

test('V-LOC: an acute-symptom note returns the emergency reply before the model', async () => {
  const { status, body, stub } = await localizerReply(
    LOCALIZER_JSON,
    'My face is drooping and my speech is slurred right now',
  );
  try {
    assert.equal(status, 200);
    assert.equal(body.mode, 'emergency');
    assert.ok(body.reply?.includes('119'));
    assert.equal(stub.calls(), 0);
  } finally {
    stub.restore();
  }
});
