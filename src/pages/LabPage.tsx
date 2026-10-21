import { Suspense } from 'react';
import { getFeature } from '../../shared/registry';
import type { FeatureEntry } from '../../shared/registry';
import { LAB_MODULES } from '../../shared/lab';
import ToolCoach from '../ai/ToolCoach';
import {
  CannotAnalyzePanel,
  EmergencyBanner,
  MaturityBadge,
  ModeBadge,
  UncertaintyNote,
} from '../components/ui';
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
 * The cannot-analyze explainer from the Phase 0 page. It stays in this shell
 * for every lab rendered here (guided walkthroughs and feature workspaces
 * alike, below the workspace) so the page always shows what a refused
 * analysis looks like. Full page labs render their own standalone pages and
 * do not get this section from the shell.
 */
function CannotAnalyzeSection() {
  return (
    <section className="panel" aria-labelledby="lab-cannot">
      <h2 className="section-title" id="lab-cannot">
        When analysis is not possible
      </h2>
      <CannotAnalyzePanel
        role="note"
        reason="No input yet. This panel shows what a failed analysis looks like: the lab reports the problem instead of inventing a result."
        guidance="When you use this lab with a real input, the lab checks the input first. If the input is missing, unclear, or below the quality needed, you will see this panel with the specific reason instead of a result."
      />
      <UncertaintyNote>
        Every measurement in this lab is experimental. Values are shown with their input quality
        and known limits, never as a clinical score, and a measurement that looks typical cannot
        rule out stroke.
      </UncertaintyNote>
    </section>
  );
}

export default function LabPage({ id }: { id: string }) {
  const feature = getFeature(id);

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
          <ModeBadge mode={apiConfigured ? 'live' : 'offline'} />
        </div>
      </header>

      {/* Workspaces in SELF_BANNERED_IDS render their own emergency banner,
          so the shell banner is skipped for them to avoid showing it twice. */}
      {!SELF_BANNERED_IDS.has(id) && <EmergencyBanner />}

      <section className="panel" aria-labelledby="lab-summary">
        <h2 className="section-title" id="lab-summary">
          About this experiment
        </h2>
        <p>{feature.summary}</p>
      </section>

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

      {hasWorkspace ? (
        <>
          <Suspense fallback={<WorkspaceLoading />}>
            {isSpeechAphasia ? (
              <SpeechAphasiaLab id={id} />
            ) : WorkspaceLab ? (
              <WorkspaceLab />
            ) : null}
          </Suspense>
          <CannotAnalyzeSection />
        </>
      ) : (
        <>
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
              above can already answer questions about the idea behind the lab.
            </p>
          </section>

          <CannotAnalyzeSection />
        </>
      )}

      <section className="panel" aria-labelledby="lab-limits">
        <h2 className="section-title" id="lab-limits">
          Known limitations
        </h2>
        <p>{feature.limitations}</p>
      </section>
    </div>
  );
}
