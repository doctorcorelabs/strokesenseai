# StrokeSense AI Lab

**Experimental AI for Stroke Learning and Practice**

> "An experimental learning lab that illustrates how AI techniques measure signals related to stroke education. It does not diagnose, screen for, or rule out stroke."

StrokeSense AI Lab is the AI-first sibling of StrokeSense. Where the original StrokeSense is an education-first platform (reading material, a 3D brain lab, quizzes), this lab puts working AI tools first: vision, speech, movement, clinical reasoning, and document tools that learners can run, inspect, and critique. Educational content exists only as short context around each tool.

**Not a diagnostic tool or emergency service.** For possible stroke signs, **call Indonesia's national medical emergency number 119 immediately**. Do not wait for an AI response, even if symptoms have stopped.

## Status: Phase 0 (foundation)

The project is in its foundation phase. What exists now:

- The hub shell with the feature registry and maturity labels
- The Scope and Privacy page (a single page at route `#about`) with the intended-use statement, generated from the feature registry
- The FAST manual check and emergency page patterns carried over from StrokeSense
- A Cloudflare Worker gateway skeleton (health endpoint, routing, guard and limiter structure)
- CI, licensing, and deployment configuration

**No AI feature is live yet.** Every feature in the registry, in every group below including Privacy Shield, is at maturity **Concept** in Phase 0: designed and specified in [PLANNING.md](PLANNING.md), not yet implemented or validated. Nothing in this repository is clinically validated or endorsed.

### Planned feature groups (all Concept)

- **Flagship:** Digital FAST Multimodal Lab (face, arm, and speech signals in one guided session)
- **Vision AI:** Face Symmetry Analyzer v2, Face Dynamics Lab, Eye and Gaze Tracker, Visual Field and Neglect Explorer, Scan Explainer
- **Speech and Language AI:** Dysarthria and Slurred Speech Analyzer, Aphasia Expression Lab, Aphasia Communication Mode, Interactive Comprehension Check, Speech-to-NIHSS Language Item Assistant
- **Motor AI:** Arm Drift Quantifier, Finger Tapping and Hand Dexterity Test, Sit-to-Stand and Balance Lab, FAST Vision Check
- **Clinical Reasoning AI:** NIHSS Co-Pilot Trainer, Stroke Code Simulator, Stroke Mimic Detective, Localization Challenge, Virtual Patient OSCE
- **Document and Data AI:** Discharge Lens AI, Risk Factor Extractor, Guideline Navigator, Plain-Language Translator
- **Research Platform:** Model Experiment Bench, Privacy Shield, Adaptive AI Tutor, Evaluation and Transparency Dashboard

See [PLANNING.md](PLANNING.md) for the full specification of every feature, the architecture, the safety and evaluation framework, and the phase roadmap.

## Architecture (summary)

- **Frontend:** React 19 + TypeScript + Vite single-page app with hash routing, deployed as a static site on Netlify. Camera, pose, face, and OCR processing run locally in the browser whenever possible.
- **AI gateway:** a separate Cloudflare Worker is the only path to AI providers (OpenRouter for text and vision models, Cloudflare Workers AI for narrow tasks such as transcription). API keys never reach the browser.
- **Shared contract:** `shared/` holds the feature registry, request/response contracts, and limits used by both the frontend and the Worker.
- **Safety pipeline in the Worker:** server-issued consent tokens, per-feature rate limiting with Durable Objects, CORS origin checks, strict schema validation, an emergency keyword guard that runs before any model call, PII redaction, and output sanitization. Turnstile bot verification exists in the pipeline but only activates when its secret is configured; it is off by default and currently unused.

## Run it locally

Frontend, from the repository root:

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run typecheck
npm test
npm run build
```

Worker, in a second terminal:

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # add a local OpenRouter key for live AI
npm run dev                       # http://localhost:8787
```

Then point the frontend at the Worker with `VITE_API_BASE_URL=http://localhost:8787` (see `.env.example`). With no API URL configured, the frontend runs in offline guide mode and makes no AI requests.

Browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

## Deploy

- **Frontend (Netlify):** connect this GitHub repository in Netlify. The build settings live in `netlify.toml` (build `npm run build`, publish `dist`, Node 22). Set `VITE_API_BASE_URL` to the production Worker origin in the Netlify build environment, per deploy context. Pull requests get deploy previews.
- **Worker (Cloudflare):** deploy from `worker/` with `npx wrangler deploy` after setting the production `ALLOWED_ORIGINS` to the exact Netlify origin and storing the OpenRouter key with `npx wrangler secret put OPENROUTER_API_KEY`. Production origins fail closed: an empty allowlist rejects all AI requests.

### Repository and go-live checklist (manual steps)

The files in this repository cannot enforce these steps by themselves; a person with admin access has to do them, once, in order:

1. **Branch protection (after the first push).** In the GitHub repository settings, protect the `main` branch and require the three CI status checks - **Frontend**, **Worker**, and **E2E** - to pass before merging. Until this is switched on manually, a red CI run does not block a merge; the workflow file alone enforces nothing.
2. **`ALLOWED_ORIGINS` must be set before any public deploy.** It ships empty on purpose and fails closed: with an empty value the Worker rejects every API request with 403. Set it to the exact production origin (https, no path, no trailing slash) and never to `*` or a wildcard preview domain.
3. **Set the required production Worker secrets.** `CONSENT_SECRET` is mandatory: production fails closed without it because consent tokens cannot be signed. `OPENROUTER_API_KEY` is required for live AI answers (without it the model endpoints answer 503, honestly not configured). `TURNSTILE_SECRET` is not used: by product decision (2026-10-21) Turnstile stays off, and without the secret the Worker skips that check in every environment.
4. **Never deploy the `development` Worker environment to a public URL.** In that environment consent is signed with a development fallback secret, by design for local work only. Public staging needs its own separately provisioned environment with real secrets and low-spend keys.
5. **Follow the full runbook.** Step-by-step deployment, verification, and rollback: [docs/GO-LIVE.md](docs/GO-LIVE.md).

## Safety notes

- Every AI feature is designed around explicit states: a result, a **cannot analyze** state with a plain-language reason, an emergency state, and an offline state. A technical failure is never replaced with a normal-looking result.
- Scores and safety decisions are deterministic code. Language models only explain, role-play inside simulations, and judge free-text answers against fixed rubrics.
- Face and voice are biometric data. Processing is local by default; only derived metrics leave the device, and only with per-feature, server-verified consent.
- A feature registry in `shared/` is the single source of truth for what exists. If a feature is not in the registry and in the Scope page, it is not part of this product.

## License

MIT. See [LICENSE](LICENSE). Third-party attributions are in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
