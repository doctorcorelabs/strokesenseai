# Release Benchmark Reports

Every release of StrokeSense AI Lab produces exactly one benchmark report in this directory, generated from the evaluation harness in `eval/`. Reports are permanent records: they are never edited after the release ships, and corrections are issued as a new report that references the old one.

File naming: `report-<version>-<YYYY-MM-DD>.md`, for example `report-0.2.0-2026-11-15.md`.

## The standing disclaimer

Every report begins with this statement, verbatim in meaning:

> All performance figures in this report were measured on synthetic datasets with known ground truth. They describe behavior on synthetic data only and are not clinical performance.

A report without this statement is invalid.

## Required report format

### 1. Release identity

- Product version and date.
- Pinned model identifiers and versions for every AI-backed feature.
- Prompt version identifiers and threshold registry references for every threshold used.
- Dataset versions used (golden and red-team), with links to their datasheets.
- Feature registry snapshot: feature ids, maturity labels, and modes shipped in this release.

### 2. Metrics per feature

For each feature, report the metrics defined in `eval/golden/README.md`, including as applicable:

- Screening-style sensitivity and specificity per magnitude, reported as measured.
- Geometric or acoustic measurement error (MAE).
- Abstention (`cannot-analyze`) rate, overall.
- Emergency guard results: recall on the core set, recall on the extended paraphrase set, and a list of every miss with its disposition.
- Document extraction: fact precision and recall, fabricated fact count, correct `uncertain` labeling rate.
- LLM behavior: correct behavior class rate, forbidden content count, citation validity rate.

### 3. Subgroup breakdown

Every headline metric is also reported per subgroup declared in the dataset datasheets: skin tone range (Fitzpatrick I to VI), age group, presented gender, device class, language (English, Indonesian, mixed), and accent group where relevant. Abstention rate differences between subgroups are stated explicitly, with the gate from `eval/README.md` (below 5 percentage points, or a documented mitigation).

### 4. Calibration

- Expected calibration error (ECE), Brier score, and a reliability diagram for every confidence value the product displays.
- Confirmation that no displayed confidence is a constant.
- Coverage-risk summary for the abstention policy: how accuracy on answered cases trades against the `cannot-analyze` rate.

### 5. Red-team results

- Pass or fail per category in `eval/redteam/README.md`, with counts.
- Every failure found, its severity, and its disposition: fixed with regression test added (link), accepted with written justification (rare, never for safety categories), or release blocked.

### 6. Delta versus baseline

- A table comparing every metric in sections 2 to 4 against the previous release report.
- Any regression in a safety metric blocks the release and is recorded here as the reason.
- Non-safety regressions require a written justification in this section.

### 7. Human evaluation

- Clinician panel review summary for any feature whose maturity label changed.
- Lay-user misinterpretation test result (gate: below 5 percent believing they received a diagnosis), with sample size and method.

### 8. Claim audit record

- Date of the claim audit for this release, reviewer name, scan result, recorded exceptions, and the impression test note, following `docs/CLAIM-AUDIT.md`.

### 9. Decision

One of:

- **Ship**: all gates passed.
- **Ship in synthetic-only mode**: named features restricted to synthetic input, with the reason.
- **Blocked**: the failing gate, the evidence, and what must change.

The decision is signed by name. A release without a report in this directory, or with a report whose decision is missing, does not exist as far as this project is concerned.
