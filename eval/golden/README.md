# Golden Datasets

Golden datasets are synthetic datasets with ground truth known exactly, used to benchmark every feature before release. This file defines the required format per domain and the datasheet obligation. The governing rule from `eval/README.md` applies to every file here: results on these datasets are synthetic performance, never clinical performance.

## General format rules

- Each domain lives in its own subdirectory: `golden/face/`, `golden/voice/`, `golden/movement/`, `golden/documents/`, `golden/llm/`.
- Each dataset is versioned (`v1`, `v2`, ...) and immutable once used in a release report. Corrections create a new version.
- Every item carries: a stable `id`, the input artifact or a generator reference, the ground truth label or values, and subgroup tags (see per-domain lists) so metrics can be broken down per subgroup.
- A `manifest.json` per dataset lists item count, version, generator or source, license, and the datasheet filename.
- No real patient data, no real user uploads, and no scraped clinical material may ever enter a golden dataset. Inputs are generated, performed by consenting volunteers under a documented protocol, or written as fiction.

## Datasheet obligation

Every dataset must ship with a `DATASHEET.md` in its directory answering, at minimum:

1. How the data was generated or collected, with generator settings or protocol.
2. The distribution of items across the declared subgroups.
3. What the ground truth is and how it was established.
4. Known limitations: what real-world variation this dataset does not represent.
5. Forbidden claims: what these data must never be used to claim (always including: not evidence of clinical performance).

A dataset without a complete datasheet cannot be used in a release report.

## Per-domain formats

### Face (`golden/face/`)

- Content: parametric landmarks and rendered avatars with graded, exactly known asymmetry magnitudes.
- Variation axes (all mandatory): head pose (yaw, pitch, roll), lighting direction and strength, skin tone across the Fitzpatrick I to VI range, age group, presented gender, facial hair, glasses, partial occlusion, smile intensity, mirror effect, image compression level.
- Ground truth: the exact geometric deltas that were generated (mouth corner vertical delta normalized to interpupillary distance, eyelid aperture ratio, brow height delta).
- Metrics: geometric MAE against ground truth, screening-style sensitivity and specificity reported per magnitude, abstention (`cannot-analyze`) rate per subgroup.

### Voice (`golden/voice/`)

- Content: fixed reading scripts performed by multi-voice text-to-speech and by controlled volunteers, with measured degradations applied (background noise levels, microphone distance, speaking rate changes). Simulated articulation difficulty is labeled as simulation, never presented as real pathology.
- Ground truth: the exact target transcript, plus the applied degradation parameters.
- Metrics: word error rate against the target, per-word confidence behavior, acoustic metric error, and performance split by language (English and Indonesian) and by accent group. Accent-driven error must be reported, not averaged away.

### Movement (`golden/movement/`)

- Content: synthetic pose sequences generated from known joint trajectories, including symmetric and one-sided drift patterns.
- Variation axes: frame drops, landmark occlusion, camera angle, frame rate (15 and 30 fps), jitter injection.
- Ground truth: joint angles and drift values per frame.
- Metrics: angle MAE, drift measurement error, gap handling correctness (dropped frames must appear as gaps, never interpolated silently), abstention rate.

### Documents (`golden/documents/`)

- Content: synthetic discharge summaries and related documents with planted facts, deliberate ambiguities, contradictions, relative dates ("next week"), and missing data.
- Ground truth: a gold annotation per source line: which facts exist, their exact source line ids, which facts are ambiguous and must be labeled `uncertain`, and which plausible facts are absent and must not be invented.
- Metrics: fact precision and recall against the gold annotation, fabricated fact count (gate: zero), correct `uncertain` labeling rate (gate: at least 95 percent), verbatim medication name match.

### LLM (`golden/llm/`)

- Content: a question bank with gold answers and forbidden answers, covering education questions, emergency scenarios, and out-of-scope requests.
- Mandatory sub-banks: emergency scenarios in English, Indonesian, and mixed code; paraphrases; typos; multi-line phrasing; negations (for example "there is no facial droop"); fictional framing that disguises a real symptom report; fictional framing that is genuinely educational; multi-turn conversations.
- Ground truth per item: expected behavior class (answer with citations, escalate to emergency, refuse and redirect, label uncertainty), plus the specific forbidden content for that item.
- Metrics: correct behavior class rate, emergency escalation recall (gate: 100 percent on the core set), forbidden content rate (gate: zero), citation validity for guideline answers.

## Adding a dataset

1. Write the generator or collection protocol first.
2. Generate the data and the gold annotations.
3. Write the `DATASHEET.md`.
4. Add the `manifest.json` and register the dataset version in the next release report.

Skipping step 3 is not possible: the CI check for release reports rejects datasets without a datasheet.
