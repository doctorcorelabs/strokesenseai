import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// P0 contract: consent is a session-level agreement held by this client
// module. Once a person agrees in one lab, the agreement covers every
// other lab for the rest of the browser session: it is restored from the
// session record on later page views, honoured per scope, dropped when
// it expires, and forgotten immediately on revoke.
//
// These tests drive the real module through its sessionStorage seam,
// which is the persistence mechanism the contract is built on. (The
// network recording path additionally needs a configured API base; in
// this repo's vitest setup import.meta.env is a fixed per-worker
// snapshot that vi.stubEnv cannot reach, so that seam is covered at the
// component level in ToolCoach.test.tsx instead.)

const CONSENT_STORAGE_KEY = 'ssai.consent.v1';
const HOUR_MS = 3_600_000;

interface StoredConsent {
  token: string;
  scopes: string[];
  agreedScopes: string[];
  expiresAt: number;
}

function seedStoredConsent(overrides: Partial<StoredConsent> = {}): void {
  const record: StoredConsent = {
    token: 'consent-token-1',
    scopes: ['tools'],
    agreedScopes: ['tools'],
    expiresAt: Date.now() + 2 * HOUR_MS,
    ...overrides,
  };
  sessionStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
}

/** Fresh module state, as on a new page view; sessionStorage is untouched. */
async function loadClient() {
  vi.resetModules();
  return import('./client');
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.resetModules();
  sessionStorage.clear();
});

describe('client session consent record', () => {
  it('reports no consent when nothing was recorded this session', async () => {
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(false);
  });

  it('restores an agreement recorded earlier in the session', async () => {
    seedStoredConsent();
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(true);
  });

  it('honours the agreement per scope, not beyond it', async () => {
    seedStoredConsent();
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(true);
    expect(client.hasSessionConsent('chat')).toBe(false);
  });

  it('drops an expired agreement and clears it from storage', async () => {
    seedStoredConsent({ expiresAt: Date.now() - 1_000 });
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(false);
    expect(sessionStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });

  it('ignores a malformed stored record instead of throwing', async () => {
    sessionStorage.setItem(CONSENT_STORAGE_KEY, '{not json');
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(false);
  });

  it('forgets the agreement on revoke, in memory and in storage', async () => {
    seedStoredConsent();
    const client = await loadClient();
    expect(client.hasSessionConsent('tools')).toBe(true);

    client.revokeSessionConsent();
    expect(client.hasSessionConsent('tools')).toBe(false);
    expect(sessionStorage.getItem(CONSENT_STORAGE_KEY)).toBeNull();
  });
});
