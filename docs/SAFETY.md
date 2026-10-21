# Safety Principles

StrokeSense AI Lab is an experimental learning lab for stroke education. It does not diagnose, screen for, or rule out stroke (see `docs/INTENDED-USE.md`). This document states the safety rules every feature must follow. They are not guidelines that can be traded against deadlines: a feature that cannot meet these rules does not ship, or ships in synthetic-only mode.

These rules exist because of three concrete failures in the predecessor project, which this project treats as non-negotiable lessons: a silent fallback that replaced a failed detector with normal-looking synthetic data, clinical thresholds hard-coded without validation, and documentation that denied a feature that was actually live.

## 1. Cannot analyze is a first-class state

Every feature has exactly four explicit output states:

- `result`: a measurement or exercise outcome, with its uncertainty attached.
- `cannot-analyze`: the input could not be analyzed, with a specific reason code (for example: no face found, multiple faces, insufficient light, occlusion, noisy audio, low pose quality, unsupported language). The user sees the reason in plain language and guidance on how to fix the input.
- `emergency`: the input suggests possible acute symptoms; the product stops and directs the user to call 119.
- `offline`: live AI is unavailable and only the local prewritten guide is shown, labeled as such.

A technical failure must never be converted into a plausible-looking result. Substituting synthetic normal data, a score of 0, or a score of 100 for a failed analysis is a critical bug, not a fallback. There is no code path in which a failed detector produces a measurement.

## 2. Uncertainty is shown next to every result

Every output displays, beside the result itself and not in a footer: the input quality (good, fair, poor), a calibrated confidence value or its verbal label (low, moderate, high), the model name and version, and the feature maturity label (`concept`, `lab`, `validated`).

Confidence must be computed from input quality and model agreement and then calibrated (see `eval/README.md`). A constant, hard-coded confidence value is forbidden.

## 3. No score may resemble a diagnosis

Forbidden outputs include: binary clinical labels such as abnormal or normal, disease pattern classification (for example telling a central stroke pattern from a peripheral palsy pattern), lesion localization, a NIHSS score for a person, a personal stroke risk probability or percentage, and any judgment of treatment eligibility such as a thrombolysis window for the user.

Allowed outputs are neutral geometric or acoustic descriptors with clear units, always accompanied by a bounding sentence. For example: "Left mouth corner sits 3.2 mm-equivalent lower in this image. This is a geometric measurement, not a medical finding."

Category rules:

- Face vision: geometric description only. Left-right uncertainty from camera mirroring must be stated. Forehead sparing is a movement assessment and is never inferred from a still photo.
- Voice and speech: acoustic metrics only, relative to the same reading baseline. Accent and dialect variation must be named as a known source of error.
- Movement and pose: coordinate and trajectory visualization only. Missing landmarks are shown as gaps in the data, never as zero values and never as a finding.
- Chat and coaching: server-locked prompts, sources from a server allowlist, sanitized output, and a filter for dangerous patterns (drug dosages, non-119 emergency numbers, diagnostic claims).
- Documents: extraction only from synthetic documents or from text the user pastes with consent, with every fact tied to its source line and ambiguous or missing facts labeled `uncertain`.
- Simulations and risk scenarios: fictional, labeled cases only, scored by a fixed educational rubric.

## 4. Emergency comes first, always

- A persistent emergency banner appears on every lab page, and a stop-and-call control exists inside every analysis session (camera, microphone, chat).
- Detection of possible acute symptoms runs before consent, before rate limiting, and before any model call. The emergency response is static text; it does not depend on an AI model, on billing, or on network quality.
- The static guidance is simple: possible stroke signs are a medical emergency, call 119 in Indonesia now, do not wait for a chat reply even if symptoms stop, note the time the person was last known well, and follow the dispatcher.
- Harm is asymmetric: a false negative is far more dangerous than a false positive, so every escalation threshold is biased toward telling the user to call.
- No analysis result may delay, soften, or replace the emergency message. A reassuring-looking measurement is never a reason to wait.

## 5. Deterministic core, AI only explains

Measurements, practice scoring rubrics, and curated extraction are decided by deterministic code that can be unit tested. The language model explains results, role-plays inside simulations, and judges free-text answers against a fixed rubric. It never changes a number, a label, or a classification produced by the code. Anything the client sends is treated as untrusted input.

## 6. Quality gates before inference

Input below the quality threshold is not analyzed at all; it goes straight to `cannot-analyze`. Thresholds come from evaluation reports, not from guesses: every threshold in code must reference an evaluation report identifier in the threshold registry, and a threshold without a reference fails review.

## 7. Kill switch per feature

Every feature can be disabled from Worker configuration (a KV flag) without redeploying the frontend. The kill switch must exist before go-live and is tested regularly. Disabling a feature shows an honest unavailable state, never a substitute feature pretending to be it.

## 8. Honest modes and labels

Every tool labels its actual mode: Live AI, Offline Guide, Synthetic Demo, or Simulation. Offline and prewritten content is never presented as a generated answer. Supporting sources are presented as supporting resources, never as proof that each AI statement was verified.

## 9. How safety is enforced

- The feature registry (`shared/registry.ts`) is the single source of truth; CI fails if a live route is missing from it or if documentation disagrees with it.
- The evaluation harness (see `eval/README.md`) gates every release; any regression in a safety metric blocks the release.
- The claim audit (see `docs/CLAIM-AUDIT.md`) runs before every release.
- A clinician panel reviews samples of feature output before any maturity label is raised, and lay-user misinterpretation testing must stay below 5 percent: after using a tool, users must not believe they received a diagnosis.

## Known limitations (Phase 0)

- The emergency keyword guard is deliberately conservative: a negated symptom mention (for example "there is no facial droop") also escalates to the emergency reminder. Over-escalation is the accepted direction of error for a keyword guard; it is not a symptom classifier and makes no clinical judgement either way.
- Guard recall is measured only on the synthetic paraphrase bank in `eval/redteam/guard-paraphrases.json` (25 of 25 symptom items at Phase 0). That number describes the test bank, not real-world sensitivity.
- The emergency guard exists twice by design: once in the Worker (the authoritative check before any model call) and once in the client (so the reminder works offline and before any network request). Two implementations of the same pattern set can drift apart, so guard parity is regression-tested: the same input set is fed to both implementations and any input they classify differently counts as a divergence that must be fixed or explicitly accepted before release. Parity is therefore verified per release instead of assumed; the measured figures belong to each release's evaluation report, not to this document.
