# Privacy and DPIA Outline (UU PDP)

This document is the working outline for the Data Protection Impact Assessment (DPIA) of StrokeSense AI Lab under Indonesian Law No. 27 of 2022 on Personal Data Protection (UU PDP). Health data and biometric data are specific (sensitive) personal data under UU PDP, and processing them at high risk requires a DPIA. This outline must be completed, reviewed, and signed off before any feature that accepts real user biometric input is enabled for the public. Until then, the product runs on synthetic samples and built-in examples only.

Status: OUTLINE. Sections marked TODO must be completed before public biometric activation.

## 1. Processing overview

- Product: StrokeSense AI Lab, an experimental education and research web application. See `docs/INTENDED-USE.md`.
- Data controller: TODO (legal name of the operating entity or individual, contact address, and the named person responsible for data protection decisions).
- Data protection contact: TODO (public email address for data subject requests).
- Processing locations: user device (browser), Cloudflare Workers (stateless proxy), OpenRouter and its model providers (AI inference), Netlify (static hosting). No application database stores user content.
- Design baseline: zero retention. Inference happens on the client where possible; the Worker is stateless; server logs contain only reason codes and aggregated quality metrics, never content.

## 2. Data categories by feature

| Feature area | Data involved | Category under UU PDP | Where it is processed | What leaves the device |
|---|---|---|---|---|
| Face features (symmetry, dynamics) | Camera frames, face landmarks, derived geometric metrics | Biometric data (specific) | Browser only, by default | Nothing by default. Only numeric metrics, and only with separate consent when the user asks for an AI explanation |
| Voice and speech features | Microphone audio, transcripts, acoustic metrics | Biometric data (specific) when voice is used to characterize a person; otherwise sensitive-adjacent audio | Browser for acoustic features; Worker plus provider for transcription | Audio clip for transcription, only after explicit consent that names the processing chain |
| Movement features | Pose landmarks, joint trajectories | Health-related measurement data | Browser only | Nothing by default. Aggregated metrics only, with consent |
| Document features | Photos or text of discharge documents, extracted facts | Health data (specific) | Browser first (local OCR is the default path); Worker plus vision provider only as explicit opt-in | OCR text by line, or the document image on the explicit vision path only, after per-document consent and local redaction |
| Text features (chat, history extractor, translator) | Free text typed or pasted by the user, which may contain health information | Health data (specific) if it describes a person | Worker plus provider | The text itself, after a client-side PII check and with consent; never stored |
| Session and audit data | Hashed session identifier, feature id, token counts, reason codes, redaction counts | Pseudonymous operational data, not anonymous | Cloudflare (KV, D1) | Not applicable; contains no content, no raw IP (salted hash only), no images, audio, transcripts, or coordinates |

Explicitly never collected: user accounts, names, medical record numbers, patient histories in a database, raw camera frames on the server, and analytics payloads from sensitive lab pages.

## 3. Lawful basis and consent

- Basis for biometric and health data processing: explicit consent of the data subject, collected per modality and per purpose, never bundled and never pre-checked:
  1. Processing on the device (camera or microphone activation).
  2. Sending derived metrics or content (audio, document text or image) to the AI provider chain for an explanation or transcription.
  3. Retention for research, which is OFF by default and is not offered in the initial release.
- Consent is enforced on the server with signed, scoped, expiring consent tokens; a consent for chat does not authorize sending an image.
- Consent text states, in plain language, that face and voice data are specific personal data under UU PDP, what exactly is sent, to whom, and that the user may withdraw at any time.
- Withdrawal: a working delete-session control erases session history and consent records immediately. Camera and microphone tracks are released in full when a session ends.
- Third-party data: the interface forbids uploading photos, recordings, or documents of other people, patients, or children without the right to do so, and states this at the point of upload.

## 4. Retention: zero by design

- Server retention of user content: none. Requests are processed in memory and discarded after the response.
- Session history for chat is held server-side only to run the conversation, capped at the last 6 turns, encrypted at rest in KV with a 24 hour TTL, and deleted on consent withdrawal.
- Audit logs: reason codes and aggregate metrics only, retained for TODO (define period, recommended maximum 90 days), with no content fields.
- Backups: none contain user content because no store contains user content. TODO: confirm hosting and provider log settings (Cloudflare observability, Netlify logs, OpenRouter account settings) and record the verification date here.
- Provider configuration: `data_collection: "deny"` and no silent provider fallback, so a request never lands on a provider with weaker retention terms without a code change and a DPIA review.

## 5. Data subject rights and how the product honors them

Under UU PDP, data subjects have rights including information, access, correction, deletion, withdrawal of consent, objection, and complaint to the authority. Because this product stores almost nothing, most rights are honored by architecture rather than by procedure:

- Information: the Privacy page and per-feature notices describe processing before it happens.
- Access and correction: there is no profile or stored record to access or correct; session content is visible in the user's own session.
- Deletion and withdrawal: the delete-session control and consent withdrawal endpoint act immediately.
- Requests that cannot be self-served: TODO (procedure and response time for written requests to the data protection contact, within the statutory period).

## 6. Security measures (summary)

- API keys exist only as Worker secrets; the browser never holds a provider key.
- Turnstile verification, per-feature rate limiting, strict schema validation, and PII redaction in the Worker run before any provider call.
- EXIF metadata is stripped from images on the client before any upload.
- Responses use `Cache-Control: no-store`; error messages never contain provider payloads or user content.
- E2E tests capture network traffic and must prove that no biometric payload leaves the browser except on the consented paths. See `eval/README.md`.

## 7. Breach notification procedure (3 x 24 hours)

UU PDP requires notification to the authority and to affected data subjects no later than 3 x 24 hours after the controller becomes aware of a personal data breach. Procedure:

1. **Detect and declare (hour 0).** Any team member who suspects a breach (exposed secret, misdirected logs, provider incident, unauthorized access) notifies the named data protection contact immediately and records the time awareness began. That time starts the 3 x 24 hour clock.
2. **Contain (within hours).** Rotate affected secrets, disable the affected feature with its kill switch, and preserve relevant logs for investigation without copying user content.
3. **Assess.** Determine what data categories, how many subjects, and what likely consequences. Because of zero retention, the expected scope is operational data; document the reasoning either way.
4. **Notify the authority** in writing within 3 x 24 hours of awareness, including: the nature of the breach, categories and approximate number of data subjects, likely consequences, and measures taken. TODO: name the current receiving channel of the Indonesian data protection authority and keep it updated.
5. **Notify affected data subjects** within the same window when the breach may cause significant harm, in plain language, with what happened, what data, what we did, and what they can do.
6. **Record and review.** Log the incident, timeline, notifications, and corrective actions in an incident register; review the DPIA if the incident reveals a design gap.

## 8. Checklist that must be completed before public biometric activation

Public activation of real face or voice input is blocked until every item below is done and recorded with a date and a name:

- [ ] This DPIA completed (all TODO items resolved) and signed off by the controller.
- [ ] Regulatory consultation on medical device classification (Kemenkes) documented. See `PLANNING.md` section 9.5.
- [ ] Consent texts for each modality reviewed for UU PDP compliance and plain-language readability, in English with the bilingual safety wording approved by the product owner.
- [ ] Data processing terms reviewed for every provider in the chain (Cloudflare, OpenRouter and the selected model providers, Netlify), including retention, residency, and sub-processors.
- [ ] Provider log and observability settings audited and recorded in section 4.
- [ ] Network-traffic e2e evidence that no biometric payload leaves the browser on non-consented paths, attached to the release report.
- [ ] Breach notification drill performed once end to end, with the authority channel confirmed.
- [ ] Data protection contact published on the Privacy page and monitored.
- [ ] Claim audit passed for all biometric feature copy (see `docs/CLAIM-AUDIT.md`).
- [ ] Evaluation report for the feature published, including subgroup performance and abstention rates (see `eval/reports/README.md`).

If any item is open, the feature ships in synthetic-only mode.
