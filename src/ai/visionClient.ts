// Client for POST /api/vision image mode, the AI analysis path for
// uploaded photos and video frames.
//
// This mirrors askClient.ts on purpose: the browser never holds a
// provider key, requests carry the session consent token, failures
// surface as safe user-facing English messages, and replies are
// validated before they are shown.
//
// Consent discipline matches the other AI clients: requestConsentToken
// is the recording step, so callers must only invoke analyzeWithAi
// after the person has explicitly agreed in this session (a ticked
// consent notice, or a vision agreement already given in another lab).
// The token requested here covers the 'vision' scope specifically: an
// existing session token that only covers another scope (for example
// chat) does not cover vision, and requestConsentToken then records a
// fresh token for the vision scope. This module never asks for
// agreement by itself.
//
// The Worker answers image mode with { reply, sources: [], mode }.
// For a normal analysis, reply is a JSON string of the fixed shape
// { headline, observations, cannotAnalyze, reason } and mode is
// 'live-ai'. When the emergency guard fires, mode is 'emergency' and
// reply is the plain emergency text instead of JSON.

import { ensureSession, getApiBase, requestConsentToken } from './client';

/** The allowlisted upload exercises the Worker accepts for image mode. */
export type VisionTask =
  | 'face-photo'
  | 'face-video'
  | 'arm-video'
  | 'hand-video'
  | 'fast-face'
  | 'fast-arm'
  | 'document-photo'
  | 'face-localizer';

export type VisionAnalysis = {
  headline: string;
  observations: string[];
  cannotAnalyze: boolean;
  reason: string | null;
  emergency: boolean;
};

export interface VisionAnalyzeInput {
  task: VisionTask;
  /** JPEG or PNG data URLs, 1 to 6, in time order for video tasks. */
  images: string[];
  /** Optional short note; the Worker treats it as untrusted text. */
  note?: string;
}

// Image requests carry whole frames, so they get a longer leash than
// the text clients before the timeout fires.
const REQUEST_TIMEOUT_MS = 30000;
const MAX_REPLY_CHARS = 7000;
const MAX_IMAGES = 6;
const MAX_NOTE_CHARS = 1000;

interface ParsedReplyShape {
  headline: string;
  observations: string[];
  cannotAnalyze: boolean;
  reason: string | null;
}

/**
 * Parse the model's JSON reply into the fixed analysis shape. The
 * Worker already normalizes its side, but the client validates again:
 * a reply that is not the expected shape is wrapped as a single plain
 * observation instead of being trusted, the same fall-back the Worker
 * applies. Returns null only when the reply is not usable text at all.
 */
export function parseVisionReply(reply: string): ParsedReplyShape {
  const candidates = [
    reply,
    reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
  ];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;
      const record = parsed as {
        headline?: unknown;
        observations?: unknown;
        cannotAnalyze?: unknown;
        reason?: unknown;
      };
      if (
        typeof record.headline === 'string' &&
        record.headline.trim() &&
        Array.isArray(record.observations) &&
        record.observations.every((item) => typeof item === 'string') &&
        typeof record.cannotAnalyze === 'boolean'
      ) {
        return {
          headline: record.headline,
          observations: record.observations as string[],
          cannotAnalyze: record.cannotAnalyze,
          reason: typeof record.reason === 'string' ? record.reason : null,
        };
      }
    } catch {
      // Not JSON: fall through to the wrapper below.
    }
  }
  return {
    headline: 'AI analysis',
    observations: [reply],
    cannotAnalyze: false,
    reason: null,
  };
}

function parseResponse(data: unknown): VisionAnalysis {
  if (!data || typeof data !== 'object') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  const record = data as { reply?: unknown; mode?: unknown };
  if (
    typeof record.reply !== 'string' ||
    !record.reply.trim() ||
    record.reply.length > MAX_REPLY_CHARS
  ) {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  if (record.mode === 'emergency') {
    // The emergency reply is plain guidance text, not the JSON shape.
    // It travels in observations so the caller can show it verbatim
    // under the emergency panel.
    return {
      headline: 'Possible emergency signs',
      observations: [record.reply],
      cannotAnalyze: false,
      reason: null,
      emergency: true,
    };
  }
  if (record.mode !== 'live-ai') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  return { ...parseVisionReply(record.reply), emergency: false };
}

/**
 * Shared transport for every image-mode call: ensures the Worker
 * session exists, attaches a consent token covering the vision scope,
 * posts the request, and returns the decoded response body. Throws an
 * Error with a safe, user-facing message on any failure.
 */
async function requestVision(input: VisionAnalyzeInput): Promise<unknown> {
  const api = getApiBase();
  if (!api) {
    throw new Error('Live AI is not configured for this build.');
  }
  if (input.images.length < 1 || input.images.length > MAX_IMAGES) {
    throw new Error('No frames were prepared from that file. Choose a different file and try again.');
  }
  await ensureSession();
  const consentToken = await requestConsentToken(['vision']);

  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${api}/api/vision`, {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Consent-Token': consentToken,
      },
      body: JSON.stringify({
        mode: 'image',
        task: input.task,
        images: input.images,
        ...(input.note ? { note: input.note.slice(0, MAX_NOTE_CHARS) } : {}),
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
  return response.json().catch(() => null);
}

/**
 * Send prepared frames (data URLs from the extraction helpers in
 * src/ml/analyze.ts) to the Worker for AI analysis of one upload
 * exercise. Ensures the Worker session exists, attaches a consent
 * token covering the vision scope, and throws an Error with a safe,
 * user-facing message on any failure.
 */
export async function analyzeWithAi(input: VisionAnalyzeInput): Promise<VisionAnalysis> {
  return parseResponse(await requestVision(input));
}

// ---------------------------------------------------------------------------
// Face Lesion Localizer: the extended reply shape.
//
// The 'face-localizer' task returns the base shape plus three fields
// the descriptive tasks never carry: a short pattern code, up to four
// candidate lesion levels (site, tract, vessel, qualitative
// confidence, rationale), and up to five ranked possibilities. The
// Worker normalizes and caps these on its side; the client validates
// again before anything is shown, dropping or downgrading anything
// that does not fit the contract instead of trusting it.
// ---------------------------------------------------------------------------

/** Qualitative fit of one candidate level. Never a number or a score. */
export type LocalizerConfidence = 'high' | 'moderate' | 'low';

export interface LocalizerCandidate {
  site: string;
  tract: string;
  vessel: string;
  confidence: LocalizerConfidence;
  rationale: string;
}

export interface LocalizerPossibility {
  name: string;
  note: string;
}

export interface LocalizerAnalysis {
  headline: string;
  observations: string[];
  cannotAnalyze: boolean;
  reason: string | null;
  /** Short pattern code from the Worker, for example 'central-umn'. */
  pattern: string | null;
  lesionCandidates: LocalizerCandidate[];
  possibilities: LocalizerPossibility[];
  emergency: boolean;
}

interface ParsedLocalizerShape {
  headline: string;
  observations: string[];
  cannotAnalyze: boolean;
  reason: string | null;
  pattern: string | null;
  lesionCandidates: LocalizerCandidate[];
  possibilities: LocalizerPossibility[];
}

const LOCALIZER_CONFIDENCES: readonly LocalizerConfidence[] = ['high', 'moderate', 'low'];
const MAX_LOCALIZER_CANDIDATES = 4;
const MAX_LOCALIZER_POSSIBILITIES = 5;
const MAX_LOCALIZER_FIELD_CHARS = 400;

function localizerText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_LOCALIZER_FIELD_CHARS) : null;
}

function parseLocalizerCandidate(value: unknown): LocalizerCandidate | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const site = localizerText(record.site);
  const tract = localizerText(record.tract);
  const vessel = localizerText(record.vessel);
  const rationale = localizerText(record.rationale);
  if (!site || !tract || !vessel || !rationale) return null;
  // An unknown confidence word is downgraded to 'low', never upgraded:
  // the same conservative rule the Worker normalizer applies.
  const confidence = LOCALIZER_CONFIDENCES.includes(record.confidence as LocalizerConfidence)
    ? (record.confidence as LocalizerConfidence)
    : 'low';
  return { site, tract, vessel, confidence, rationale };
}

function parseLocalizerPossibility(value: unknown): LocalizerPossibility | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const name = localizerText(record.name);
  const note = localizerText(record.note);
  if (!name || !note) return null;
  return { name, note };
}

/**
 * Parse the localizer JSON reply. The base shape is validated exactly
 * like parseVisionReply; the extended fields are validated entry by
 * entry, so one malformed candidate cannot sink the whole reply, and
 * a cannot-analyze reply never carries candidates or possibilities,
 * whatever the model wrote.
 */
export function parseLocalizerReply(reply: string): ParsedLocalizerShape {
  const candidates = [
    reply,
    reply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
  ];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;
      const record = parsed as {
        headline?: unknown;
        observations?: unknown;
        cannotAnalyze?: unknown;
        reason?: unknown;
        pattern?: unknown;
        lesionCandidates?: unknown;
        possibilities?: unknown;
      };
      if (
        typeof record.headline === 'string' &&
        record.headline.trim() &&
        Array.isArray(record.observations) &&
        record.observations.every((item) => typeof item === 'string') &&
        typeof record.cannotAnalyze === 'boolean'
      ) {
        const cannotAnalyze = record.cannotAnalyze;
        return {
          headline: record.headline,
          observations: record.observations as string[],
          cannotAnalyze,
          reason: typeof record.reason === 'string' ? record.reason : null,
          pattern: localizerText(record.pattern),
          lesionCandidates: cannotAnalyze
            ? []
            : (Array.isArray(record.lesionCandidates) ? record.lesionCandidates : [])
                .map(parseLocalizerCandidate)
                .filter((entry): entry is LocalizerCandidate => entry !== null)
                .slice(0, MAX_LOCALIZER_CANDIDATES),
          possibilities: cannotAnalyze
            ? []
            : (Array.isArray(record.possibilities) ? record.possibilities : [])
                .map(parseLocalizerPossibility)
                .filter((entry): entry is LocalizerPossibility => entry !== null)
                .slice(0, MAX_LOCALIZER_POSSIBILITIES),
        };
      }
    } catch {
      // Not JSON: fall through to the wrapper below.
    }
  }
  return {
    headline: 'AI analysis',
    observations: [reply],
    cannotAnalyze: false,
    reason: null,
    pattern: null,
    lesionCandidates: [],
    possibilities: [],
  };
}

function parseLocalizerResponse(data: unknown): LocalizerAnalysis {
  if (!data || typeof data !== 'object') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  const record = data as { reply?: unknown; mode?: unknown };
  if (
    typeof record.reply !== 'string' ||
    !record.reply.trim() ||
    record.reply.length > MAX_REPLY_CHARS
  ) {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  if (record.mode === 'emergency') {
    return {
      headline: 'Possible emergency signs',
      observations: [record.reply],
      cannotAnalyze: false,
      reason: null,
      pattern: null,
      lesionCandidates: [],
      possibilities: [],
      emergency: true,
    };
  }
  if (record.mode !== 'live-ai') {
    throw new Error('The AI service returned an invalid response. Please try again.');
  }
  return { ...parseLocalizerReply(record.reply), emergency: false };
}

export interface LocalizerAnalyzeInput {
  /** One JPEG or PNG data URL: the single photo this feature reads. */
  images: string[];
  /** Optional short note; the Worker treats it as untrusted text. */
  note?: string;
}

/**
 * Analyze one uploaded face photo with the localizer task. Same
 * consent discipline as analyzeWithAi: callers invoke this only after
 * the person has explicitly agreed in this session.
 */
export async function analyzeLocalizer(input: LocalizerAnalyzeInput): Promise<LocalizerAnalysis> {
  return parseLocalizerResponse(
    await requestVision({ task: 'face-localizer', images: input.images, note: input.note }),
  );
}
