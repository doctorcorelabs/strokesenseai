import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The client module is replaced by a small double (the repo pattern
// from ToolCoach.test.tsx), because the real client's API base comes
// from import.meta.env, which this vitest setup snapshots per worker.
// fetch is stubbed with minimal response doubles: analyzeWithAi only
// reads ok, status, and json().
vi.mock('./client', () => ({
  getApiBase: () => 'https://api.example.test',
  ensureSession: async () => 'session-1',
  requestConsentToken: async () => 'consent-token-1',
}));

import { analyzeWithAi, parseVisionReply } from './visionClient';
import * as clientModule from './client';

const consentSpy = vi.spyOn(clientModule, 'requestConsentToken');

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  consentSpy.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('analyzeWithAi', () => {
  it('posts image mode with the vision consent token and parses the JSON reply', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        reply: JSON.stringify({
          headline: 'Both mouth corners appear raised.',
          observations: ['The left corner appears slightly higher.'],
          cannotAnalyze: false,
          reason: null,
        }),
        sources: [],
        mode: 'live-ai',
      }),
    );

    const result = await analyzeWithAi({
      task: 'face-photo',
      images: ['data:image/jpeg;base64,AAAA'],
    });

    expect(consentSpy).toHaveBeenCalledWith(['vision']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.test/api/vision');
    expect((init.headers as Record<string, string>)['X-Consent-Token']).toBe('consent-token-1');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.mode).toBe('image');
    expect(body.task).toBe('face-photo');
    expect(body.images).toEqual(['data:image/jpeg;base64,AAAA']);
    expect(result).toEqual({
      headline: 'Both mouth corners appear raised.',
      observations: ['The left corner appears slightly higher.'],
      cannotAnalyze: false,
      reason: null,
      emergency: false,
    });
  });

  it('returns the emergency reply as observations when the guard fires', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        reply: 'Call 119 immediately in Indonesia. Do not wait.',
        sources: [],
        mode: 'emergency',
      }),
    );

    const result = await analyzeWithAi({
      task: 'face-video',
      images: ['data:image/jpeg;base64,AAAA'],
      note: 'my face drooped suddenly',
    });

    expect(result.emergency).toBe(true);
    expect(result.observations).toEqual(['Call 119 immediately in Indonesia. Do not wait.']);
    expect(result.cannotAnalyze).toBe(false);
  });

  it('wraps a non-JSON reply instead of trusting it', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ reply: 'A plain description without the JSON shape.', sources: [], mode: 'live-ai' }),
    );

    const result = await analyzeWithAi({
      task: 'arm-video',
      images: ['data:image/jpeg;base64,AAAA'],
    });

    expect(result.headline).toBe('AI analysis');
    expect(result.observations).toEqual(['A plain description without the JSON shape.']);
    expect(result.emergency).toBe(false);
  });

  it('surfaces a rate limit as a friendly error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'rate' }, 429));
    await expect(
      analyzeWithAi({ task: 'face-photo', images: ['data:image/jpeg;base64,AAAA'] }),
    ).rejects.toThrow(/request limit reached/);
  });

  it('rejects an empty frame list before any request is sent', async () => {
    await expect(analyzeWithAi({ task: 'face-photo', images: [] })).rejects.toThrow(
      /No frames were prepared/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('parseVisionReply', () => {
  it('accepts a fenced JSON reply', () => {
    const parsed = parseVisionReply(
      '```json\n{"headline":"H","observations":["O"],"cannotAnalyze":true,"reason":"Too dark."}\n```',
    );
    expect(parsed).toEqual({
      headline: 'H',
      observations: ['O'],
      cannotAnalyze: true,
      reason: 'Too dark.',
    });
  });

  it('treats a malformed shape as plain text', () => {
    const parsed = parseVisionReply('{"headline": 42}');
    expect(parsed.headline).toBe('AI analysis');
    expect(parsed.observations).toEqual(['{"headline": 42}']);
  });
});
