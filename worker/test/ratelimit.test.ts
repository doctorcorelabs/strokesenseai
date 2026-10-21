import { test } from 'node:test';
import assert from 'node:assert/strict';

import { consumeToken, refundToken, resolveRateLimitSalt } from '../src/ratelimit.ts';

// Tests for the pure pieces of ratelimit.ts: the token bucket math
// (consumeToken, refundToken) and the salt fallback chain
// (resolveRateLimitSalt). The Durable Object wrapper and the stub calls
// need a Workers runtime and are not covered here.

const NOW = 1_700_000_000_000;

test('consumeToken allows a first request and takes exactly one token', () => {
  const result = consumeToken(undefined, NOW, 10);
  assert.equal(result.allowed, true);
  assert.equal(result.bucket.tokens, 9);
  assert.equal(result.retryAfter, 0);
});

test('consumeToken rejects an empty bucket that has not refilled yet', () => {
  const result = consumeToken({ tokens: 0, updatedAt: NOW }, NOW, 10);
  assert.equal(result.allowed, false);
  assert.equal(result.bucket.tokens, 0);
  assert.ok(result.retryAfter >= 1);
});

test('consumeToken refills continuously: a full minute restores the whole bucket', () => {
  const result = consumeToken({ tokens: 0, updatedAt: NOW - 60_000 }, NOW, 10);
  assert.equal(result.allowed, true);
  assert.equal(result.bucket.tokens, 9);
});

test('consumeToken never lets the bucket exceed capacity while refilling', () => {
  const result = consumeToken({ tokens: 10, updatedAt: NOW - 600_000 }, NOW, 10);
  assert.equal(result.allowed, true);
  assert.equal(result.bucket.tokens, 9);
});

test('refundToken returns exactly one token', () => {
  const result = refundToken({ tokens: 3, updatedAt: NOW }, NOW, 10);
  assert.equal(result.bucket.tokens, 4);
});

test('refundToken never raises the bucket above capacity', () => {
  const result = refundToken({ tokens: 10, updatedAt: NOW }, NOW, 10);
  assert.equal(result.bucket.tokens, 10);
});

test('refundToken on a missing bucket is a no-op at capacity', () => {
  const result = refundToken(undefined, NOW, 6);
  assert.equal(result.bucket.tokens, 6);
});

test('refundToken applies refill before adding the token back', () => {
  // Empty a minute ago means the bucket has fully refilled on its own;
  // the refund must not push it past capacity.
  const result = refundToken({ tokens: 0, updatedAt: NOW - 60_000 }, NOW, 10);
  assert.equal(result.bucket.tokens, 10);
});

test('consume then refund restores the original token count', () => {
  const consumed = consumeToken(undefined, NOW, 10);
  const refunded = refundToken(consumed.bucket, NOW, 10);
  assert.equal(refunded.bucket.tokens, 10);
});

test('resolveRateLimitSalt prefers the explicit RATE_LIMIT_SALT', () => {
  assert.equal(
    resolveRateLimitSalt({ RATE_LIMIT_SALT: 'salt-a', CONSENT_SECRET: 'secret-b', ENVIRONMENT: 'production' }),
    'salt-a',
  );
});

test('resolveRateLimitSalt falls back to CONSENT_SECRET outside development', () => {
  assert.equal(resolveRateLimitSalt({ CONSENT_SECRET: 'secret-b', ENVIRONMENT: 'production' }), 'secret-b');
});

test('resolveRateLimitSalt uses the development literal only in development', () => {
  assert.equal(resolveRateLimitSalt({ ENVIRONMENT: 'development' }), 'development-salt');
});

test('resolveRateLimitSalt returns null in production with no secret material, so callers fail closed', () => {
  assert.equal(resolveRateLimitSalt({ ENVIRONMENT: 'production' }), null);
  assert.equal(resolveRateLimitSalt({}), null);
});

test('resolveRateLimitSalt treats blank values as unset', () => {
  assert.equal(
    resolveRateLimitSalt({ RATE_LIMIT_SALT: '  ', CONSENT_SECRET: 'secret-b', ENVIRONMENT: 'production' }),
    'secret-b',
  );
});
