// Single client for the StrokeSense AI Lab Worker.
// The browser never holds an AI provider key; every request goes to the Worker.
//
// Consent wiring: live AI calls need a server-issued consent token. The UI
// asks the person to agree first (the ToolCoach checkbox); only then does
// this client record that consent with the Worker (POST /api/consent) and
// attach the returned token to the tools request. Agreement is per scope
// and lasts for the whole browser session: the consent record (token plus
// the scopes the person agreed to) is cached in module memory and mirrored
// to sessionStorage, so agreeing in one lab covers every lab in the same
// tab session and survives in-tab navigation. It dies with the tab, and
// revokeSessionConsent() discards it immediately. The session id itself is
// still held in module memory only.
//
// Turnstile: the site key is a public build-time value. When
// VITE_TURNSTILE_SITE_KEY is set, this client loads Cloudflare's Turnstile
// script and attaches a fresh token as X-Turnstile-Token on the session,
// consent, and tools requests. When the key is not set, nothing is loaded
// and no header is sent; that only passes the Worker check when the Worker
// itself runs without a TURNSTILE_SECRET (a development configuration),
// because a Worker with a secret rejects requests that carry no token.

import { CONSENT_NOTICE_VERSION } from '../../shared/contracts';
import type { ConsentScope } from '../../shared/contracts';

export interface ToolSource {
  title: string;
  url: string;
}

export interface ToolExplainResult {
  reply: string;
  sources: ToolSource[];
  mode: 'live' | 'emergency';
}

export interface ToolExplainInput {
  tool: string;
  id: string;
  context?: string;
  question?: string;
}

const REQUEST_TIMEOUT_MS = 15000;
const TURNSTILE_TIMEOUT_MS = 12000;
const MAX_REPLY_CHARS = 7000;
const DEFAULT_QUESTION = 'Explain this educational selection and its limitations.';
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

function readEnv(name: string): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const fromMeta = (env[name] ?? '').trim();
  if (fromMeta) return fromMeta;
  // Test harnesses stub variables through process.env, where import.meta.env
  // does not always reflect them. The browser build never defines process,
  // so this fallback is inert in production.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return (proc?.env?.[name] ?? '').trim();
}

/** Public Worker origin from the build environment, without a trailing slash. */
export function getApiBase(): string {
  return readEnv('VITE_API_BASE_URL').replace(/\/+$/, '');
}

/** Public Turnstile site key from the build environment, or empty. */
export function getTurnstileSiteKey(): string {
  return readEnv('VITE_TURNSTILE_SITE_KEY');
}

/** Fetch with the shared request timeout; rejects with a safe message. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } catch (caught) {
    if (caught instanceof Error && caught.name === 'AbortError') {
      throw new Error(
        'The AI request timed out. Use the local guide; do not wait for AI if symptoms are present.',
      );
    }
    throw new Error('Live AI could not be reached. The local guide remains available.');
  } finally {
    window.clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Turnstile (loaded only when a site key is configured)
// ---------------------------------------------------------------------------

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => string;
  execute?: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

function turnstileApi(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

let turnstileScriptPromise: Promise<boolean> | null = null;

function loadTurnstileScript(): Promise<boolean> {
  if (turnstileApi()) return Promise.resolve(true);
  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(Boolean(turnstileApi()));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }
  return turnstileScriptPromise;
}

/**
 * Obtain a fresh single-use Turnstile token, or null when Turnstile is not
 * configured or the widget could not run. A null token means the request
 * goes out without the header (see the note at the top of this file).
 */
async function obtainTurnstileToken(): Promise<string | null> {
  const siteKey = getTurnstileSiteKey();
  if (!siteKey) return null;
  if (!(await loadTurnstileScript())) return null;
  const api = turnstileApi();
  if (!api) return null;
  return new Promise<string | null>((resolve) => {
    const container = document.createElement('div');
    container.setAttribute('aria-hidden', 'true');
    container.style.position = 'fixed';
    container.style.bottom = '0';
    container.style.right = '0';
    document.body.appendChild(container);
    let widgetId: string | null = null;
    let settled = false;
    let timer = 0;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (widgetId) {
        try {
          api.remove(widgetId);
        } catch {
          // Widget already gone; nothing to clean up.
        }
      }
      container.remove();
      resolve(token);
    };
    timer = window.setTimeout(() => finish(null), TURNSTILE_TIMEOUT_MS);
    try {
      widgetId = api.render(container, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'interaction-only',
        callback: (token: string) => finish(token),
        'error-callback': () => finish(null),
        'expired-callback': () => finish(null),
        'timeout-callback': () => finish(null),
      });
      api.execute?.(widgetId);
    } catch {
      finish(null);
    }
  });
}

/** JSON headers, plus a Turnstile token when one can be obtained. */
async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const turnstileToken = await obtainTurnstileToken();
  if (turnstileToken) headers['X-Turnstile-Token'] = turnstileToken;
  return headers;
}

// ---------------------------------------------------------------------------
// Session and consent (module memory, mirrored to sessionStorage)
// ---------------------------------------------------------------------------

let sessionPromise: Promise<string> | null = null;

/**
 * Start (or reuse) a Worker session and return its id. The id is held in
 * module memory only. The session call itself stores nothing server-side in
 * this phase; it exists so consent tokens can be bound to one session.
 */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    const pending = (async () => {
      const api = getApiBase();
      if (!api) {
        throw new Error('Live AI is not configured for this build. The local guide is available.');
      }
      const headers = await buildHeaders();
      const response = await fetchWithTimeout(`${api}/api/session`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        throw new Error(
          'A session with the AI service could not be started, so nothing was sent. The local guide remains available.',
        );
      }
      const data: unknown = await response.json().catch(() => null);
      const sessionId = (data as { sessionId?: unknown } | null)?.sessionId;
      if (typeof sessionId !== 'string' || !sessionId) {
        throw new Error(
          'The AI service returned an invalid session, so nothing was sent. The local guide remains available.',
        );
      }
      return sessionId;
    })();
    // A failed start is not cached: the next attempt may succeed.
    sessionPromise = pending.catch((caught: unknown) => {
      sessionPromise = null;
      throw caught;
    });
  }
  return sessionPromise;
}

interface ConsentEntry {
  token: string;
  /** Scopes the issued token itself covers (exactly what the Worker granted). */
  scopes: ConsentScope[];
  /**
   * Scopes the person has agreed to during this browser session. Wider
   * than `scopes` is possible: agreement is remembered per scope even when
   * a later recording replaced the token with a narrower one.
   */
  agreedScopes: ConsentScope[];
  expiresAt: number;
}

const CONSENT_STORAGE_KEY = 'ssai.consent.v1';
const CONSENT_SCOPES: readonly ConsentScope[] = ['chat', 'vision', 'audio', 'tools'];

let consentEntry: ConsentEntry | null = null;
let consentLoaded = false;

function consentStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function isConsentScope(value: unknown): value is ConsentScope {
  return typeof value === 'string' && (CONSENT_SCOPES as readonly string[]).includes(value);
}

/** Validate and restore a consent record written by an earlier page view. */
function loadStoredConsent(): ConsentEntry | null {
  const store = consentStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const record = data as { token?: unknown; scopes?: unknown; agreedScopes?: unknown; expiresAt?: unknown };
    if (typeof record.token !== 'string' || !record.token) return null;
    if (typeof record.expiresAt !== 'number' || !(record.expiresAt > 0)) return null;
    const scopes = Array.isArray(record.scopes) ? record.scopes.filter(isConsentScope) : [];
    const agreedScopes = Array.isArray(record.agreedScopes)
      ? record.agreedScopes.filter(isConsentScope)
      : [...scopes];
    if (!scopes.length) return null;
    return { token: record.token, scopes, agreedScopes, expiresAt: record.expiresAt };
  } catch {
    return null;
  }
}

function persistConsent(): void {
  const store = consentStorage();
  if (!store) return;
  try {
    if (consentEntry) {
      store.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentEntry));
    } else {
      store.removeItem(CONSENT_STORAGE_KEY);
    }
  } catch {
    // Storage full or blocked: the in-memory record still works this page.
  }
}

/**
 * The current consent record, restored from sessionStorage on first use in
 * a page. Expired records are dropped (and cleared from storage) so a stale
 * agreement never lingers into a new decision.
 */
function currentConsent(): ConsentEntry | null {
  if (!consentLoaded) {
    consentLoaded = true;
    consentEntry = loadStoredConsent();
  }
  if (consentEntry && consentEntry.expiresAt <= Date.now()) {
    consentEntry = null;
    persistConsent();
  }
  return consentEntry;
}

function consentStillValid(entry: ConsentEntry): boolean {
  return entry.expiresAt - 60_000 > Date.now();
}

/**
 * Whether the person has already agreed to this scope in this browser
 * session and that agreement is still comfortably valid. UI uses this to
 * render the agreed state instead of asking for the same consent again in
 * every lab.
 */
export function hasSessionConsent(scope: ConsentScope): boolean {
  const entry = currentConsent();
  return Boolean(entry && consentStillValid(entry) && entry.agreedScopes.includes(scope));
}

/**
 * Discard the session consent: the cached token and the remembered
 * agreement are dropped from memory and sessionStorage, so the next live
 * AI request needs a fresh agreement and a fresh recording. The Worker
 * session id is untouched; consent tokens are bearer proofs, so discarding
 * the token is what stops this client from using it.
 */
export function revokeSessionConsent(): void {
  consentLoaded = true;
  consentEntry = null;
  persistConsent();
}

/** The cached consent token covering a scope, if still comfortably valid. */
function cachedConsentToken(scope: ConsentScope): string | null {
  const entry = currentConsent();
  if (!entry || !consentStillValid(entry)) return null;
  return entry.scopes.includes(scope) ? entry.token : null;
}

/**
 * Record consent with the Worker and return the issued token. Call this
 * only after the person has explicitly agreed (the coach's consent box);
 * this function is the recording step, not the agreement itself. Tokens are
 * cached per scope set until shortly before they expire, and the scopes
 * the person agreed to are remembered for the rest of the browser session.
 */
export async function requestConsentToken(scopes: ConsentScope[]): Promise<string> {
  const api = getApiBase();
  if (!api) {
    throw new Error('Live AI is not configured for this build. The local guide is available.');
  }
  const existing = currentConsent();
  if (existing && consentStillValid(existing) && scopes.every((scope) => existing.scopes.includes(scope))) {
    return existing.token;
  }
  const sessionId = await ensureSession();
  const headers = await buildHeaders();
  const response = await fetchWithTimeout(`${api}/api/consent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sessionId,
      scopes,
      noticeVersion: CONSENT_NOTICE_VERSION,
    }),
  });
  if (!response.ok) {
    throw new Error(
      'Your consent could not be recorded by the AI service, so nothing was sent. The local guide remains available.',
    );
  }
  const data: unknown = await response.json().catch(() => null);
  const record = data as { token?: unknown; expiresIn?: unknown } | null;
  if (!record || typeof record.token !== 'string' || !record.token) {
    throw new Error(
      'The AI service returned an invalid consent token, so nothing was sent. The local guide remains available.',
    );
  }
  const expiresInSeconds =
    typeof record.expiresIn === 'number' && record.expiresIn > 0 ? record.expiresIn : 7200;
  // A still-valid earlier agreement keeps its scopes: agreeing to one more
  // scope never silently un-agrees another one within the same session.
  const agreedScopes =
    existing && consentStillValid(existing)
      ? [...new Set([...existing.agreedScopes, ...scopes])]
      : [...scopes];
  consentEntry = {
    token: record.token,
    scopes: [...scopes],
    agreedScopes,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  consentLoaded = true;
  persistConsent();
  return record.token;
}

// ---------------------------------------------------------------------------
// Tools explainer
// ---------------------------------------------------------------------------

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

function parseResult(data: unknown): ToolExplainResult {
  if (!data || typeof data !== 'object') {
    throw new Error('The AI service returned an invalid response. Use the local guide instead.');
  }
  const record = data as { reply?: unknown; sources?: unknown; mode?: unknown };
  if (
    typeof record.reply !== 'string' ||
    !record.reply.trim() ||
    record.reply.length > MAX_REPLY_CHARS
  ) {
    throw new Error('The AI service returned an invalid response. Use the local guide instead.');
  }
  if (record.mode !== 'live' && record.mode !== 'emergency') {
    throw new Error('The AI service returned an invalid response. Use the local guide instead.');
  }
  const sources = Array.isArray(record.sources) ? record.sources.filter(isSource) : [];
  return { reply: record.reply, sources, mode: record.mode };
}

/**
 * Ask the Worker to explain one allowlisted tool selection.
 * A consent token for the "tools" scope is attached automatically when one
 * has been recorded through requestConsentToken (or passed in explicitly).
 * This function never records consent by itself: agreement is a UI act.
 * Throws an Error with a safe, user-facing English message on any failure.
 */
export async function requestToolExplanation(
  input: ToolExplainInput,
  opts?: { consentToken?: string },
): Promise<ToolExplainResult> {
  const api = getApiBase();
  if (!api) {
    throw new Error('Live AI is not configured for this build. The local guide is available.');
  }
  const headers = await buildHeaders();
  const consentToken = opts?.consentToken ?? cachedConsentToken('tools');
  if (consentToken) headers['X-Consent-Token'] = consentToken;

  const response = await fetchWithTimeout(`${api}/api/tools`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      tool: input.tool,
      id: input.id,
      context: (input.context ?? '').slice(0, 1000),
      question: (input.question ?? '').trim().slice(0, 600) || DEFAULT_QUESTION,
    }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'AI request limit reached. Use the local guide and try again later.'
        : 'Live AI could not respond. The local guide and emergency actions remain available.',
    );
  }
  const data: unknown = await response.json().catch(() => null);
  return parseResult(data);
}
