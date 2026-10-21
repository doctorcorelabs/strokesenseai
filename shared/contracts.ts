// Shared request and response contracts between the frontend and the Worker.
// Chat history is intentionally NOT part of ChatRequest: history is managed
// server-side per session so the client can never inject fake turns.
export interface SourceLink {
  title: string;
  url: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  sources: SourceLink[];
  mode: 'live' | 'emergency';
}

export interface ToolRequest {
  tool: string;
  id: string;
  context?: string;
  question?: string;
}

export interface ToolResponse {
  reply: string;
  sources: SourceLink[];
  mode: 'live' | 'emergency';
}

// Default vision mode: only derived landmark metrics leave the browser,
// never a raw photo. Image upload is a separate, explicitly enabled mode.
export interface VisionMetricsRequest {
  featureId: string;
  metrics: Record<string, number | string | boolean>;
  question?: string;
}

// The consent notice version currently in force. The Worker rejects consent
// requests that name any other version at issuance, and rejects tokens that
// carry any other version at verification, so publishing a new notice text
// (and bumping this constant) invalidates previously issued consent tokens.
export const CONSENT_NOTICE_VERSION = '2026-10-20';

export type ConsentScope = 'chat' | 'vision' | 'audio' | 'tools';

export interface ConsentRequest {
  sessionId: string;
  scopes: ConsentScope[];
  noticeVersion: string;
}
