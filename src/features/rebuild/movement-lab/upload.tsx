// Upload path for the Movement Lab: the default way to use both
// modes. The person picks a photo or a video they already have. From
// a video the browser pulls a few frames out locally; a photo is
// prepared as a single image. Only those frames or that image are
// sent to the AI service through the Worker's vision endpoint when
// the person presses "Analyze with AI". The AI describes what it can
// see; it does not measure angles or count taps, and the framing
// line on the result sheet says exactly that. A result that came
// from one still photo carries a photo note saying what a single
// moment cannot show: change over time, or a tapping rhythm.
//
// The live camera and the labelled demo stay available as the second
// and third sources in each mode. Nothing about them lives here.

import { useState } from 'react';
import { UploadPanel } from '../../../shell';
import {
  extractVideoFrames,
  imageFileToDataUrl,
  type ExtractedFrame,
} from '../../../ml/analyze';
import { analyzeWithAi } from '../../../ai/visionClient';
import { mapAiResult, photoNoteForTask, uploadFileKind, type UploadFileKind } from './aiOutcome';

export const AI_PRIVACY_LINE =
  'Frames from your file are sent to the AI service for analysis. Nothing is stored by this site.';

export const AI_FRAMING_LINE =
  'AI analysis of your upload. The AI describes what it can see across the frames; it does not measure angles, and it can misread images.';

export type UploadOutcome =
  | { kind: 'ai'; headline: string; observations: string[]; photoNote?: string }
  | { kind: 'cannot'; headline: string; reason: string; suggestion: string }
  | { kind: 'emergency' };

const CANNOT_HEADLINE = 'The AI could not analyze this upload.';
const CANNOT_SUGGESTION =
  'Try a clearer photo, or a shorter and clearer video, with the movement filling the frame and the light in front of you, then analyze again.';
const FALLBACK_REASON = 'The AI could not see enough in the upload to describe the movement.';

type Phase = 'pick' | 'extracting' | 'ready' | 'analyzing' | 'failed';

export default function MovementUploadAnalyze({
  task,
  uploadLabel,
  hint,
  fallbackHeadline,
  onOutcome,
}: {
  task: 'arm-video' | 'hand-video';
  uploadLabel: string;
  hint: string;
  fallbackHeadline: string;
  onOutcome: (outcome: UploadOutcome) => void;
}) {
  const [phase, setPhase] = useState<Phase>('pick');
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [fileKind, setFileKind] = useState<UploadFileKind>('video');
  const [problem, setProblem] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setProblem(null);
    setFrames([]);
    const kind = uploadFileKind(file);
    setFileKind(kind);
    setPhase('extracting');
    if (kind === 'photo') {
      // One still photo is the whole input: it is prepared as a
      // single image and sent to the same stage task, which now
      // judges the position it can see in that one moment.
      try {
        const dataUrl = await imageFileToDataUrl(file);
        setFrames([{ dataUrl, tMs: 0 }]);
        setPhase('ready');
      } catch {
        setProblem('The photo could not be read. Please choose a different photo file.');
        setPhase('pick');
      }
      return;
    }
    try {
      const extracted = await extractVideoFrames(file, 6);
      if (extracted.length === 0) {
        setProblem(
          'No frames could be taken from that video. Please choose a different video file.',
        );
        setPhase('pick');
        return;
      }
      setFrames(extracted);
      setPhase('ready');
    } catch (error) {
      setProblem(
        error instanceof Error
          ? `The video could not be read: ${error.message}`
          : 'The video could not be read. Please choose a different video file.',
      );
      setPhase('pick');
    }
  }

  async function runAnalysis(): Promise<void> {
    setProblem(null);
    setPhase('analyzing');
    try {
      const result = await analyzeWithAi({
        task,
        images: frames.map((frame) => frame.dataUrl),
      });
      const mapped = mapAiResult(result, fallbackHeadline, FALLBACK_REASON);
      if (mapped.kind === 'emergency') {
        onOutcome({ kind: 'emergency' });
      } else if (mapped.kind === 'cannot') {
        onOutcome({
          kind: 'cannot',
          headline: CANNOT_HEADLINE,
          reason: mapped.reason,
          suggestion: CANNOT_SUGGESTION,
        });
      } else {
        onOutcome({
          kind: 'ai',
          headline: mapped.headline,
          observations: mapped.observations,
          ...(fileKind === 'photo' ? { photoNote: photoNoteForTask(task) } : {}),
        });
      }
      setPhase('ready');
    } catch {
      // Network, consent, or service failure: keep the frames so the
      // person can retry without picking the file again.
      setPhase('failed');
    }
  }

  return (
    <div>
      <UploadPanel
        accept="both"
        label={uploadLabel}
        hint={hint}
        privacyLine={AI_PRIVACY_LINE}
        disabled={phase === 'extracting' || phase === 'analyzing'}
        onFile={(file) => {
          void handleFile(file);
        }}
        onClear={() => {
          setFrames([]);
          setFileKind('video');
          setProblem(null);
          setPhase('pick');
        }}
      />

      {problem !== null ? (
        <p role="alert">
          <strong>{problem}</strong>
        </p>
      ) : null}

      {phase === 'extracting' ? (
        <p className="muted" aria-live="polite">
          {fileKind === 'photo' ? 'Preparing your photo...' : 'Taking frames from your video...'}
        </p>
      ) : null}

      {frames.length > 0 ? (
        <>
          <div
            className="mlab-frames"
            aria-label={fileKind === 'photo' ? 'Your uploaded photo' : 'Frames taken from your video'}
          >
            {frames.map((frame) => (
              <figure key={frame.tMs} className="mlab-frame">
                <img src={frame.dataUrl} alt="" />
                <figcaption>
                  {fileKind === 'photo' ? 'Photo' : `${(frame.tMs / 1000).toFixed(1)}s`}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="muted">
            {fileKind === 'photo'
              ? 'This photo is what the AI will look at. Nothing has been sent yet.'
              : `These ${frames.length} frames are what the AI will look at. Nothing has been sent yet.`}
          </p>
        </>
      ) : null}

      {phase === 'failed' ? (
        <div role="alert">
          <p>
            <strong>The AI analysis did not go through.</strong>
          </p>
          <p className="muted">
            The frames never reached the AI service, or the service did not answer. Your
            file itself was not stored. Check your connection and try again.
          </p>
          <div className="mlab-actions">
            <button type="button" className="btn btn-primary" onClick={() => void runAnalysis()}>
              Try again
            </button>
          </div>
        </div>
      ) : frames.length > 0 ? (
        <div className="mlab-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void runAnalysis()}
            disabled={phase === 'analyzing' || phase === 'extracting'}
          >
            {phase === 'analyzing' ? 'Analyzing with AI...' : 'Analyze with AI'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
