// Pure mapping from the AI vision client's answer to the outcome the
// Movement Lab renders. Kept free of imports so it can be unit tested
// without the client, the Worker, or a browser.
//
// The mapping is deliberately conservative: an emergency answer wins
// over everything, a cannot-analyze answer is never dressed up as a
// result, and a normal answer keeps the model's own headline and
// observations word for word.

/** Structural shape of the answer analyzeWithAi resolves with. */
export interface AiResultLike {
  headline: string;
  observations: string[] | string;
  cannotAnalyze: boolean;
  reason?: string | null;
  emergency: boolean;
}

export type MappedAiOutcome =
  | { kind: 'ai'; headline: string; observations: string[] }
  | { kind: 'cannot'; reason: string }
  | { kind: 'emergency' };

export function mapAiResult(
  result: AiResultLike,
  fallbackHeadline: string,
  fallbackReason: string,
): MappedAiOutcome {
  if (result.emergency) {
    return { kind: 'emergency' };
  }
  if (result.cannotAnalyze) {
    const reason =
      typeof result.reason === 'string' && result.reason.trim().length > 0
        ? result.reason
        : fallbackReason;
    return { kind: 'cannot', reason };
  }
  const observations = Array.isArray(result.observations)
    ? result.observations.filter(
        (line): line is string => typeof line === 'string' && line.trim().length > 0,
      )
    : result.observations.trim().length > 0
      ? [result.observations]
      : [];
  const headline =
    typeof result.headline === 'string' && result.headline.trim().length > 0
      ? result.headline
      : fallbackHeadline;
  return { kind: 'ai', headline, observations };
}
