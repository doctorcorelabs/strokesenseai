// Interpretation helpers for the Digital FAST Multimodal Lab.
//
// Two paths, mirroring the product pattern in src/ai/client.ts and
// src/ai/offline.ts:
// - buildInterpretationContext packs the finished observation sheets into
//   a short text context for the AI coach (tool "fast", module
//   "digital-fast-multimodal"). Only derived numbers and labels are
//   included: no transcript text, no media, nothing identifying.
// - localInterpretation restates the same sheets in plain words without
//   any network call. It is the fallback text shown by the coach and is
//   honest about being a restatement, not a generated answer.
//
// Neither path produces a diagnosis, a combined score, or a reassurance.
// Every stage is described separately, and a stage that could not be
// analyzed is described as exactly that.

import { CLOSING_LINE, stageDef } from './session';
import type { SessionSummary, StageSummary } from './session';

/** Client context is sliced to 1000 characters; stay comfortably inside. */
const CONTEXT_LIMIT = 950;

function qualityText(summary: StageSummary): string {
  return summary.quality;
}

function statusText(summary: StageSummary): string {
  if (summary.status === 'cannot-analyze') return 'could not be analyzed';
  if (summary.status === 'observation-noted') return 'an observation was noted';
  return 'no listed sign was observed';
}

function stageLine(summary: StageSummary): string {
  const def = stageDef(summary.stageId);
  const parts = [
    `${def.title}: data quality ${qualityText(summary)}`,
    `${summary.answeredCount} of ${summary.itemCount} checks answered`,
    statusText(summary),
  ];
  if (summary.transcriptMatch) {
    parts.push(
      `sentence words matched ${summary.transcriptMatch.matchedCount} of ${summary.transcriptMatch.totalCount}`,
    );
  }
  return parts.join(', ') + '.';
}

/** Compact per stage context for the AI coach, under the client limit. */
export function buildInterpretationContext(summary: SessionSummary): string {
  const lines = summary.stages.map(stageLine);
  const weights = summary.weights
    .map((entry) => `${stageDef(entry.stageId).letter} ${Math.round(entry.weight * 100)}%`)
    .join(', ');
  const text =
    `Digital FAST Multimodal Lab session (educational practice). ` +
    `${lines.join(' ')} ` +
    `Data contribution by modality, from data quality and completeness only: ${weights}. ` +
    'There is no combined score. A stage that could not be analyzed stays unanalyzed.';
  return text.length > CONTEXT_LIMIT ? text.slice(0, CONTEXT_LIMIT) : text;
}

function stageParagraph(summary: StageSummary): string {
  const def = stageDef(summary.stageId);
  if (summary.status === 'cannot-analyze') {
    return (
      `${def.title}: this stage could not be analyzed (data quality: ${summary.quality}). ` +
      'No result was invented for it, and the other stages do not fill in for it.'
    );
  }
  if (summary.status === 'observation-noted') {
    return (
      `${def.title}: an observation was recorded during this stage ` +
      `(${summary.observedCount} observed, ${summary.unsureCount} not sure). ` +
      'An observation in a sudden change needs urgent human assessment, not a repeated session.'
    );
  }
  let text =
    `${def.title}: none of the listed signs were observed during this short practice task ` +
    `(data quality: ${summary.quality}). That describes these few seconds of practice only.`;
  if (summary.transcriptMatch) {
    text +=
      ` The repeated sentence matched ${summary.transcriptMatch.matchedCount} of ` +
      `${summary.transcriptMatch.totalCount} target words, a practice clarity measure, not a score.`;
  }
  return text;
}

/**
 * Deterministic local interpretation of a finished session. Exported for
 * tests and used as the coach fallback text, so what the person reads
 * offline is exactly what was verified here.
 */
export function localInterpretation(summary: SessionSummary): string {
  const paragraphs = [
    'Local summary of the Digital FAST Multimodal session. This text restates the observation sheets in words; it is not a generated answer and it adds no new findings.',
    ...summary.stages.map(stageParagraph),
  ];
  const weights = summary.weights
    .map(
      (entry) =>
        `${stageDef(entry.stageId).title.split(':')[0]} ${Math.round(entry.weight * 100)}%`,
    )
    .join(', ');
  paragraphs.push(
    `Data contribution by modality: ${weights}. These weights come only from data quality and completeness. ` +
      'They are shown so the fusion stays inspectable; they are not a risk estimate and are never combined into a verdict.',
  );
  paragraphs.push(CLOSING_LINE);
  return paragraphs.join('\n\n');
}
