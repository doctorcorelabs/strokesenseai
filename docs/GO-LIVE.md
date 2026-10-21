# Go-Live Runbook

This runbook takes StrokeSense AI Lab from a pushed repository to a live deployment: the frontend on Netlify and the API Worker on Cloudflare. It is an operational checklist for a person with admin access to both accounts, not a design document. Safety rules stay in `docs/SAFETY.md`; this file only covers the order and the commands.

Live mode is optional by design. With no `VITE_API_BASE_URL` set, the frontend runs its offline guides and the product is still coherent. Follow this runbook only when live AI is wanted.

## Deployment context: temporary, for a competition

This deployment is temporary, stood up for a competition. Keep it lean: use the default `netlify.app` subdomain and the `workers.dev` URL (the recommended path in step 3), skip the custom `api.*` domain option, and treat branch protection (step 6) as optional. The steps that are not optional, even for a temporary deployment: a real `CONSENT_SECRET` and a funded `OPENROUTER_API_KEY` (step 2), an exact `ALLOWED_ORIGINS` (step 3), and the smoke tests (step 5). Turnstile is intentionally not used (product decision, 2026-10-21): do not set `TURNSTILE_SECRET` and do not set `VITE_TURNSTILE_SITE_KEY`.

## 0. Prerequisites and overall order

- Admin access to the GitHub repository `doctorcorelabs/strokesenseai`, to the Netlify team, and to the Cloudflare account that will own the Worker.
- Node.js and npm locally; Wrangler runs through `npx`, no global install is needed.
- An OpenRouter account with a funded API key, created at openrouter.ai.
- **Create the Netlify site first.** The Worker's `ALLOWED_ORIGINS` must contain the exact Netlify origin, so the site has to exist before the Worker is configured. Deploying in the other order leaves the Worker rejecting every request with 403 (it fails closed on an empty allowlist, by design).
- CI is already in place: `.github/workflows/ci.yml` is in the repository and runs the Frontend, Worker, and E2E jobs on every push. Nothing in this runbook needs CI changes.

Order: Netlify site (step 1), Worker secrets and deploy (steps 2 and 3), frontend wiring (step 4), smoke tests (step 5), branch protection (step 6).

## 1. Create the Netlify site

1. In Netlify: **Add new site, Import an existing project**, connect GitHub, and pick `doctorcorelabs/strokesenseai`, branch `main`.
2. Build settings: build command `npm run build`, publish directory `dist`. The repository's `netlify.toml` is read automatically and also carries the security headers (CSP, HSTS), so do not override the headers in the Netlify UI.
3. Deploy once with no environment variables set. The site comes up in offline guide mode; that is expected at this point.
4. Note the exact site origin, for example `https://strokesense-ai-lab.netlify.app`. Copy it character for character: scheme, host, no path, no trailing slash. A custom domain can replace it later, but then steps 3 and 4 must be repeated with the new origin.

## 2. Worker secrets

From the repository root:

```bash
cd worker
npm install
npx wrangler login
```

`wrangler secret put` prompts for the value and stores it encrypted on Cloudflare. Secrets never go into `wrangler.toml`, the repository, or chat.

Set the OpenRouter key (required for any live AI response; without it the Worker answers an honest `503 not_configured`):

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

Set the consent signing secret. Generate a strong random value first and keep it in a password manager:

```bash
openssl rand -hex 32
npx wrangler secret put CONSENT_SECRET
```

Optionally set a dedicated rate-limit salt:

```bash
npx wrangler secret put RATE_LIMIT_SALT
```

`RATE_LIMIT_SALT` is optional: when it is absent outside development, the Worker falls back to `CONSENT_SECRET` as the salt material. Set it only if the salt should be rotatable independently of the consent secret.

Note on Turnstile: Turnstile is intentionally not activated for this deployment (decision recorded 2026-10-21). Do **not** set `TURNSTILE_SECRET`. The Worker's bot check passes requests through when that secret is absent, and rate limiting plus server-side consent remain the active abuse controls.

## 3. Worker URL decision and deploy

The Worker needs a public URL, and the frontend CSP in `netlify.toml` decides which URLs the browser may call. Two consistent options exist (the same decision point is recorded in the `GO-LIVE DECISION` comment in `worker/wrangler.toml`):

- **Recommended, simplest: enable workers.dev.** In the Cloudflare dashboard, open the Worker `strokesenseai-api`, then **Settings, Domains & Routes**, and enable the workers.dev subdomain. The Worker URL becomes `https://strokesenseai-api.<account-subdomain>.workers.dev`. No CSP change is needed, because `netlify.toml` already allows `https://*.workers.dev` in `connect-src`.
- **Alternative: a custom API domain.** Put the Worker on a route such as `api.<project-domain>`, then add that exact origin to `connect-src` in `netlify.toml` and commit the change. Only pick this when a project domain is already managed in the same Cloudflare account.

Then set the allowlist in `worker/wrangler.toml`, in the top-level `[vars]` block, to the Netlify origin from step 1 (comma separated if there are several, no paths, no trailing slashes, never `*`):

```toml
ALLOWED_ORIGINS = "https://strokesense-ai-lab.netlify.app"
```

Commit and push that change, then deploy from the `worker/` directory:

```bash
git add worker/wrangler.toml
git commit -m "Set production ALLOWED_ORIGINS"
git push
cd worker
npx wrangler deploy
```

Never deploy the `development` environment (`wrangler dev --env development` is for local work): it signs consent with a development fallback secret and is not a public staging environment.

## 4. Frontend wiring

In the Netlify site settings, under **Environment variables**, set:

- `VITE_API_BASE_URL` to the Worker URL from step 3, with no path and no trailing slash, for example `https://strokesenseai-api.<account-subdomain>.workers.dev`.
- Leave `VITE_TURNSTILE_SITE_KEY` unset (see the Turnstile note in step 2).

`VITE_*` variables are read at build time, so trigger a new deploy after setting them (**Deploys, Trigger deploy, Deploy site**). A cache clear is not required. After the redeploy, the hub cards show the live mode badge and the ToolCoach can request live explanations; the offline guides remain the fallback whenever the API is unreachable.

## 5. Post-deploy smoke tests

Run these against the deployed Worker URL, replacing `<worker-url>` and using the real Netlify origin in the `Origin` header. The consent notice version below must match `CONSENT_NOTICE_VERSION` in `shared/contracts.ts`.

Health check returns 200 and `{"status":"ok"}`:

```bash
curl -s https://<worker-url>/health
```

Session, then consent, then a tools explanation (the full live path):

```bash
ORIGIN="Origin: https://strokesense-ai-lab.netlify.app"

SESSION=$(curl -s -X POST https://<worker-url>/api/session \
  -H "$ORIGIN" -H "Content-Type: application/json" -d '{}')
echo "$SESSION"

TOKEN=$(curl -s -X POST https://<worker-url>/api/consent \
  -H "$ORIGIN" -H "Content-Type: application/json" \
  -d '{"sessionId":"<sessionId from the session response>","scopes":["tools"],"noticeVersion":"2026-10-20"}')
echo "$TOKEN"

curl -s -X POST https://<worker-url>/api/tools \
  -H "$ORIGIN" -H "Content-Type: application/json" \
  -H "X-Consent-Token: <token from the consent response>" \
  -d '{"tool":"face","id":"face-analyzer","question":"What does this module measure?"}'
```

The tools call returns a JSON reply with server-side sources. If it returns `503 not_configured`, `OPENROUTER_API_KEY` is missing or empty.

An emergency phrase is answered before any model call, with `"mode":"emergency"` and the static call-119 text:

```bash
curl -s -X POST https://<worker-url>/api/tools \
  -H "$ORIGIN" -H "Content-Type: application/json" \
  -H "X-Consent-Token: <token from the consent response>" \
  -d '{"tool":"face","id":"face-analyzer","question":"What does this module measure?","context":"My face is drooping on one side and my arm feels weak since this morning"}'
```

A request without a consent token is rejected with 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<worker-url>/api/tools \
  -H "$ORIGIN" -H "Content-Type: application/json" \
  -d '{"tool":"face","id":"face-analyzer","question":"What does this module measure?"}'
```

Two dashboard checks finish the smoke test:

- OpenRouter dashboard: the tools call above appears as a first usage entry on the server-locked model `openai/gpt-4o-mini`, with no fallback model listed.
- Rate limit: repeat the tools call in a quick loop (for example 15 times in a minute from one IP). Once the per-feature per-minute budget is exhausted, the Worker answers 429 and refunds nothing it did not consume; after a minute the calls succeed again.

Also open the Netlify site itself, confirm a lab page shows the live mode badge, and confirm the browser console shows no CSP errors for the Worker origin.

## 6. Branch protection

After the first green CI run on `main` (all three jobs passing on the pushed commit), protect the branch in GitHub: **Settings, Branches, Add rule** for `main`, enable **Require status checks to pass before merging**, and select **Frontend**, **Worker**, and **E2E**. Until this is switched on, a red CI run does not block a merge; the workflow file alone enforces nothing.

## 7. Operational notes

- **Rotating `CONSENT_SECRET` invalidates every active consent token immediately.** Users see a consent error and must consent again; the frontend requests a fresh token automatically on the next live call. Rotate on suspicion of leakage, not on a fixed calendar.
- **Raising `CONSENT_NOTICE_VERSION`** in `shared/contracts.ts` (with a Worker redeploy) invalidates tokens issued under older notice versions, which is the intended way to force re-consent after the privacy notice text changes. The frontend sends the version from the same shared constant, so the two cannot drift.
- **Watch OpenRouter spend.** The model is locked server-side to `openai/gpt-4o-mini` (`OPENROUTER_MODEL`), clients cannot select models, and provider fallback is disabled (`allow_fallbacks: false`, `data_collection: "deny"`). Per-feature rate limits and the global aggregate bucket cap the burn rate; an unexpected spend spike means a limit was raised or a secret leaked, and the response is to rotate `OPENROUTER_API_KEY` first.
- **Rollback.** For the Worker, `npx wrangler rollback` returns to the previous deployed version; if the bad state came from `wrangler.toml` variables, fix the variable, commit, and redeploy instead, because rollback does not edit the repository. For the frontend, redeploy the previous Netlify deploy from the Deploys list, or revert the offending commit and push.
- **Offline is a supported state, not an outage.** If the Worker is down or the key is revoked, the frontend falls back to offline guides and labels them as such. Nothing in the product may present that fallback as a live answer (see `docs/SAFETY.md`, section 8).
