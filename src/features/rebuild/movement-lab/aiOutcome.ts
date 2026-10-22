// Pure mapping from the AI vision client's answer to the outcome the
// Movement Lab renders. Kept free of imports so it can be unit tested
// without the client, the Worker, or a browser.
//
// The mapping is deliberately conservative: an emergency answer wins
// over everything, a cannot-analyze answer is never dressed up as a
// result, and a normal answer keeps the model's own headline and
// observations word for word.

/** Which kind of file an upload is, from its MIME type alone. */
export type UploadFileKind = 'photo' | 'video';

/**
 * Split an uploaded file into the two kinds the upload path handles:
 * a video is sampled into frames over time, anything else the panel
 * accepted is one still photo sent as a single image. The same
 * isVideo split the FAST stages use.
 */
export function uploadFileKind(file: { type: string }): UploadFileKind {
  return file.type.startsWith('video/') ? 'video' : 'photo';
}

/**
 * The honesty note that stands on an AI result that came from one
 * still photo in the Movement Lab. A photo has no time in it: the
 * arm note says position change over time could not be judged, the
 * hand note says the tapping rhythm could not be judged. Only the
 * position visible in that single moment was described.
 */
export function photoNoteForTask(task: 'arm-video' | 'hand-video'): string {
  return task === 'arm-video'
    ? 'This was one still photo, so how the arm position changed or held over time could not be judged. Only the position visible in this single moment was described.'
    : 'This was one still photo, so the tapping rhythm could not be judged. Only the hand position visible in this single moment was described.';
}

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
