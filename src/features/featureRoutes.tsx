// Route map for the Phase 1 feature labs.
//
// Every registry feature id now has a real interactive component built by
// the feature teams under src/features/<group>/. This module is the single
// place that knows which component serves which lab route, so LabPage only
// has to ask for a component by id and fall back to its generic walkthrough
// when an id is not listed here.
//
// Two kinds of components exist:
// - FULL_PAGE_LABS: components that bring their own page heading, maturity
//   and mode badges, and emergency banner. LabPage renders them on their
//   own, with none of the generic lab page chrome around them.
// - WORKSPACE_LABS: components designed to sit inside the lab page shell
//   (heading, emergency banner, about panel, coach, limitations), in the
//   place of the generic guided walkthrough panel.
//
// Each group is loaded with React.lazy so the bundle is split per feature
// group and a lab only downloads its own workspace code.

import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

type LabComponent = LazyExoticComponent<ComponentType>;

/** Simple loading placeholder shown while a lab chunk is fetched. */
export function LabLoading() {
  return (
    <div className="page-stack">
      <section className="panel">
        <p className="muted" role="status">
          Loading this lab...
        </p>
      </section>
    </div>
  );
}

/** Loading placeholder for a workspace inside the lab page shell. */
export function WorkspaceLoading() {
  return (
    <section className="panel">
      <p className="muted" role="status">
        Loading the interactive lab...
      </p>
    </section>
  );
}

export const FULL_PAGE_LABS: Record<string, LabComponent> = {
  'digital-fast-multimodal': lazy(() =>
    import('./fast').then((m) => ({ default: m.DigitalFastMultimodalLab })),
  ),
  'gaze-tracker': lazy(() =>
    import('./vision-rest').then((m) => ({
      default: m.FEATURE_COMPONENTS['gaze-tracker'] ?? m.GazeTracker,
    })),
  ),
  'neglect-explorer': lazy(() =>
    import('./vision-rest').then((m) => ({
      default: m.FEATURE_COMPONENTS['neglect-explorer'] ?? m.NeglectExplorer,
    })),
  ),
  'scan-explainer': lazy(() =>
    import('./vision-rest').then((m) => ({
      default: m.FEATURE_COMPONENTS['scan-explainer'] ?? m.ScanExplainer,
    })),
  ),
  'nihss-trainer': lazy(() =>
    import('./clinical-trainer').then((m) => ({ default: m.NihssTrainer })),
  ),
  'stroke-code-simulator': lazy(() =>
    import('./clinical-trainer').then((m) => ({ default: m.StrokeCodeSimulator })),
  ),
  'discharge-lens': lazy(() =>
    import('./document-clinical').then((m) => ({ default: m.DischargeLens })),
  ),
  'risk-extractor': lazy(() =>
    import('./document-clinical').then((m) => ({ default: m.RiskExtractor })),
  ),
  'model-bench': lazy(() =>
    import('./rebuild/ports').then((m) => ({ default: m.ModelBenchPort })),
  ),
  'transparency-dashboard': lazy(() =>
    import('./research-bench').then((m) => ({
      default: m.TransparencyDashboardPage,
    })),
  ),
  // R1 rebuild labs. Each one is a self-contained page built on the
  // shared LabShell (own heading, badges, slim emergency banner, stepper,
  // and About section), so they belong with the full page labs here even
  // though their ids are new registry entries, not legacy ones.
  'fast-live-check': lazy(() =>
    import('./rebuild/fast-live/FastLiveCheck').then((m) => ({
      default: m.default,
    })),
  ),
  'face-lab': lazy(() =>
    import('./rebuild/face-lab').then((m) => ({ default: m.FaceLab })),
  ),
  'lesion-localizer': lazy(() =>
    import('./rebuild/lesion-localizer').then((m) => ({ default: m.LesionLocalizer })),
  ),
  'movement-lab': lazy(() =>
    import('./rebuild/movement-lab').then((m) => ({ default: m.MovementLab })),
  ),
  'speech-lab': lazy(() =>
    import('./rebuild/speech-lab').then((m) => ({ default: m.default })),
  ),
  'document-studio': lazy(() =>
    import('./rebuild/document-studio').then((m) => ({
      default: m.DocumentStudio,
    })),
  ),
  'ask-the-lab': lazy(() =>
    import('./rebuild/ask').then((m) => ({ default: m.AskTheLab })),
  ),
  'guideline-navigator': lazy(() =>
    import('./rebuild/ports').then((m) => ({ default: m.GuidelinePort })),
  ),
  'privacy-shield': lazy(() =>
    import('./rebuild/ports').then((m) => ({ default: m.PrivacyShieldPort })),
  ),
};

export const WORKSPACE_LABS: Record<string, LabComponent> = {
  'face-analyzer': lazy(() =>
    import('./vision-face').then((m) => ({ default: m.FaceAnalyzerLab })),
  ),
  'face-dynamics': lazy(() =>
    import('./vision-face').then((m) => ({ default: m.FaceDynamicsLab })),
  ),
  'speech-analyzer': lazy(() =>
    import('./speech-core').then((m) => ({
      default: m.SPEECH_CORE_COMPONENTS['speech-analyzer'] ?? m.SpeechAnalyzer,
    })),
  ),
  'nihss-language-assistant': lazy(() =>
    import('./speech-core').then((m) => ({
      default:
        m.SPEECH_CORE_COMPONENTS['nihss-language-assistant'] ??
        m.NihssLanguageAssistant,
    })),
  ),
  'arm-drift': lazy(() =>
    import('./motor-upper').then((m) => ({ default: m.ArmDriftLab })),
  ),
  'finger-tapping': lazy(() =>
    import('./motor-upper').then((m) => ({ default: m.FingerTappingLab })),
  ),
  'balance-lab': lazy(() =>
    import('./motor-body').then((m) => ({ default: m.BalanceLab })),
  ),
  'fast-vision-check': lazy(() =>
    import('./motor-body').then((m) => ({ default: m.FastVisionCheck })),
  ),
  'mimic-detective': lazy(() =>
    import('./clinical-cases').then((m) => ({
      default: m.CLINICAL_CASE_COMPONENTS['mimic-detective'] ?? m.MimicDetective,
    })),
  ),
  'localization-challenge': lazy(() =>
    import('./clinical-cases').then((m) => ({
      default:
        m.CLINICAL_CASE_COMPONENTS['localization-challenge'] ??
        m.LocalizationChallenge,
    })),
  ),
  'virtual-patient-osce': lazy(() =>
    import('./clinical-cases').then((m) => ({
      default:
        m.CLINICAL_CASE_COMPONENTS['virtual-patient-osce'] ??
        m.VirtualPatientOsce,
    })),
  ),
  'plain-translator': lazy(() =>
    import('./document-knowledge').then((m) => ({
      default: m.PlainTranslator,
    })),
  ),
  'adaptive-tutor': lazy(() =>
    import('./research-platform').then((m) => ({ default: m.AdaptiveTutor })),
  ),
};

/**
 * The speech and aphasia labs share one dispatcher component that takes the
 * feature id as a prop, unlike the other workspaces which take no props.
 */
export const SpeechAphasiaLab = lazy(() => import('./speech-aphasia'));

export const SPEECH_APHASIA_IDS: ReadonlySet<string> = new Set([
  'aphasia-expression',
  'aphasia-communication',
  'comprehension-check',
]);

/**
 * Workspace labs whose component renders its own EmergencyBanner at the top
 * of its workspace. LabPage skips its shell banner for these ids so the
 * banner appears exactly once. The components keep their own banner; this
 * list only tells the shell to step aside. Verified by grep: these are the
 * only workspace components with an unconditional self-rendered banner.
 * guideline-navigator left this set in R1 because it is no longer a
 * workspace lab: its rebuild port is a full page lab (see FULL_PAGE_LABS).
 */
export const SELF_BANNERED_IDS: ReadonlySet<string> = new Set([
  'nihss-language-assistant',
  'plain-translator',
]);
