# Changelog

All notable changes to StrokeSense AI Lab are recorded in this file. Versions follow the project phases defined in `PLANNING.md`: the 0.x series covers the foundation and experimental lab releases before any public launch decision.

## [Unreleased]

Fixes and hardening from the 15-analyst audit of the Phase 0 build (2026-10-20). No feature behavior changes for end users beyond correctness and safety of what already shipped.

### Face Lesion Localizer (2026-10-22)

#### Added

- New lab: Face Lesion Localizer (route #lab/lesion-localizer). The visitor uploads one photo of a face, and nothing is sent anywhere until they accept the vision consent and press "Analyze photo". The photo is analyzed by the Worker AI endpoint (new dedicated `face-localizer` task on POST /api/vision) rather than on the device, following the product direction set by the AI upload analysis package below: one photo in, one result sheet out, in experimental mode.
- The result sheet leads with the visible pattern (which parts of the face look weaker, and whether the forehead is involved), then explores, in ranked order, the candidate lesion levels along the corticobulbar pathway (the command pathway from the brain to the face muscles), each with the tract involved, the candidate blood vessels, and a qualitative confidence. Confidence is capped at moderate on both the Worker and the client, because a single still photo has no time dimension: movement speed, fatigability, synkinesis, and the difference between a commanded and a spontaneous smile cannot be judged from it. A pathway diagram marks the candidate levels on the facial movement pathway, and condition names appear only inside a possibilities list, each with the signs that support it and the signs that do not fit.
- The framing is possibility exploration end to end, never a diagnosis: the sheet opens by saying so, the model prompt forbids scores, percentages, and words of certainty, and every result closes with the note that only an in-person examination and brain imaging (CT or MRI) can confirm where a lesion is. The Worker runs the localizer through its own prompt and a strict normalizer (a model confidence of "high" is downgraded to "moderate", a cannotAnalyze answer empties the pattern and both lists and renders the standard cannot-analyze sheet, and the emergency guard still answers acute-symptom notes before any model call). The catalog labels the feature 'mixed' and its registry copy states plainly that the photo leaves the device only on the Analyze press and that no score or diagnosis is produced.
- Coverage: worker V-LOC tests lock the normalizer and the guard order, frontend result-model tests cover the sheet, and an e2e case in e2e/upload-ai.spec.ts proves no vision request leaves before consent and the Analyze press and that the possibility sheet renders from the stubbed reply.

### AI upload analysis (2026-10-22)

Product decision (2026-10-22): uploads are analyzed by the site AI service instead of depending only on a live camera, which did not work well on every device. The live on-device measurement paths are unchanged and remain the default wherever they already existed as measurement; the upload path is a separate, clearly labelled source whose results are AI descriptions, not measurements.

- Face Lab, Movement Lab, and the face and arm stages of FAST Live Check now accept an uploaded photo or video as their first, default source. Frames are prepared on the device (a photo as-is, or up to six frames extracted from a video), shown to the person before anything is sent, and sent only when they press the Analyze button after the vision consent. A shared UploadPanel component carries the picker validation and a privacy line each lab must state truthfully for its own path.
- Document Studio gained a photo mode next to its pasted-text tools: a photographed document is read by the AI service, while the pasted-text path stays fully local with its deterministic parsers. Both results carry a source badge so the two are never confused.
- The Worker endpoint POST /api/vision gained an image mode next to its metrics mode: seven allowlisted tasks (face-photo, face-video, arm-video, hand-video, fast-face, fast-arm, document-photo), one to six JPEG or PNG data URLs, the same session consent (new 'vision' scope), emergency guard over the note and task context, PII redaction, and per-scope rate limiting as the other AI endpoints. The model answers in one fixed JSON shape (headline, observations, cannotAnalyze, reason) and is instructed to describe only visible signals, never to diagnose, classify, score, or call anything normal or abnormal; a cannotAnalyze answer is rendered as the standard cannot-analyze sheet with the model's reason.
- Honest labelling was re-aligned for the dual-path features: the catalog mode kind for FAST Live Check, Face Lab, Movement Lab, and Document Studio is now 'mixed' (on-device core plus optional AI upload), their registry models and benefit copy describe both paths including what leaves the device, and every AI upload result sheet is labelled 'Live AI' with a framing line stating the AI describes what it can see and does not measure.
- E2E coverage for the upload path (e2e/upload-ai.spec.ts) runs against intercepted Worker stubs and proves no vision request leaves before the Analyze press; it runs when the dev server is started with VITE_API_BASE_URL set, which playwright.config.ts now passes through from the shell while keeping the empty default the offline privacy gate depends on.

### User-facing simplification (P0 package, 2026-10-21)

From the UX audit of the live build (15 analysts, 2026-10-21): the lab experience was simplified without removing any feature or weakening any safety rule.

- Lab pages are much shorter: the interactive workspace now comes first, right under the page title, and the About text, the AI coach, the cannot-analyze example, and the limitations moved into one collapsible "About and help" section below it. The permanent cannot-analyze panel no longer sits on every lab page; it appears only when an analysis actually cannot run.
- Consent is asked once per session for each scope instead of being reset on every lab page, every text edit, and every redaction. Earlier results are marked "text changed, run again" instead of being deleted.
- Every feature now carries one honest mode label computed from how that feature actually works (live AI, on-device, or simulation) in place of the single site-wide badge, so a scripted or on-device lab is no longer badged "Live AI" just because the API is configured. The Scope page list uses the same per-feature labels, with a short plain-language explanation of the three modes.
- The hub gained a "Start here" section with a small set of curated starter labs, a featured card for the Digital FAST flagship, and per-card icons and time estimates that show what each lab needs (camera, microphone, text, or no input).
- Sample buttons are now consistent everywhere: one click loads the built-in example and runs it, instead of load, consent, then analyze as separate steps.
- Registry summaries, hub taglines, and coach text were rewritten to describe the input and method each feature really uses; camera, pose tracking, OCR, and AI wording was removed from features that do not have them, and the Dysarthria Analyzer's Indonesian practice mode was removed from this English release.
- Each lab page now shows a "How this works" section from the registry, including an explicit "No AI model" note for the labs that run on fixed rules.

### Changed

- Turnstile is now optional and off by default (product decision, 2026-10-21): when no `TURNSTILE_SECRET` is configured the Worker skips the verification in every environment instead of failing closed; the check activates only when a secret is set. Bot protection rests on server-issued consent tokens, per-feature rate limiting, and CORS origin checks.
- Added `docs/GO-LIVE.md`: the production deployment runbook (secrets, deploy order, verification probes, rollback).

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
