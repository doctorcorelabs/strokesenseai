import type { ReactNode } from 'react';
import type { FeatureEntry } from '../../../shared/registry';
import {
  CannotAnalyzePanel,
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../../components/ui';
import type { CoachMode } from '../../components/ui';

/**
 * Standard safety wording shown on every feature page. Results in this
 * lab are experimental measurements for learning: never a clinical
 * score, never able to rule out stroke, and never a reason to delay
 * calling 119 when sudden symptoms are present.
 */
export const SAFETY_DISCLAIMER =
  'Every measurement in this lab is experimental and shown for learning only. Values are ' +
  'not a clinical score, are not validated for diagnosis or screening, and a result that ' +
  'looks typical cannot rule out stroke. If sudden symptoms are present, call 119 in ' +
  'Indonesia now instead of using this lab.';

export type FeatureShellStatus = 'ready' | 'loading' | 'error';

export interface FeatureShellProps {
  /** Registry entry for the feature: the single source of truth for its copy. */
  feature: FeatureEntry;
  /** Honest mode label (live AI, offline guide, simulation, ...). Omit to hide. */
  mode?: CoachMode;
  /** Workspace status. Loading and error replace the workspace, never fake a result. */
  status?: FeatureShellStatus;
  /** Specific failure reason shown when status is "error". */
  errorMessage?: string;
  /** Retry handler shown next to the error state when provided. */
  onRetry?: () => void;
  /** Hide the emergency banner only for pages that render their own equivalent. */
  showEmergency?: boolean;
  /** Extra safety or limitation notes appended to the standard disclaimer. */
  safetyExtra?: ReactNode;
  children?: ReactNode;
}

/**
 * Page frame shared by all Phase 1 feature pages: registry-driven
 * heading with maturity and mode badges, the persistent emergency
 * banner, a consistent loading and error area, the workspace itself,
 * and the standard safety disclaimer with the feature limitations.
 */
export default function FeatureShell({
  feature,
  mode,
  status = 'ready',
  errorMessage,
  onRetry,
  showEmergency = true,
  safetyExtra,
  children,
}: FeatureShellProps) {
  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature.group}</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          {mode ? <ModeBadge mode={mode} /> : null}
        </div>
      </header>

      {showEmergency ? <EmergencyBanner /> : null}

      {status === 'loading' ? (
        <section className="panel" role="status" aria-live="polite" aria-label="Loading workspace">
          <h2 className="section-title">Preparing this lab</h2>
          <p className="muted">
            The workspace is loading. If this takes more than a few seconds, check your
            connection and reload the page.
          </p>
        </section>
      ) : status === 'error' ? (
        <section aria-label="Workspace error">
          <CannotAnalyzePanel
            role="alert"
            reason={errorMessage ?? 'The workspace could not be prepared.'}
            guidance="Nothing was measured and no result was invented. You can try again, or keep reading the guide on this page."
          />
          {onRetry ? (
            <div className="wizard-actions">
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        children
      )}

      <section className="panel" aria-labelledby="feature-safety-title">
        <h2 className="section-title" id="feature-safety-title">
          Safety and limits
        </h2>
        <p>{SAFETY_DISCLAIMER}</p>
        <p>{feature.limitations}</p>
        {safetyExtra}
        <UncertaintyNote>
          Raw photos, audio, and video stay in this browser tab unless you explicitly consent
          to share derived measurements for an AI explanation.
        </UncertaintyNote>
      </section>
    </div>
  );
}
