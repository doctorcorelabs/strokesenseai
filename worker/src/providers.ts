// Model provider access. The Worker is the only component that talks to
// model providers; API keys never reach the browser. Errors thrown here
// are generic codes only: never provider payloads, status text, or
// exception details from the upstream service.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Multimodal messages for the vision image mode: content is an ordered
// array of text and image parts in the OpenRouter chat format. Image
// parts carry data URLs the client produced from an uploaded file.
export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ImageContentPart {
  type: 'image_url';
  image_url: { url: string };
}

export type VisionContentPart = TextContentPart | ImageContentPart;

export interface VisionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContentPart[];
}

// Local view of the Worker environment, based on the shared Env type in
// types.ts (importing the Worker entry point itself would be circular).
// EnvLike extends Env with the optional Workers AI binding, which is only
// provisioned in later phases.
import type { Env } from './types.ts';

export interface EnvLike extends Env {
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
  };
}

export const MODEL_NOT_CONFIGURED = 'model-not-configured';
export const MODEL_REQUEST_FAILED = 'model-request-failed';
export const MODEL_TIMEOUT = 'model-timeout';
export const WORKERS_AI_NOT_CONFIGURED = 'workers-ai-not-configured';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_ID_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:/-]+$/;
const UPSTREAM_MAX_BYTES = 65_536;
const UPSTREAM_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_TOKENS = 900;

async function readBoundedResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(MODEL_REQUEST_FAILED);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Sends one chat completion request to the configured model through
// OpenRouter and returns the reply text. The model id comes from the
// environment and is validated; provider routing forbids silent fallback
// models and data collection. No temperature is sent: some current
// models (for example openai/gpt-6-luna) expose no temperature
// parameter, and require_parameters would then reject every endpoint;
// the model default is acceptable for explanatory answers.
async function postChatCompletion(
  env: EnvLike,
  messages: ChatMessage[] | VisionMessage[],
  maxTokens: number,
): Promise<string> {
  const key = typeof env.OPENROUTER_API_KEY === 'string' ? env.OPENROUTER_API_KEY.trim() : '';
  const model = typeof env.OPENROUTER_MODEL === 'string' ? env.OPENROUTER_MODEL.trim() : '';
  if (!key || !model || !MODEL_ID_PATTERN.test(model)) {
    throw new Error(MODEL_NOT_CONFIGURED);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: false,
        provider: { allow_fallbacks: false, require_parameters: true, data_collection: 'deny' },
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(MODEL_REQUEST_FAILED);
    }
    const text = await readBoundedResponseText(response, UPSTREAM_MAX_BYTES);
    const data: unknown = JSON.parse(text);
    if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) {
      throw new Error(MODEL_REQUEST_FAILED);
    }
    const message = data.choices[0].message;
    if (!isRecord(message) || typeof message.content !== 'string' || !message.content.trim()) {
      throw new Error(MODEL_REQUEST_FAILED);
    }
    return message.content;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(MODEL_TIMEOUT);
    if (error instanceof Error && [MODEL_NOT_CONFIGURED, MODEL_REQUEST_FAILED].includes(error.message)) {
      throw error;
    }
    throw new Error(MODEL_REQUEST_FAILED);
  } finally {
    clearTimeout(timer);
  }
}

// Calls the configured chat model with plain text messages and returns
// the reply text.
export async function callChatModel(
  env: EnvLike,
  messages: ChatMessage[],
  opts?: { maxTokens?: number },
): Promise<string> {
  return postChatCompletion(env, messages, opts?.maxTokens ?? DEFAULT_MAX_TOKENS);
}

// Calls the same server-locked model with multimodal messages (text and
// image parts) for the vision image mode and returns the reply text.
// The request shape, provider routing, and error codes are identical to
// the text path; in particular no temperature is sent, for the reason
// documented on postChatCompletion.
export async function callVisionModel(
  env: EnvLike,
  messages: VisionMessage[],
  opts?: { maxTokens?: number },
): Promise<string> {
  return postChatCompletion(env, messages, opts?.maxTokens ?? DEFAULT_MAX_TOKENS);
}

// Calls a small instruction model on Cloudflare Workers AI through the AI
// binding, for narrow tasks. Throws when the binding is not configured.
// The binding accepts no abort signal, so the 12 second bound (the same
// budget as the OpenRouter path) is enforced with a Promise.race: when
// the timer wins, this function throws MODEL_TIMEOUT and stops waiting,
// although the underlying binding call itself cannot be cancelled and
// may still finish in the background.
export async function callWorkersAi(env: EnvLike, prompt: string): Promise<string> {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error(WORKERS_AI_NOT_CONFIGURED);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(MODEL_TIMEOUT)), UPSTREAM_TIMEOUT_MS);
  });
  try {
    const result: unknown = await Promise.race([
      env.AI.run('@cf/meta/llama-3.1-8b-instruct', { prompt }),
      timeout,
    ]);
    if (typeof result === 'string') return result;
    if (isRecord(result) && typeof result.response === 'string') return result.response;
    throw new Error(MODEL_REQUEST_FAILED);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
