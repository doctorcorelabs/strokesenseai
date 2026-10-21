# Intended Use Statement

This document is the single authoritative statement of what StrokeSense AI Lab is for. It governs the product, the code, the user interface, the README, the Scope page, release notes, and all promotional or social copy. If any text, label, screenshot, or feature behavior contradicts this document, that contradiction is a bug and must be fixed before release.

## The statement

> "An experimental learning lab that illustrates how AI techniques measure signals related to stroke education. It does not diagnose, screen for, or rule out stroke."

Every contributor, reviewer, and release must be able to test any new copy or feature against this one sentence. If a feature or a sentence cannot coexist with it, the feature or the sentence does not ship.

## Who this product is for

StrokeSense AI Lab is built for learners and professionals who study stroke and clinical AI in a training context:

1. Preclinical medical students, learning to recognize stroke signs through interactive simulation instead of text memorization.
2. Clinical clerks (koas), practicing golden hour decisions, handover communication, and structured reading of discharge documents.
3. Junior doctors and general practitioners, building clinical AI literacy by trying and critiquing multimodal AI tools for neurology.
4. Nurses and other health workers, practicing FAST recognition, escalation to emergency number 119, and structured handover communication.
5. Caregivers and AI-curious members of the public, using safe demos built on synthetic samples.

## Who this product is NOT for

- Anyone who is, or may be, experiencing an acute medical event right now, or their family members during a real event. For them, the only call to action in this product is to call the Indonesian national medical emergency number 119 immediately.
- Patients seeking a diagnosis, a risk estimate, a prognosis, or a treatment decision of any kind.
- Clinicians seeking decision support for a real patient. No feature in this product accepts real patient data for assessment, and none of its outputs may be used in the care of an actual person.
- Anyone seeking screening. This product does not screen for stroke, in any mode, at any maturity level currently shipped.

## Binding rules derived from the statement

1. **Education and research only.** Every feature is an illustration, a measurement exercise, a practice tool, or a simulation with fictional cases. Nothing here is a medical service.
2. **No diagnostic output.** No feature may output a diagnosis, a disease classification, a lesion localization, a patient NIHSS score, a personal risk percentage, or a treatment eligibility judgment. See `docs/CLAIM-AUDIT.md` for the forbidden vocabulary and `PLANNING.md` section 11 for the list of features that are deliberately not built.
3. **Synthetic first.** The initial release works on synthetic samples and built-in examples. Enabling uploads of real user biometric data for the public is a regulatory decision, not a technical one, and requires the checklist in `docs/PRIVACY-DPIA-OUTLINE.md` to be completed first.
4. **Failure is shown as failure.** When analysis cannot be performed, the product says so. It never substitutes a normal-looking result. See `docs/SAFETY.md`.
5. **Emergency comes first.** Detection of possible acute symptoms happens before consent, before rate limiting, and before any AI model call, and always points to 119.
6. **Documentation must match the shipped product.** The feature registry is the single source of truth. A live feature that is not described accurately in the README and the Scope page is a release-blocking bug, and so is documentation that denies or omits a live feature.
7. **Copy conflicts are bugs.** Any wording in the UI, README, marketing material, commit messages intended for the public, or store or social posts that conflicts with this document must be treated with the same severity as a functional defect: file it, fix it, and re-run the claim audit before release.

## Maturity and this statement

Features carry a maturity label: `concept`, `lab`, or `validated`. No feature is `validated` at launch, and a feature may only become `validated` after prospective clinical validation, ethics approval, and regulatory clarity. The maturity label never relaxes this intended use statement; it only describes how far evaluation has progressed.
