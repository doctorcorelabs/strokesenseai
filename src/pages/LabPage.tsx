import { Suspense } from 'react';
import { getFeature, LEGACY_ALIASES, R1_FEATURES } from '../../shared/registry';
import type { FeatureEntry } from '../../shared/registry';
import { LAB_MODULES } from '../../shared/lab';
import ToolCoach from '../ai/ToolCoach';
import { featureModeLabel } from '../ai/featureMode';
import HowItWorks from '../components/HowItWorks';
import { EmergencyBanner, MaturityBadge, UncertaintyNote } from '../components/ui';
import {
  FULL_PAGE_LABS,
  SELF_BANNERED_IDS,
  SPEECH_APHASIA_IDS,
  SpeechAphasiaLab,
  WORKSPACE_LABS,
  LabLoading,
  WorkspaceLoading,
} from '../features/featureRoutes';

type CoachResolution = {
  tool: string;
  moduleId: string;
  /** True when the feature has its own module with the exact same id. */
  exact: boolean;
};

/**
 * Find the coach module for a feature. The feature id is searched exactly
 * across every tool in LAB_MODULES first, so a page is only ever explained
 * with its own module. The generic fallback is a last resort for a feature
 * whose module has not been written yet, and the page says so openly.
 */
function resolveCoachProps(feature: FeatureEntry): CoachResolution {
  const modules = LAB_MODULES as unknown as Record<string, Record<string, unknown>>;
  for (const [tool, toolModules] of Object.entries(modules)) {
    if (Object.prototype.hasOwnProperty.call(toolModules, feature.id)) {
      return { tool, moduleId: feature.id, exact: true };
    }
  }
  const firstTool = Object.keys(modules)[0] ?? '';
  const firstModuleId = firstTool ? (Object.keys(modules[firstTool] ?? {})[0] ?? feature.id) : feature.id;
  return { tool: firstTool, moduleId: firstModuleId, exact: false };
}

function inputSummary(feature: FeatureEntry): string {
  if (feature.inputKinds.length === 0) return 'the input described in this lab';
  return feature.inputKinds.join(', ');
}

/**
 * Honest end-of-life panel for a retired lab whose alias target is null.
 * The route stays reachable so old links never dead-end, but the page
 * says plainly that the experiment was withdrawn and why, instead of
 * quietly serving a successor it was never merged into.
 */
function RetiredLabPanel({ feature }: { feature: FeatureEntry }) {
  return (
    <div className="page-stack">
      <section className="panel">
        <p className="eyebrow">{feature.group}</p>
        <h1 className="section-title">{feature.name} has been retired</h1>
        <p>
          This experiment is no longer part of the lab. It followed the movement of a mouse
          pointer or a finger on the screen while its name promised eye and gaze tracking, and
          a pointer is not a gaze: keeping it live would have kept teaching a measurement the
          tool never made. It was withdrawn rather than renamed, and it has no successor in
          the current catalog. A real gaze lab based on iris landmarks may return only if it
          first passes a published accuracy check on real people.
        </p>
        <p className="muted">
          Nothing was measured or stored by visiting this page. The rebuilt labs measure the
          face, arms, and hands with on-device landmark models instead.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#lab/face-lab">
            Try Face Lab instead
          </a>
          <a className="btn" href="#home">
            Back to all labs
          </a>
        </div>
      </section>
    </div>
  );
}

/**
 * Resolve a legacy route id through the registry migration map. An alias
 * whose target is a mounted R1 rebuild feature renders that target under
 * the old id, so shared and bookmarked links land on the successor. An
 * alias whose target is an R2 feature that is not built yet keeps
 * rendering the legacy lab itself: no dead ends, recorded as R2 debt.
 * A null target means the lab was retired with no successor.
 */
function resolveRouteId(id: string): { effectiveId: string; retired: boolean } {
  if (!Object.prototype.hasOwnProperty.call(LEGACY_ALIASES, id)) {
    return { effectiveId: id, retired: false };
  }
  const target = LEGACY_ALIASES[id];
  if (target === null) return { effectiveId: id, retired: true };
  if (target && R1_FEATURES.some((feature) => feature.id === target)) {
    return { effectiveId: target, retired: false };
  }
  return { effectiveId: id, retired: false };
}

export default function LabPage({ id: routeId }: { id: string }) {
  const { effectiveId: id, retired } = resolveRouteId(routeId);
  const feature = getFeature(id);

  if (retired && feature) {
    return <RetiredLabPanel feature={feature} />;
  }

  if (!feature) {
    return (
      <div className="page-stack">
        <section className="panel">
          <p className="eyebrow">StrokeSense AI Lab</p>
          <h1 className="section-title">Lab not found</h1>
          <p className="muted">
            There is no experiment with the id &quot;{id}&quot; on this site. The link may be
            outdated or misspelled. Browse the full list of labs instead.
          </p>
          <a className="btn btn-primary" href="#home">
            Back to all labs
          </a>
        </section>
      </div>
    );
  }

  // Full page feature labs bring their own heading, badges, and emergency
  // banner, so they replace this generic page entirely for their route id.
  const FullPageLab = FULL_PAGE_LABS[id];
  if (FullPageLab) {
    return (
      <Suspense fallback={<LabLoading />}>
        <FullPageLab />
      </Suspense>
    );
  }

  // Workspace feature labs render inside this page shell, in the place of
  // the generic guided walkthrough below. The speech and aphasia labs are
  // served by one shared dispatcher that takes the feature id as a prop.
  const WorkspaceLab = WORKSPACE_LABS[id];
  const isSpeechAphasia = SPEECH_APHASIA_IDS.has(id);
  const hasWorkspace = Boolean(WorkspaceLab) || isSpeechAphasia;

  const { tool, moduleId, exact } = resolveCoachProps(feature);
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  const fallback =
    `Prewritten guide for ${feature.name}. ${feature.summary} ` +
    'This guide is curated text, not a generated answer. It explains what the experiment ' +
    'measures, what it cannot measure, and why its results are not a medical finding.';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">{feature.group}</p>
        <h1>{feature.name}</h1>
        <p className="muted">{feature.tagline}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature.maturity} />
          {/* The mode label comes from the per-feature helper so the header
              never claims a mode the feature itself does not have. */}
          <span className="badge badge-mode">{featureModeLabel(feature, apiConfigured)}</span>
        </div>
      </header>

      {/* Workspaces in SELF_BANNERED_IDS render their own emergency banner,
          so the shell banner is skipped for them to avoid showing it twice.
          Lab pages use the slim banner variant so the workspace stays the
          first substantial element on the page. */}
      {!SELF_BANNERED_IDS.has(id) && <EmergencyBanner variant="slim" />}

      {/* The interactive workspace is the primary element of the page and
          renders directly under the header. Everything explanatory moved
          into the collapsed About and help section below it. A failed
          analysis is reported by the workspace itself with its real reason;
          the shell no longer shows a permanent demonstration of that panel. */}
      {hasWorkspace ? (
        <Suspense fallback={<WorkspaceLoading />}>
          {isSpeechAphasia ? (
            <SpeechAphasiaLab id={id} />
          ) : WorkspaceLab ? (
            <WorkspaceLab />
          ) : null}
        </Suspense>
      ) : (
        <section className="panel" aria-labelledby="lab-how">
          <h2 className="section-title" id="lab-how">
            How this experiment works
          </h2>
          <ol className="step-list">
            <li>
              <strong>You provide input.</strong> This lab works with {inputSummary(feature)}.
              Sample inputs are synthetic by default. Providing real input is always opt-in, one
              session at a time.
            </li>
            <li>
              <strong>Processing stays local first.</strong> Measurements are computed in your
              browser whenever the experiment allows it. Raw photos, audio, and video are not
              uploaded by default.
            </li>
            <li>
              <strong>AI explanation is optional.</strong> If you ask for one and consent to data
              sharing, only the derived measurements and your question are sent through the
              Cloudflare Worker to the AI provider. The AI explains the measurement; it never sets
              the measurement, a score, or a conclusion.
            </li>
          </ol>
          <p className="muted">
            Guided walkthrough: this page explains the experiment step by step while its
            interactive workspace is still being built, so there is nothing to run yet. The coach
            in the About and help section below can already answer questions about the idea
            behind the lab.
          </p>
        </section>
      )}

      <details className="panel">
        <summary className="section-title">About and help</summary>

        <h3>About this experiment</h3>
        <p>{feature.summary}</p>

        <HowItWorks feature={feature} />

        {!exact && (
          <p className="muted" role="note">
            Note: this lab does not have its own AI coach module yet, so the coach below uses a
            general introductory module. Its explanations are generic background and may not cover
            what makes this lab specific.
          </p>
        )}
        <ToolCoach
          tool={tool}
          moduleId={moduleId}
          context={`${feature.name} (${feature.group}). ${feature.summary}`}
          fallback={fallback}
        />

        <h3>Known limitations</h3>
        <p>{feature.limitations}</p>

        <UncertaintyNote>
          Every measurement in this lab is experimental. Values are shown with their input quality
          and known limits, never as a clinical score, and a measurement that looks typical cannot
          rule out stroke.
        </UncertaintyNote>
      </details>
    </div>
  );
}
