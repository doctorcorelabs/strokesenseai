// LabShell: the single page frame for every rebuilt lab, implementing
// the Example, Try, Understand pattern from the rebuild planning.
//
// The contract:
// - A compact header carries the feature name, its group, and the honest
//   mode badge that already exists (ModeBadge fed by the feature's own
//   registry entry). Below it, the slim emergency strip that already
//   exists. Nothing else sits above the stepper.
// - A three-step stepper is always visible, labelled exactly "See an
//   example", "Try it", "Your result". It marks the step the person is
//   on, driven by the shell's own state and by whether a result exists.
// - Step 1 shows the example panel in full. It needs no consent and no
//   device permission: the tryIt content is not even mounted yet, so no
//   camera, microphone, or model load can start from this step.
// - One primary button, "Start trying", moves to step 2. A feature may
//   pass onExampleAlt for the no-device path (for example a guided
//   example instead of the camera); it renders as a secondary button
//   labelled "Use the example instead" and also moves to step 2, after
//   the feature has recorded the choice through the callback.
// - Step 3 is not a separate screen: when the feature supplies a result,
//   the sheet renders attached below the workspace and the stepper moves
//   to "Your result".
// - Below the workspace sits one folded "About and help" section that
//   renders the existing HowItWorks panel for this feature.

import { useState, type ReactNode } from 'react';
import type { FeatureEntry } from '../../shared/registry';
import HowItWorks from '../components/HowItWorks';
import { EmergencyBanner, MaturityBadge, ModeBadge } from '../components/ui';
import './shell.css';

/** The registry entry type, re-exported under the shell's short name. */
export type Feature = FeatureEntry;

export interface LabShellProps {
  feature: Feature;
  /** Step 1 content: the worked example, readable with no input at all. */
  example: ReactNode;
  /** Step 2 content: the interactive workspace itself. */
  tryIt: ReactNode;
  /** Step 3 content: usually a ResultSheet. Appears below tryIt. */
  result?: ReactNode;
  /** Optional no-device path offered from the example step. */
  onExampleAlt?: () => void;
}

const STEP_LABELS = ['See an example', 'Try it', 'Your result'] as const;

type StepIndex = 0 | 1 | 2;

function Stepper({ active }: { active: StepIndex }) {
  return (
    <ol className="lab-stepper" aria-label="Lab steps">
      {STEP_LABELS.map((label, index) => {
        const state = index < active ? 'done' : index === active ? 'active' : 'todo';
        return (
          <li
            key={label}
            className={`lab-stepper-step is-${state}`}
            aria-current={state === 'active' ? 'step' : undefined}
          >
            <span className="lab-stepper-dot" aria-hidden="true">
              {state === 'done' ? '✓' : index + 1}
            </span>
            <span className="lab-stepper-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function LabShell({ feature, example, tryIt, result, onExampleAlt }: LabShellProps) {
  const [started, setStarted] = useState(false);
  const hasResult = result !== undefined && result !== null;
  const active: StepIndex = hasResult ? 2 : started ? 1 : 0;
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  return (
    <div className="page-stack lab-shell">
      <header className="page-heading">
        <p className="eyebrow">{feature.group}</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          <ModeBadge feature={feature} apiConfigured={apiConfigured} />
        </div>
      </header>

      <EmergencyBanner variant="slim" />

      <Stepper active={active} />

      {active === 0 ? (
        <div className="lab-shell-stage">
          <section className="panel" aria-label="Example">
            {example}
          </section>
          <div className="lab-shell-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStarted(true)}
            >
              Start trying
            </button>
            {onExampleAlt ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  onExampleAlt();
                  setStarted(true);
                }}
              >
                Use the example instead
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="lab-shell-stage">
          {tryIt}
          {hasResult ? result : null}
        </div>
      )}

      <details className="panel">
        <summary className="section-title">About and help</summary>

        <h3>About this experiment</h3>
        <p>{feature.summary}</p>

        <HowItWorks feature={feature} />

        <h3>Known limitations</h3>
        <p>{feature.limitations}</p>
      </details>
    </div>
  );
}
