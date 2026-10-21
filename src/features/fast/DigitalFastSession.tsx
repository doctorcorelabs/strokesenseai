import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Phone, Play, RotateCcw } from 'lucide-react';
import { getFeature } from '../../../shared/registry';
import ToolCoach from '../../ai/ToolCoach';
import {
  CannotAnalyzePanel,
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import CameraStage from './CameraStage';
import SpeechWorkbench from './SpeechWorkbench';
import {
  CLOSING_LINE,
  STAGES,
  answerGate,
  buildSummary,
  canCompleteStage,
  completeStage,
  createSession,
  markStageCannotAnalyze,
  progressFraction,
  remainingSeconds,
  setAnswer,
  setQuality,
  setTranscript,
  stageDef,
  startStages,
} from './session';
import type {
  CheckStatus,
  DataQuality,
  SessionState,
  StageDef,
  StageState,
} from './session';
import { buildInterpretationContext, localInterpretation } from './interpret';
import './fast.css';

const STATUS_OPTIONS: { value: CheckStatus; label: string }[] = [
  { value: 'observed', label: 'Observed' },
  { value: 'not-observed', label: 'Not observed' },
  { value: 'unsure', label: 'Not sure' },
  { value: 'cannot', label: 'Could not check' },
];

const QUALITY_OPTIONS: { value: DataQuality; label: string; hint: string }[] = [
  {
    value: 'good',
    label: 'Good',
    hint: 'Clear view or sound and the full task was completed.',
  },
  {
    value: 'limited',
    label: 'Limited',
    hint: 'Poor light, framing, or noise, a partial task, or demo mode data.',
  },
  {
    value: 'failed',
    label: 'Failed',
    hint: 'This stage could not be done or observed at all. It will be reported as cannot analyze.',
  },
];

function answerLabel(value: CheckStatus | null): string {
  const found = STATUS_OPTIONS.find((option) => option.value === value);
  return found ? found.label : 'Not answered';
}

/** Task countdown. The clock lives here; session.ts only does arithmetic. */
function StageTimer({ durationSec, resetKey }: { durationSec: number; resetKey: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setElapsed(0);
    setRunning(false);
  }, [resetKey]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setElapsed((value) => Math.min(value + 0.25, durationSec));
    }, 250);
    return () => window.clearInterval(id);
  }, [running, durationSec]);

  useEffect(() => {
    if (elapsed >= durationSec) setRunning(false);
  }, [elapsed, durationSec]);

  const remaining = remainingSeconds(durationSec, elapsed);
  const percent = Math.round(progressFraction(durationSec, elapsed) * 100);

  return (
    <div className="fast-timer">
      <span className="fast-timer-text" role="timer">
        Time left: {remaining} s
      </span>
      <div
        className="fast-timer-track"
        role="progressbar"
        aria-label="Task time elapsed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="fast-timer-fill" style={{ width: `${percent}%` }} />
      </div>
      {running ? (
        <button type="button" className="btn" onClick={() => setRunning(false)}>
          <Pause size={16} aria-hidden="true" /> Pause
        </button>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={remaining === 0}
          onClick={() => setRunning(true)}
        >
          <Play size={16} aria-hidden="true" /> {elapsed > 0 ? 'Resume timer' : 'Start timer'}
        </button>
      )}
      <button
        type="button"
        className="btn"
        onClick={() => {
          setElapsed(0);
          setRunning(false);
        }}
      >
        <RotateCcw size={16} aria-hidden="true" /> Reset
      </button>
      {remaining === 0 && (
        <span className="muted" role="status">
          Time is up. Record what you observed below.
        </span>
      )}
    </div>
  );
}

function ChecklistEditor({
  def,
  stage,
  onAnswer,
}: {
  def: StageDef;
  stage: StageState;
  onAnswer: (itemId: string, status: CheckStatus) => void;
}) {
  return (
    <div>
      {def.items.map((item) => (
        <div key={item.id} className="fast-check-item">
          <p>
            <strong>{item.prompt}</strong>
          </p>
          <p className="muted">{item.hint}</p>
          <div className="fast-choice-row" role="group" aria-label={item.prompt}>
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`btn fast-choice${stage.answers[item.id] === option.value ? ' is-selected' : ''}`}
                aria-pressed={stage.answers[item.id] === option.value}
                onClick={() => onAnswer(item.id, option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QualitySelector({
  value,
  demoMode,
  onChange,
}: {
  value: DataQuality;
  demoMode: boolean;
  onChange: (quality: DataQuality) => void;
}) {
  const active = QUALITY_OPTIONS.find((option) => option.value === value);
  return (
    <div>
      <div className="fast-choice-row" role="group" aria-label="Data quality for this stage">
        {QUALITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`btn fast-choice${value === option.value ? ' is-selected' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="muted">
        {active?.hint}
        {demoMode && value === 'good'
          ? ' In demo mode the data is synthetic, so Limited is the honest choice.'
          : ''}
      </p>
    </div>
  );
}

/**
 * Digital FAST Multimodal Lab: one guided session with a symptom gate,
 * three stages (face, arm, speech), per modality observation sheets, and
 * a hard emergency stop. All session rules live in session.ts; this
 * component only renders them and owns the camera, microphone, and clock.
 */
export default function DigitalFastSession() {
  const feature = getFeature('digital-fast-multimodal');
  const [session, setSession] = useState<SessionState>(() => createSession());
  const [demoMode, setDemoMode] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFirstFocus = useRef(true);
  const focusKey = `${session.phase}-${session.activeStageIndex}`;

  useEffect(() => {
    if (skipFirstFocus.current) {
      skipFirstFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [focusKey]);

  const summary = useMemo(
    () => (session.phase === 'summary' ? buildSummary(session) : null),
    [session],
  );

  if (!feature) {
    return (
      <div className="page-stack">
        <section className="panel">
          <h1 className="section-title">Lab not found</h1>
          <p className="muted">The Digital FAST Multimodal Lab is missing from the registry.</p>
          <a className="btn btn-primary" href="#home">
            Back to all labs
          </a>
        </section>
      </div>
    );
  }

  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  const activeDef = STAGES[session.activeStageIndex] ?? STAGES[0];
  const activeStage = activeDef ? session.stages[activeDef.id] : session.stages.face;
  const stageComplete = activeDef ? canCompleteStage(activeDef, activeStage) : false;
  const escalation = session.escalation;

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature.group} / Flagship lab</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          <ModeBadge mode={apiConfigured ? 'live' : 'offline'} />
          {demoMode && <ModeBadge mode="synthetic" />}
        </div>
        <p className="muted">
          Educational practice only. This lab structures short practice tasks and records what a
          person observes. It does not diagnose stroke, it cannot rule stroke out, and a typical
          looking session is never a reassurance.
        </p>
      </header>

      <EmergencyBanner />

      {session.phase === 'gate' && (
        <section className="panel" aria-labelledby="fast-gate">
          <p className="eyebrow">Before you start</p>
          <h2 className="section-title" id="fast-gate" tabIndex={-1} ref={headingRef}>
            Symptom gate
          </h2>
          <p>
            Is anyone showing sudden new symptoms right now, such as a drooping face, a weak arm,
            difficult speech, vision changes, or loss of balance?
          </p>
          <p className="muted">
            If yes, this session must not start. Calling 119 comes first, always. This gate also
            applies mid session: if symptoms begin at any point, stop and call.
          </p>
          <div className="card-grid">
            <button
              type="button"
              className="panel choice-card"
              onClick={() => setSession((state) => answerGate(state, true))}
            >
              <strong>Yes, symptoms are present now</strong>
            </button>
            <button
              type="button"
              className="panel choice-card"
              onClick={() => setSession((state) => answerGate(state, false))}
            >
              <strong>No, nobody has symptoms</strong>
            </button>
          </div>
          <p className="muted">
            Choose the second option only for a practice session with a well volunteer, or for
            demo mode on your own.
          </p>
        </section>
      )}

      {session.phase === 'emergency' && (
        <section className="panel alert-emergency" role="alert" aria-labelledby="fast-emergency">
          <h2 className="section-title" id="fast-emergency" tabIndex={-1} ref={headingRef}>
            {escalation?.source === 'gate'
              ? 'Do not start this session.'
              : escalation?.status === 'unsure'
                ? 'An answer was marked Not sure. Treat it as urgent.'
                : 'A possible stroke sign was observed.'}
          </h2>
          <p>
            {escalation?.source === 'checklist'
              ? `This happened during the ${stageDef(escalation.stageId).title} stage. `
              : ''}
            The session has stopped and will not continue. Call <strong>119</strong> in Indonesia
            now and let emergency professionals assess the person, even if the symptoms disappear.
            Do not drive the person yourself if an ambulance is available, and note when the
            person was last known well if you know it.
          </p>
          <p lang="id" className="muted">
            Sesi ini berhenti. Segera hubungi 119 di Indonesia sekarang, meskipun gejala sudah
            berhenti. Jangan menunggu hasil tool apa pun.
          </p>
          <div className="wizard-actions">
            <a className="btn btn-danger" href="tel:119">
              <Phone size={16} aria-hidden="true" /> Call 119 now
            </a>
            <button type="button" className="btn" onClick={() => setSession(createSession())}>
              I have called 119 or help is on the way
            </button>
          </div>
        </section>
      )}

      {session.phase === 'intro' && (
        <section className="panel" aria-labelledby="fast-intro">
          <p className="eyebrow">Guided session</p>
          <h2 className="section-title" id="fast-intro" tabIndex={-1} ref={headingRef}>
            How this session works
          </h2>
          <ol className="step-list">
            <li>
              <strong>Three short tasks.</strong> Smile for 6 seconds, raise both arms for 10
              seconds, then repeat one standard sentence. A timer guides each task.
            </li>
            <li>
              <strong>You record what you observe.</strong> After each task you answer a short
              checklist. &ldquo;Could not check&rdquo; is always an honest answer, and each stage
              also gets a data quality rating from you.
            </li>
            <li>
              <strong>The session stops for safety.</strong> Answering Observed or Not sure on any
              check ends the session immediately and directs you to call 119. That stop cannot be
              undone by editing answers.
            </li>
            <li>
              <strong>Each modality stands alone.</strong> There is no combined score. A stage
              that cannot be done is reported as cannot analyze, and the other stages never fill
              in for it.
            </li>
            <li>
              <strong>Processing stays on this device.</strong> The camera and microphone are
              opt-in per stage, video and audio are never uploaded or stored, and the session
              exists only in this tab&rsquo;s memory.
            </li>
          </ol>
          <label className="check-row">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => setDemoMode(event.target.checked)}
            />{' '}
            Synthetic demo mode: practice the flow without a camera or microphone, using an
            imagined volunteer.
          </label>
          <div className="wizard-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSession((state) => startStages(state))}
            >
              Start the session
            </button>
          </div>
        </section>
      )}

      {session.phase === 'stage' && activeDef && (
        <section className="panel" aria-labelledby="fast-stage">
          <div className="fast-progress" aria-hidden="true">
            {STAGES.map((def, index) => (
              <div
                key={def.id}
                className={`fast-progress-seg${
                  index < session.activeStageIndex
                    ? ' is-done'
                    : index === session.activeStageIndex
                      ? ' is-current'
                      : ''
                }`}
              />
            ))}
          </div>
          <p className="eyebrow">
            Stage {session.activeStageIndex + 1} of {STAGES.length} - {activeDef.letter} /{' '}
            {activeDef.title}
          </p>
          <h2 className="section-title" id="fast-stage" tabIndex={-1} ref={headingRef}>
            {activeDef.task}
          </h2>
          <p className="muted">{activeDef.guidance}</p>

          {activeDef.usesCamera ? (
            <CameraStage stageId={activeDef.id} demoMode={demoMode} />
          ) : (
            <SpeechWorkbench
              transcript={activeStage.transcript}
              onTranscriptChange={(text) => setSession((state) => setTranscript(state, text))}
            />
          )}

          <StageTimer durationSec={activeDef.durationSec} resetKey={activeDef.id} />

          <h3 className="section-title">Record what you observed</h3>
          <ChecklistEditor
            def={activeDef}
            stage={activeStage}
            onAnswer={(itemId, status) =>
              setSession((state) => setAnswer(state, activeDef.id, itemId, status))
            }
          />

          <h3 className="section-title">Data quality for this stage</h3>
          <QualitySelector
            value={activeStage.quality}
            demoMode={demoMode}
            onChange={(quality) => setSession((state) => setQuality(state, activeDef.id, quality))}
          />

          <div className="wizard-actions">
            <button
              type="button"
              className="btn"
              onClick={() => setSession((state) => markStageCannotAnalyze(state, activeDef.id))}
            >
              Mark stage as cannot analyze
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!stageComplete}
              onClick={() => setSession((state) => completeStage(state))}
            >
              {session.activeStageIndex >= STAGES.length - 1
                ? 'Finish and see the summary'
                : 'Complete stage and continue'}
            </button>
          </div>
          {!stageComplete && (
            <p className="muted">
              Answer every check to continue. If a check was not possible, answer Could not check,
              or mark the whole stage as cannot analyze.
            </p>
          )}
        </section>
      )}

      {session.phase === 'summary' && summary && (
        <>
          <section className="panel" aria-labelledby="fast-summary">
            <p className="eyebrow">Session summary</p>
            <h2 className="section-title" id="fast-summary" tabIndex={-1} ref={headingRef}>
              Observation sheets, one per modality
            </h2>
            <p className="muted">
              Each stage is reported on its own. There is no combined score and no overall pass
              or fail, by design.
            </p>

            {summary.stages.map((stageSummary) => {
              const def = stageDef(stageSummary.stageId);
              const stageState = session.stages[stageSummary.stageId];
              return (
                <div key={def.id} className="fast-sheet">
                  <h3>
                    {def.letter} / {def.title}
                  </h3>
                  <p className="muted">
                    Data quality: {stageSummary.quality}. Checks answered:{' '}
                    {stageSummary.answeredCount} of {stageSummary.itemCount}.
                  </p>
                  {stageSummary.status === 'cannot-analyze' ? (
                    <CannotAnalyzePanel
                      role="note"
                      reason={`The ${def.title} stage could not be analyzed with the data available in this session.`}
                      guidance="No value was invented for this stage, and the other stages do not fill in for it. Restart the session if you want to try this stage again with better data."
                    />
                  ) : (
                    <>
                      <ul className="check-list">
                        {def.items.map((item) => (
                          <li key={item.id}>
                            {item.prompt}: <strong>{answerLabel(stageState.answers[item.id])}</strong>
                          </li>
                        ))}
                      </ul>
                      {stageSummary.transcriptMatch && (
                        <p className="muted">
                          Sentence word match: {stageSummary.transcriptMatch.matchedCount} of{' '}
                          {stageSummary.transcriptMatch.totalCount} target words. A practice
                          clarity measure, not a score.
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <h3 className="section-title">Data contribution by modality</h3>
            <p className="muted">
              These transparent weights come only from data quality and completeness, so you can
              inspect how much usable data each stage contributed. They are not a risk estimate
              and are never combined into a verdict.
            </p>
            {summary.weights.map((entry) => {
              const def = stageDef(entry.stageId);
              const percent = Math.round(entry.weight * 100);
              return (
                <div key={entry.stageId} className="fast-weight-row">
                  <span>
                    {def.letter} / {def.title.split(':')[0]}
                  </span>
                  <div className="fast-weight-track" aria-hidden="true">
                    <div className="fast-weight-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="fast-weight-value">{percent}%</span>
                </div>
              );
            })}

            <UncertaintyNote>
              Every value on this page describes a few seconds of practice with a consumer camera
              and microphone. {CLOSING_LINE}
            </UncertaintyNote>

            <div className="wizard-actions">
              <a className="btn btn-danger" href="tel:119">
                <Phone size={16} aria-hidden="true" /> Call 119
              </a>
              <a className="btn" href="#fast">
                Open the manual FAST check
              </a>
              <button type="button" className="btn" onClick={() => setSession(createSession())}>
                <RotateCcw size={16} aria-hidden="true" /> Restart session
              </button>
            </div>
            <p className="muted">
              Nothing from this session was stored or sent anywhere by the lab itself. Restarting
              clears it from this tab.
            </p>
          </section>

          <ToolCoach
            tool="fast"
            moduleId="digital-fast-multimodal"
            context={buildInterpretationContext(summary)}
            fallback={localInterpretation(summary)}
            title="AI interpretation of this session"
          />
        </>
      )}
    </div>
  );
}
