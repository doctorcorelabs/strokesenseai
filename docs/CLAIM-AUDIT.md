# Claim Audit: Forbidden and Recommended Wording

This document lists words and phrases that must never appear in product copy for StrokeSense AI Lab, the safer wording to use instead, and the audit procedure that runs before every release. Product copy means everything a user or a member of the public can read: UI text, hub cards, page titles, README, Scope and Privacy pages, onboarding text, error messages, release notes, screenshots and captions, social posts, and presentation material.

The rule behind this list comes from `docs/INTENDED-USE.md`: regulators and users judge a product by its actual function and by the overall impression of its promotion, not by its disclaimers. A single overreaching sentence can collapse the education positioning of the whole product.

## Forbidden words and phrases

The following are forbidden in any copy that describes what the product or a feature does, finds, or concludes. They are also forbidden in negated marketing form when the negation still plants the claim (for example "not a screening tool, but it can flag possible stroke signs" is still a screening claim).

### Diagnosis and detection claims

- diagnose, diagnosis, diagnostic
- detect stroke, detection, detector, detects signs of stroke
- screen, screening, screened
- rule out, rules out stroke (and any equivalent wording in any language)
- identify stroke, identifies patients with stroke
- flag stroke, early warning for stroke

### Clinical authority claims

- clinical grade, clinically validated (unless a feature has actually reached the `validated` maturity level with documented validation, which none has at launch)
- accurate, accuracy (as a product claim), precise diagnosis
- medical device, medical tool, health check
- trusted by doctors, used by hospitals (unless independently true and documented)

### Result and reassurance claims

- normal result, your result is normal, normal baseline
- you are fine, you are safe, no stroke detected, low risk, high risk
- healthy, clear, passed, you passed the check
- central pattern, peripheral pattern, lesion located, stroke pattern
- NIHSS score (as an output for a user or a real person), risk percentage, prognosis
- eligible for thrombolysis, treatment window open for you

### Indonesian and other-language equivalents

The ban applies in every language the product or its promotion uses, including Indonesian equivalents and paraphrases of the above, such as "mendeteksi stroke", "menyaring", "menyingkirkan kemungkinan stroke", "hasil normal", "aman", "skor NIHSS Anda", and "terdeteksi asimetri" presented as a medical finding. Translating a forbidden claim does not make it allowed.

## Recommended safe phrasing

Use verbs and nouns that describe measurement, learning, and practice instead of medical conclusion:

- measure, measurement, geometric measurement
- explore, exploration, illustrate, illustration
- practice, training, simulation, fictional case
- educational estimate, practice estimate
- observe, observed, recorded in this session
- cannot analyze (with a specific reason), low confidence measurement
- this measurement cannot rule out stroke
- synthetic sample, built-in example, teaching example
- experimental, lab, concept demo

### Worked examples

| Instead of | Write |
|---|---|
| "Detects facial droop" | "Measures mouth corner position in this image" |
| "Your symmetry result is normal" | "No asymmetry above the measurement threshold was measured in this image. This cannot rule out stroke." |
| "AI face diagnosis" | "Face geometry explorer (experimental)" |
| "Screen yourself for stroke" | "Practice the FAST steps with guided camera exercises" |
| "Accurate speech analysis" | "Speech practice with word-by-word transcription confidence" |
| "Analysis failed, showing default result" | "Cannot analyze: no face found. This is not a symmetry result." |

## Claim map (summary)

- **Green (allowed):** education, geometric illustration on synthetic samples, explaining how a measurement works, fictional emergency response practice, summaries of synthetic documents.
- **Yellow (allowed only with the `lab` maturity label, explicit consent, and audited copy):** geometric or acoustic measurement on the user's own input, with no disease label attached.
- **Red (forbidden until clinical validation and regulatory clarity exist):** stroke detection, telling central from peripheral patterns, lesion localization, patient NIHSS scores, personal risk percentages, thrombolysis eligibility, and any reassuring statement that a result is normal.

## Audit procedure (runs before every release)

1. **Freeze the copy surface.** List every file and asset that contains public copy for this release: UI strings, README, Scope, Privacy, hub cards, screenshots, and planned announcement text.
2. **Automated scan.** Search the repository and the release assets for every forbidden term and equivalent in this document, in English and Indonesian. Any hit in product copy blocks the release until reworded or justified in writing as a non-claim use (for example the word "screen" inside "screen reader" is a technical term, not a claim; record the exception in the release report).
3. **Registry cross-check.** Compare the audited copy against `shared/registry.ts`. Every live feature must be described, no described feature may be missing or exaggerated, and every feature must carry its maturity label in copy wherever it is named.
4. **Impression test.** A reviewer who did not write the copy reads only the landing page and hub cards and answers: "What do you think this product can tell you about your own health?" If the answer implies diagnosis, screening, or reassurance, the copy fails regardless of the word scan.
5. **Sign-off and record.** The audit result (scan output, exceptions, impression test note, reviewer name, date) is stored with the release report in `eval/reports/`. No release ships without a recorded claim audit.

## When in doubt

If a sentence feels like it would make a good advertisement for a medical product, it is probably a forbidden claim for this one. Rewrite it to describe a measurement, an exercise, or a simulation, or delete it.

## Follow-up audit note: UX audit, 21 October 2026

A 15-analyst UX audit of the live Phase 1 build compared what the site promises (registry copy, hub cards, About panels, coach modules) against what each feature actually does. The audit found no forbidden diagnosis or detection claims, but it found a systematic promise-versus-reality gap: several features were described as camera-based or AI-driven while their implementations are manual, scripted, or rule-based. Under the impression test in the procedure above, copy like this fails even when no single forbidden word appears, because a visitor would reasonably believe a capability exists that does not.

### Gaps found

- **Motor group (4 features).** Registry summaries and coach modules describe camera pose tracking, hand landmark tracking, and full-body pose measurement. No Motor workspace uses a camera at all: the implementations are a pointer pad, tap counting, manual buttons plus a phone tilt sensor, and an on-screen dot test. The FAST Vision Check also does not contain the face and arm chain its registry entry describes.
- **Face labs.** The Face Symmetry Analyzer and Face Dynamics have no detection model. The user places 16 landmarks by hand, up to five times per Dynamics session, while the feature names and registry copy imply automatic camera analysis.
- **Clinical Reasoning group (5 features).** All five are deterministic scripted quizzes; the registry itself records "No AI model" for them, but hub taglines advertise an "AI examiner" and a "model-driven virtual patient".
- **Speech group (3 features).** Registry copy promises transcription through the Worker and voice answers; the implementations are typing-only with local rules, and the analyzer uses browser speech recognition without the consent flow the copy implies.
- **Discharge Lens AI.** The name and registry promise photo, PDF, and OCR input. The implementation is a paste-text box only, with no AI involved.
- **Digital FAST flagship.** The registry promises AI-measured signals in a 15 to 20 second session. The implementation shows a camera preview while the user fills in a manual checklist of roughly 35 to 45 interactions.
- **Global mode badge.** Hub cards and lab headers derived one mode label from a single site-wide configuration flag, so deterministic features were badged "Live AI" whenever the API was configured, contradicting the offline badge on their own pages.

A related structural finding: the registry `models` and `retention` fields, which describe each feature honestly (including "No AI model"), were never rendered anywhere in the UI, so the honest description existed in the codebase but was invisible to users.

### Status after the P0 fix package (21 October 2026)

- Registry copy, hub taglines, and coach modules for the features above have been rewritten to name the input and method that actually exist (simulation, pointer, tap counting, paste-text, scripted cases). Camera, pose tracking, OCR, and AI wording was removed where the capability does not exist.
- Mode labels are now computed per feature from the feature's own behavior (live AI, on-device, simulation) by a single shared helper, replacing the global configuration badge on hub cards, lab headers, and the Scope page list.
- The registry `models` field is now rendered on every lab page as a "How this works" section, so the honest per-feature description is visible where the feature is used.
- Open items deliberately left for later phases, recorded here so they are not lost: building real camera detection for the Motor and Face labs (or permanently reframing them as practice tools), renaming FAST Vision Check to match its content, and adding a photo or PDF path to the Discharge Lens or renaming it to match the paste-text implementation.
