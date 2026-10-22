import type { Env } from './types.ts';

// Per-feature budgets (requests per minute per IP). Vision is the most
// expensive feature and gets the tightest budget; tools the loosest.
// Features without an entry fall back to IP_REQUESTS_PER_MINUTE, then 10.
const FEATURE_LIMITS: Record<string, number> = {
  vision: 6,
  audio: 10,
  asr: 10,
  'speech-judge': 10,
  chat: 15,
  ask: 15,
  feature: 10,
  tools: 20,
  session: 30,
  consent: 30,
};

const DO_TIMEOUT_MS = 2_500;
const DEFAULT_RETRY_AFTER = 60;
const GLOBAL_DEFAULT_PER_MINUTE = 600;

// Only AI feature endpoints draw from the shared global aggregate bucket.
// Bootstrap endpoints (session, consent) are cheap, carry their own
// per-feature budgets, and must not let a flood of consent requests drain
// the brake that protects AI cost, nor be drained by it (audit SEC-01).
const AI_FEATURES = new Set(['chat', 'ask', 'tools', 'vision', 'audio', 'asr', 'speech-judge', 'feature']);

// Resolve the salt used to hash client IPs, as a pure function so the chain
// is testable. Fallback chain, in order:
//   1. RATE_LIMIT_SALT secret, when set.
//   2. CONSENT_SECRET, outside development (already a server-only secret,
//      so reusing it as salt material keeps the salt secret by default).
//   3. A public literal, in development only.
//   4. null: no secret salt material exists, and callers must fail closed
//      instead of silently hashing with a public value (audit SEC-06).
export function resolveRateLimitSalt(env: Pick<Env, 'RATE_LIMIT_SALT' | 'CONSENT_SECRET' | 'ENVIRONMENT'>): string | null {
  const explicit = env.RATE_LIMIT_SALT?.trim();
  if (explicit) return explicit;
  const consent = env.CONSENT_SECRET?.trim();
  if (consent) return consent;
  if (env.ENVIRONMENT === 'development') return 'development-salt';
  return null;
}

type Bucket = { tokens: number; updatedAt: number };

export interface RateLimitResult {
  ok: boolean;
  retryAfter?: number;
}

function configuredLimit(value: string | undefined, fallback: number): number {
  const limit = Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= 10_000 ? limit : fallback;
}

function featureCapacity(env: Env, feature: string): number {
  return FEATURE_LIMITS[feature] ?? configuredLimit(env.IP_REQUESTS_PER_MINUTE, 10);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Token bucket with continuous refill: a full bucket refills over one minute.
export function consumeToken(
  bucket: Bucket | undefined,
  now: number,
  capacity: number,
): { bucket: Bucket; allowed: boolean; retryAfter: number } {
  const elapsed = Math.max(0, now - (bucket?.updatedAt ?? now));
  const tokens = Math.min(capacity, (bucket?.tokens ?? capacity) + (elapsed * capacity) / 60_000);
  const allowed = tokens >= 1;
  return {
    bucket: { tokens: allowed ? tokens - 1 : tokens, updatedAt: Math.max(now, bucket?.updatedAt ?? now) },
    allowed,
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil(((1 - tokens) * 60) / capacity)),
  };
}

// Return one token to a bucket: apply the same continuous refill as
// consumeToken, then add one token back, never above capacity. A missing
// bucket is already full, so refunding it is a no-op that stays at capacity.
// Pure and exported for tests, mirroring consumeToken.
export function refundToken(bucket: Bucket | undefined, now: number, capacity: number): { bucket: Bucket } {
  const elapsed = Math.max(0, now - (bucket?.updatedAt ?? now));
  const tokens = Math.min(capacity, (bucket?.tokens ?? capacity) + (elapsed * capacity) / 60_000);
  return {
    bucket: { tokens: Math.min(capacity, tokens + 1), updatedAt: Math.max(now, bucket?.updatedAt ?? now) },
  };
}

// One Durable Object instance per (feature, hashed IP) pair, plus one global
// instance used as an aggregate cost brake. State is a single persisted token
// bucket; an alarm clears it after 120 seconds so IP hashes are not retained.
// Two internal operations, selected by path: POST /consume takes a token,
// POST /refund returns one (used when an upstream failure must not cost the
// user quota, and when the global bucket rejects after a feature token was
// already taken). Only the Worker itself can reach these endpoints.
export class RateLimiter {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const refund = new URL(request.url).pathname === '/refund';
    let capacity = configuredLimit(this.env.IP_REQUESTS_PER_MINUTE, 10);
    try {
      const body: unknown = await request.json();
      if (record(body) && typeof body.capacity === 'number') {
        capacity = configuredLimit(String(body.capacity), capacity);
      }
    } catch {
      // A missing or invalid body keeps the conservative default capacity.
    }
    if (refund) {
      await this.state.storage.transaction(async (txn) => {
        const previous = await txn.get<Bucket>('bucket');
        const next = refundToken(previous, Date.now(), capacity);
        await txn.put('bucket', next.bucket);
        await txn.setAlarm(Date.now() + 120_000);
      });
      return json({ refunded: true });
    }
    const result = await this.state.storage.transaction(async (txn) => {
      const previous = await txn.get<Bucket>('bucket');
      const next = consumeToken(previous, Date.now(), capacity);
      await txn.put('bucket', next.bucket);
      // Full refill takes at most one minute; expiry avoids retaining IP hashes.
      await txn.setAlarm(Date.now() + 120_000);
      return next;
    });
    return json({ allowed: result.allowed, retryAfter: result.retryAfter });
  }

  async alarm(): Promise<void> {
    await this.state.storage.transaction(async (txn) => {
      const bucket = await txn.get<Bucket>('bucket');
      if (!bucket) return;
      const expiresAt = bucket.updatedAt + 120_000;
      // A previously scheduled alarm must not erase a newly consumed bucket.
      if (Date.now() < expiresAt) await txn.setAlarm(expiresAt);
      else await txn.delete('bucket');
    });
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}

async function consumeFromStub(
  namespace: DurableObjectNamespace,
  name: string,
  capacity: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DO_TIMEOUT_MS);
  try {
    const stub = namespace.get(namespace.idFromName(name));
    const response = await stub.fetch('https://limiter/consume', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    });
    if (!response.ok) throw new Error('Limiter unavailable');
    const result: unknown = await response.json();
    if (
      !record(result) ||
      typeof result.allowed !== 'boolean' ||
      typeof result.retryAfter !== 'number' ||
      !Number.isFinite(result.retryAfter) ||
      result.retryAfter < 0 ||
      result.retryAfter > 60
    ) {
      throw new Error('Invalid limiter response');
    }
    return { allowed: result.allowed, retryAfter: result.retryAfter };
  } finally {
    clearTimeout(timer);
  }
}

async function refundFromStub(namespace: DurableObjectNamespace, name: string, capacity: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DO_TIMEOUT_MS);
  try {
    const stub = namespace.get(namespace.idFromName(name));
    const response = await stub.fetch('https://limiter/refund', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    });
    if (!response.ok) throw new Error('Limiter unavailable');
    const result: unknown = await response.json();
    if (!record(result) || result.refunded !== true) throw new Error('Invalid limiter response');
  } finally {
    clearTimeout(timer);
  }
}

// Consume one token for (feature, ip) and, for AI features only, one from
// the global aggregate. Fails closed when the RATE_LIMITER binding is
// missing or the limiter errors, except in development where a missing
// binding is allowed through so local work is possible before the binding
// is provisioned. Also fails closed outside development when no secret
// salt material exists at all (resolveRateLimitSalt returns null).
export async function consumeRateLimit(env: Env, feature: string, ip: string): Promise<RateLimitResult> {
  const development = env.ENVIRONMENT === 'development';
  const salt = resolveRateLimitSalt(env);
  if (salt === null) return { ok: false, retryAfter: DEFAULT_RETRY_AFTER };
  if (!env.RATE_LIMITER) {
    return development ? { ok: true } : { ok: false, retryAfter: DEFAULT_RETRY_AFTER };
  }
  try {
    const hash = await sha256Hex(salt + ip);
    const name = `${feature}:${hash}`;
    const capacity = featureCapacity(env, feature);
    const perFeature = await consumeFromStub(env.RATE_LIMITER, name, capacity);
    if (!perFeature.allowed) return { ok: false, retryAfter: perFeature.retryAfter };
    if (AI_FEATURES.has(feature)) {
      const global = await consumeFromStub(
        env.RATE_LIMITER,
        'global',
        configuredLimit(env.GLOBAL_REQUESTS_PER_MINUTE, GLOBAL_DEFAULT_PER_MINUTE),
      );
      if (!global.allowed) {
        // The rejection is not this user's fault: give the feature token
        // back instead of burning it (planning contract, audit SEC-05).
        await refundFromStub(env.RATE_LIMITER, name, capacity).catch(() => undefined);
        return { ok: false, retryAfter: global.retryAfter };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, retryAfter: DEFAULT_RETRY_AFTER };
  }
}

// Return one token to the (feature, ip) bucket and, for AI features, one to
// the global bucket. Used after a feature handler fails upstream (status
// 500 and above) so a provider outage does not consume user quota
// (planning contract, audit SEC-05). Best effort by design: every failure
// is swallowed, and a missing binding or salt is a silent no-op.
export async function refundRateLimit(env: Env, feature: string, ip: string): Promise<void> {
  if (!env.RATE_LIMITER) return;
  const salt = resolveRateLimitSalt(env);
  if (salt === null) return;
  try {
    const hash = await sha256Hex(salt + ip);
    await refundFromStub(env.RATE_LIMITER, `${feature}:${hash}`, featureCapacity(env, feature)).catch(
      () => undefined,
    );
    if (AI_FEATURES.has(feature)) {
      await refundFromStub(
        env.RATE_LIMITER,
        'global',
        configuredLimit(env.GLOBAL_REQUESTS_PER_MINUTE, GLOBAL_DEFAULT_PER_MINUTE),
      ).catch(() => undefined);
    }
  } catch {
    // Refund is best effort only; it must never surface an error.
  }
}
