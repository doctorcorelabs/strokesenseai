// FAST Live Check: the flagship rebuilt lab.
//
// One guided session, three measured stages in FAST order (Face, Arm,
// Speech), inside the shared LabShell Example, Try, Understand frame.
// The example step shows the finished product of each stage with
// teaching example data, including an excerpt of the observation
// sheet, so a person knows exactly what they will get before any
// camera or microphone is requested. The no-device path from the
// example step runs the whole session as a guided example whose stages
// are labelled, on screen and on the sheet, as watched examples and
// never as measurements. When all three stages have an outcome, the
// Observation Sheet appears as the result.

import { useState } from 'react';
import { getFeature } from '../../../../shared/registry';
import { LabShell } from '../../../shell';
import ArmStage from './ArmStage';
import FaceStage from './FaceStage';
import ObservationSheet from './ObservationSheet';
import SpeechStage from './SpeechStage';
import { ArmChart, MovementBars, WordMapView } from './bits';
import { TARGET_SENTENCE, buildWordMap } from './session-logic';
import type {
  ArmStageOutcome,
  FaceStageOutcome,
  FastSession,
  SpeechStageOutcome,
} from './types';
import './fast-live.css';

const EXAMPLE_ARM_LEFT = [
  { t: 0, deg: 88 },
  { t: 2.5, deg: 87 },
  { t: 5, deg: 86 },
  { t: 7.5, deg: 86 },
  { t: 10, deg: 85 },
];
const EXAMPLE_ARM_RIGHT = [
  { t: 0, deg: 90 },
  { t: 2.5, deg: 87 },
  { t: 5, deg: 83 },
  { t: 7.5, deg: 79 },
  { t: 10, deg: 76 },
];

function FastExample() {
  const exampleMap = buildWordMap(TARGET_SENTENCE, 'The sky is dear and blue today');
  return (
    <>
      <h2 className="section-title">See it first: one guided FAST practice</h2>
      <p>
        This session has three short stages. The camera measures your face and your arms on
        this device, or you can upload a photo or video of the face and arm stages instead:
        the frames leave this device and the AI service describes what it sees in them, which
        is a description, not a measurement. The browser recognizer transcribes one sentence.
        Nothing here produces a total or a verdict: the ending is an observation sheet that
        describes what was measured or described.
      </p>

      <h3>Face</h3>
      <p>Watch how the mesh follows the face. Then try the same two movements.</p>
      <MovementBars left={62} right={58} />
      <p className="muted">
        Example result: both sides moved; the left side&rsquo;s recorded movement was slightly
        larger in this recording.
      </p>

      <h3>Arm</h3>
      <p>Hold both arms out. The chart follows each arm&rsquo;s angle for 10 seconds.</p>
      <ArmChart
        leftSeries={EXAMPLE_ARM_LEFT}
        rightSeries={EXAMPLE_ARM_RIGHT}
        holdSeconds={10}
        leftStartDeg={88}
        rightStartDeg={90}
      />
      <p className="muted">
        Example result: over 10 seconds, the left arm&rsquo;s angle changed by 3 degrees and
        the right arm&rsquo;s by 14 degrees in the camera picture.
      </p>

      <h3>Speech</h3>
      <p>Read this sentence out loud, once:</p>
      <p className="fast-target">&ldquo;{TARGET_SENTENCE}&rdquo;</p>
      <WordMapView entries={exampleMap.entries} />
      <p className="muted">
        Example result: {exampleMap.correctCount} of {exampleMap.targetCount} words transcribed
        exactly as written. When you record, your voice is transcribed by your browser provider
        (for example Google in Chrome, Apple in Safari). This site receives only the text.
      </p>

      <h3>How the session ends</h3>
      <pre className="fast-sheet-excerpt" tabIndex={0} aria-label="Example observation sheet excerpt">{`FAST Check - Observation Sheet
FACE
Smile task (4 seconds, 3.6 usable seconds recorded)
  Left side movement (relative): 62    Right side: 58
ARM (camera-adapted position: arms out to the sides)
  Right arm angle: started 90 deg, ended 76 deg (change 14 deg)
SPEECH
Word map: 6 of 7 words transcribed exactly as written.`}</pre>
      <p className="muted">
        If you have no camera or microphone, choose &ldquo;Use the example instead&rdquo;
        below: the whole session then runs as a guided example, and the sheet says so.
      </p>
    </>
  );
}

const STAGE_LABELS = ['Face', 'Arm', 'Speech'] as const;

function stageStatusText(outcome: FaceStageOutcome | ArmStageOutcome | SpeechStageOutcome) {
  switch (outcome.status) {
    case 'measured':
      return 'Recorded';
    case 'ai':
      return outcome.source === 'photo'
        ? 'AI analysis of your uploaded photo'
        : 'AI analysis of your uploaded video';
    case 'could-not':
      return 'Could not be measured';
    case 'skipped':
      return 'Not recorded (skipped)';
    case 'example':
      return 'Guided example (not measured)';
  }
}

export default function FastLiveCheck() {
  const feature = getFeature('fast-live-check')!;
  const [guided, setGuided] = useState(false);
  const [session, setSession] = useState<FastSession>({});
  const [current, setCurrent] = useState(0);

  const outcomes = [session.face, session.arm, session.speech];
  const complete = outcomes.every((outcome) => outcome !== undefined);

  const handleFinish = (index: number) => (outcome: FaceStageOutcome | ArmStageOutcome | SpeechStageOutcome) => {
    setSession((previous) => {
      const next = { ...previous };
      if (index === 0) next.face = outcome as FaceStageOutcome;
      if (index === 1) next.arm = outcome as ArmStageOutcome;
      if (index === 2) next.speech = outcome as SpeechStageOutcome;
      return next;
    });
    setCurrent((value) => Math.min(2, Math.max(value, index + 1)));
  };

  const redoStage = (index: number) => {
    setSession((previous) => {
      const next = { ...previous };
      if (index === 0) next.face = undefined;
      if (index === 1) next.arm = undefined;
      if (index === 2) next.speech = undefined;
      return next;
    });
    setCurrent(index);
  };

  const tryIt = (
    <div className="fast-session">
      {guided ? (
        <div className="fast-guided-banner" role="note">
          Guided example - not a measurement. You are watching the teaching example; nothing
          about you is measured in this mode.
        </div>
      ) : null}

      {STAGE_LABELS.map((label, index) => {
        const outcome = outcomes[index];
        if (outcome !== undefined) {
          return (
            <section className="panel fast-stage-done" key={label} aria-label={`${label} stage summary`}>
              <p>
                <strong>{label}</strong> - {stageStatusText(outcome)}
              </p>
              <button type="button" className="btn" onClick={() => redoStage(index)}>
                Redo {label.toLowerCase()} stage
              </button>
            </section>
          );
        }
        if (index === current) {
          if (index === 0) {
            return <FaceStage key={label} guided={guided} onFinish={handleFinish(0)} />;
          }
          if (index === 1) {
            return <ArmStage key={label} guided={guided} onFinish={handleFinish(1)} />;
          }
          return <SpeechStage key={label} guided={guided} onFinish={handleFinish(2)} />;
        }
        return (
          <section className="panel fast-stage-next" key={label} aria-label={`${label} stage, up next`}>
            <p className="muted">
              <strong>{label}</strong> - up next
            </p>
          </section>
        );
      })}
    </div>
  );

  return (
    <LabShell
      feature={feature}
      example={<FastExample />}
      tryIt={tryIt}
      result={complete ? <ObservationSheet session={session} /> : undefined}
      onExampleAlt={() => setGuided(true)}
    />
  );
}
