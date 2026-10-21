# Changelog

All notable changes to StrokeSense AI Lab are recorded in this file. Versions follow the project phases defined in `PLANNING.md`: the 0.x series covers the foundation and experimental lab releases before any public launch decision.

## [Unreleased]

Fixes and hardening from the 15-analyst audit of the Phase 0 build (2026-10-20). No feature behavior changes for end users beyond correctness and safety of what already shipped.

### Fixed

- Emergency guard hardening on both the Worker and the client: wider paraphrase coverage (vision loss, numbness phrasing, thunderclap headache, Indonesian symptom wording, "cannot move" reports), with regression tests against the red-team paraphrase bank.
- Worker handler hardening: stricter request validation and error handling across the AI gateway endpoints.
- Mobile layout overflow fixes found in the responsive trial.
- Consent flow wiring so the consent state shown in the UI and the token the Worker expects cannot silently disagree.
- E2E and CI fixes: the FAST escalation test now targets the emergency alert element directly (it previously failed strict-mode checks on a correct page); axe accessibility checks now run on every lab route and the emergency route; an offline network test proves no request leaves the app origin; the mobile Playwright project is Chromium-based so the whole matrix actually runs; CI keeps E2E failure artifacts and has a dependency audit job.

## [0.1.0] - 2026-10-20

Phase 0 foundation: the working application shell, the AI gateway, and the governance ground rules every later feature must pass. All 28 registered features are at maturity `concept`; no AI feature is live and nothing is clinically validated.

### Added

- Project planning document (`PLANNING.md`): product positioning as an AI-first experimental learning lab, 28 planned features in 7 groups, system architecture (Netlify frontend, Cloudflare Worker AI gateway), safety and evaluation framework, and a phased roadmap.
- Frontend application (React 19 + TypeScript + Vite, hash routing):
  - Hub home page that lists all 28 features from the registry with their maturity labels, plus an honest AI status panel (offline guides when no Worker URL is configured).
  - A generic lab page per registered feature with an explicit cannot-analyze demonstration panel, the feature's own limitations from the registry, and the contextual AI coach in offline guide mode.
  - Manual FAST check with immediate escalation to calling 119, an emergency page, and the Scope and Privacy page at route `#about`, whose feature list is generated from the same registry.
  - Offline-first behavior: with no `VITE_API_BASE_URL` configured, the frontend makes no AI requests at all.
- Feature registry and shared contract in `shared/`: the registry (`registry.ts`) as the single source of truth for all 28 features, request and response contracts, limits, and the server-side lab concept modules.
- Cloudflare Worker AI gateway (`worker/`, `strokesenseai-api`): health endpoint, session and server-issued consent tokens, Turnstile verification, per-feature rate limiting with a Durable Object, strict schema validation, the bilingual emergency guard that runs before any model call, PII redaction, and output sanitization. Endpoints whose features are not built yet answer honestly (audio transcription: 503 not configured; vision image mode: 501 disabled by default).
- Continuous integration (`.github/workflows/ci.yml`): frontend typecheck, unit tests, and build; worker typecheck, tests, and a Wrangler dry-run deploy; Playwright end-to-end tests on desktop and mobile viewports. Dependabot is configured for both npm packages and GitHub Actions.
- Deployment configuration (`netlify.toml`): build and publish settings, SPA redirect, security headers including a Content Security Policy, and immutable caching for hashed assets.
- Governance documents in `docs/`:
  - `INTENDED-USE.md`: the binding intended use statement, target users, non-target users, and the rule that copy contradicting the statement is a bug.
  - `CLAIM-AUDIT.md`: forbidden claim vocabulary, recommended safe phrasing, and the per-release claim audit procedure.
  - `PRIVACY-DPIA-OUTLINE.md`: DPIA outline under UU PDP covering data categories per feature, zero retention, data subject rights, the 3 x 24 hour breach notification procedure, and the checklist that blocks public biometric activation until completed.
  - `SAFETY.md`: public safety principles, including the cannot-analyze state, uncertainty display, the ban on diagnosis-like scores, emergency-first behavior, and per-feature kill switches.
- Evaluation scaffolding in `eval/`:
  - Harness description and release gates (`eval/README.md`).
  - Golden dataset format per domain and the datasheet obligation (`eval/golden/README.md`).
  - Red-team categories and pass criteria (`eval/redteam/README.md`), including the executable emergency guard paraphrase set (`eval/redteam/guard-paraphrases.json`).
  - Release benchmark report format (`eval/reports/README.md`).

### Notes

- The application shell, the Worker gateway, and the offline guide mode are real and tested; the 28 lab features themselves are specifications rendered as concept pages, not working tools. Nothing in this entry is a medical capability.
- No feature carries the `validated` maturity label, and none of the numbers produced by the evaluation harness may be described as clinical performance.
- Operational follow-ups that a file cannot do by itself (branch protection, production secrets, `ALLOWED_ORIGINS`) are listed in the README under "Repository and go-live checklist".
