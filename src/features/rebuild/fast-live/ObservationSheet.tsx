// The closing Observation Sheet of the FAST Live Check.
//
// It renders exactly what the planning document prescribes (document
// 01, section 8): what the camera and microphone measured, stage by
// stage, with skipped stages written as "Not recorded", failed stages
// as "Could not be measured" with their reason, and guided example
// stages as watched examples. There is no total, no combined average,
// and no pass or fail mark anywhere on the sheet. The same content is
// downloadable as a plain text file, assembled by the pure builder in
// session-logic from the local session data only.

import { ArmChart, MovementBars, WordMapView } from './bits';
import {
  BROW_SECONDS,
  SMILE_SECONDS,
  TARGET_SENTENCE,
  buildObservationSheetText,
  describeArmHold,
  describeFaceTask,
} from './session-logic';
import type { FastSession } from './types';
import './fast-live.css';

function downloadSheet(session: FastSession) {
  const text = buildObservationSheetText(session, new Date());
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fast-observation-sheet.txt';
  link.click();
  URL.revokeObjectURL(url);
}

export default function ObservationSheet({ session }: { session: FastSession }) {
  const { face, arm, speech } = session;
  return (
    <section className="panel fast-sheet" aria-label="Observation sheet">
      <p className="eyebrow">Observation sheet</p>
      <h2 className="section-title">FAST Check - Observation Sheet</h2>
      <p className="fast-sheet-intro">
        This sheet records what the camera and microphone measured during a guided practice
        session. It is not a diagnosis, screening, or medical assessment, and it cannot rule
        out stroke. If you have sudden face, arm, or speech changes now, call{' '}
        <strong>119</strong> immediately.
      </p>

      <h3>Face</h3>
      {face === undefined || face.status === 'skipped' ? (
        <p>Face stage: Not recorded.</p>
      ) : face.status === 'example' ? (
        <p>Face stage: Watched the guided example (not measured).</p>
      ) : face.status === 'could-not' ? (
        <p>Face stage: Could not be measured. {face.reason}</p>
      ) : (
        <>
          <h4>Smile task ({SMILE_SECONDS} seconds)</h4>
          {face.smile.status === 'measured' ? (
            <>
              <MovementBars left={face.smile.left} right={face.smile.right} />
              <p>
                Recorded description: {describeFaceTask(face.smile.left, face.smile.right)}{' '}
                {face.smile.usableSeconds} usable seconds recorded.
              </p>
            </>
          ) : (
            <p>
              Could not be measured.{' '}
              {face.smile.status === 'could-not' ? face.smile.reason : ''}
            </p>
          )}
          <h4>Brow raise task ({BROW_SECONDS} seconds)</h4>
          {face.brow.status === 'measured' ? (
            <>
              <MovementBars left={face.brow.left} right={face.brow.right} />
              <p>
                Recorded description: {describeFaceTask(face.brow.left, face.brow.right)}{' '}
                {face.brow.usableSeconds} usable seconds recorded.
              </p>
            </>
          ) : (
            <p>
              Could not be measured.{' '}
              {face.brow.status === 'could-not' ? face.brow.reason : ''}
            </p>
          )}
        </>
      )}

      <h3>Arm (camera-adapted position: arms out to the sides)</h3>
      {arm === undefined || arm.status === 'skipped' ? (
        <p>Arm stage: Not recorded.</p>
      ) : arm.status === 'example' ? (
        <p>Arm stage: Watched the guided example (not measured).</p>
      ) : arm.status === 'could-not' ? (
        <p>Arm stage: Could not be measured. {arm.reason}</p>
      ) : (
        <>
          <ArmChart
            leftSeries={arm.leftSeries}
            rightSeries={arm.rightSeries}
            holdSeconds={arm.holdSeconds}
            leftStartDeg={arm.left.startDeg}
            rightStartDeg={arm.right.startDeg}
          />
          <p>
            Hold duration: {arm.holdSeconds} seconds ({arm.usableSeconds} usable)
          </p>
          <p>
            Left arm angle: started {Math.round(arm.left.startDeg)} deg, ended{' '}
            {Math.round(arm.left.endDeg)} deg (change{' '}
            {Math.round(Math.abs(arm.left.changeDeg))} deg)
          </p>
          <p>
            Right arm angle: started {Math.round(arm.right.startDeg)} deg, ended{' '}
            {Math.round(arm.right.endDeg)} deg (change{' '}
            {Math.round(Math.abs(arm.right.changeDeg))} deg)
          </p>
          <p>Recorded description: {describeArmHold(arm.left, arm.right, arm.holdSeconds)}</p>
        </>
      )}

      <h3>Speech</h3>
      {speech === undefined || speech.status === 'skipped' ? (
        <p>Speech stage: Not recorded.</p>
      ) : speech.status === 'example' ? (
        <p>Speech stage: Watched the guided example (not measured).</p>
      ) : speech.status === 'could-not' ? (
        <p>Speech stage: Could not be measured. {speech.reason}</p>
      ) : (
        <>
          <p>Target sentence: &ldquo;{TARGET_SENTENCE}&rdquo;</p>
          <WordMapView entries={speech.entries} />
          <p>
            {speech.mode === 'recognizer' ? 'Transcribed as' : 'Typed text'}: &ldquo;
            {speech.transcript}&rdquo;
          </p>
          <p>
            Word map: {speech.correctCount} of {speech.targetCount} words{' '}
            {speech.mode === 'recognizer' ? 'transcribed' : 'typed'} exactly as written.
          </p>
          {speech.extraWords.length > 0 ? (
            <p>
              Extra words {speech.mode === 'recognizer' ? 'heard' : 'typed'}:{' '}
              {speech.extraWords.join(', ')}
            </p>
          ) : null}
          <p>
            Mode:{' '}
            {speech.mode === 'recognizer'
              ? 'transcribed by the browser speech recognizer.'
              : 'typed from memory, not transcribed from speech.'}
          </p>
        </>
      )}

      <p className="fast-sheet-footer">
        Stages skipped or not measurable are listed as &ldquo;Not recorded&rdquo; or &ldquo;Could
        not be measured&rdquo; with the reason. Nothing on this sheet is a score.
      </p>
      <div className="fast-actions">
        <button type="button" className="btn" onClick={() => downloadSheet(session)}>
          Download this sheet as a text file
        </button>
      </div>
    </section>
  );
}
