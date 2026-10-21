// Shared Worker environment bindings and variables.
// Secrets (OPENROUTER_API_KEY, CONSENT_SECRET, RATE_LIMIT_SALT) are never
// committed: they come from .dev.vars locally or `wrangler secret put`.
// TURNSTILE_SECRET is optional and not used by default: Turnstile is
// disabled for this product (decision 2026-10-21), and verification only
// runs if a secret is configured anyway.
export interface Env {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  ALLOWED_ORIGINS?: string;
  ENVIRONMENT?: string;
  CONSENT_SECRET?: string;
  TURNSTILE_SECRET?: string;
  RATE_LIMIT_SALT?: string;
  IP_REQUESTS_PER_MINUTE?: string;
  GLOBAL_REQUESTS_PER_MINUTE?: string;
  RATE_LIMITER?: DurableObjectNamespace;
  // Optional bindings, provisioned later (see wrangler.toml notes).
  SESSIONS?: KVNamespace;
  AUDIT?: D1Database;
}
