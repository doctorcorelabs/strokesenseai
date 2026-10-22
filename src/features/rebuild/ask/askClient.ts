// Client for POST /api/ask (Ask the Lab), following the same patterns as
// src/ai/client.ts: the browser never holds a provider key, requests
// carry the session consent token, failures surface as safe user-facing
// English messages, and replies are validated before they are shown.
//
// The token is obtained through requestConsentToken, which is the
// recording step: callers must only invoke requestAsk after the person
// has explicitly agreed in this session (the Ask page's consent box or a
// consent already given elsewhere in the session). This module never
// asks for agreement by itself.

import { ensureSession, getApiBase, requestConsentToken } from '../../../ai/client';
import type { ToolSource } from '../../../ai/client';

export interface AskResult {
  reply: string;
  sources: ToolSource[];
  mode: 'live' | 'emergency';
}

export interface AskInput {
  question: string;
  /** Short activity note (labels and counts only), never raw user text. */
  context?: string;
}

const REQUEST_TIMEOUT_MS = 15000;
const MAX_REPLY_CHARS = 7000;

function isSource(value: unknown): value is ToolSource {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { title?: unknown; url?: unknown };
  return (
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    typeof candidate.url === 'string' &&
    /^https:\/\//.test(candidate.url)
  );
}

function parseResult(data: unknown): AskResult {
  if (!data || typeof data !== 'object') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  const record = data as { reply?: unknown; sources?: unknown; mode?: unknown };
  if (
    typeof record.reply !== 'string' ||
    !record.reply.trim() ||
    record.reply.length > MAX_REPLY_CHARS
  ) {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  if (record.mode !== 'live' && record.mode !== 'emergency') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  const sources = Array.isArray(record.sources) ? record.sources.filter(isSource) : [];
  return { reply: record.reply, sources, mode: record.mode };
}

/**
 * Ask one question through the Ask the Lab door. Ensures the Worker
 * session exists, attaches the chat-scope consent token (recording it
 * first when the person has just agreed), and throws an Error with a
 * safe, user-facing message on any failure.
 */
export async function requestAsk(input: AskInput): Promise<AskResult> {
  const api = getApiBase();
  if (!api) {
    throw new Error('Live AI is not configured for this build.');
  }
  await ensureSession();
  const consentToken = await requestConsentToken(['chat']);

  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${api}/api/ask`, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Consent-Token': consentToken,
      },
      body: JSON.stringify({
        question: input.question.trim().slice(0, 2000),
        ...(input.context ? { context: input.context.slice(0, 1000) } : {}),
      }),
    });
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new Error(
        'The AI request timed out. Do not wait for AI if symptoms are present; call 119.',
      );
    }
    throw new Error('Live AI could not be reached. Emergency actions remain available.');
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'AI request limit reached. Please wait a moment and try again.'
        : 'Live AI could not respond. Emergency actions remain available.',
    );
  }
  const data: unknown = await response.json().catch(() => null);
  return parseResult(data);
}
