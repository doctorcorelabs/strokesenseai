import type { FeatureEntry } from '../../shared/registry';

/**
 * Honest per-feature mode, derived from the feature's own registry entry.
 *
 * The hub used to stamp one global label on every card (Live AI whenever an
 * API URL was configured), which claimed AI for deterministic local tools
 * and hid which features are simulations. This helper reads the registry
 * fields that already describe the truth for each feature: `models` says
 * whether a model is involved at all and where it runs, and `inputKinds`
 * says whether a synthetic demo is a first-class input.
 *
 * Kinds:
 * - 'simulation': no AI model, and a synthetic demo is a primary input, so
 *   the experience itself is a simulation or synthetic series.
 * - 'on-device': no AI model and no synthetic demo input; a deterministic
 *   tool that runs locally on whatever the user provides.
 * - 'ai': the feature's main job is done by the Worker AI endpoint, so the
 *   honest label depends on whether that endpoint is configured.
 * - 'mixed': a local deterministic core plus an optional Worker AI layer
 *   (usually a coach that only explains finished results).
 */
export type FeatureModeKind = 'simulation' | 'on-device' | 'ai' | 'mixed';

/**
 * Explicit corrections where the plain heuristic mislabels a feature. Each
 * entry exists because the registry lists `synthetic-demo` among the input
 * kinds only to say that sample content ships with the tool, while the tool
 * itself performs a real deterministic operation on the user's own input.
 * Calling these "Simulation" would claim the analysis is simulated when it
 * is not; "On this device" is the honest label.
 */
const KIND_OVERRIDES: Partial<Record<string, FeatureModeKind>> = {
  // Sample discharge documents are demo inputs for a deterministic parser
  // that primarily runs on text the user pastes.
  'discharge-lens': 'on-device',
  // Sample fictional histories are demo inputs for a deterministic
  // extractor that primarily runs on text the user pastes.
  'risk-extractor': 'on-device',
  // The synthetic demo is a sample text; the scanner performs a real
  // deterministic scan of whatever text is pasted, entirely on device.
  'privacy-shield': 'on-device',
};

export function featureModeKind(feature: FeatureEntry): FeatureModeKind {
  const override = KIND_OVERRIDES[feature.id];
  if (override) return override;

  const models = feature.models ?? '';

  // Local core plus an optional Worker AI layer (coach or explanation).
  if (/optional worker ai/i.test(models)) return 'mixed';

  // The Worker AI endpoint does the feature's main job.
  if (/worker ai endpoint|openrouter/i.test(models)) return 'ai';

  // No AI model: deterministic work described as fully local. A synthetic
  // demo as a first-class input makes the experience a simulation;
  // otherwise it is a local tool that runs on the user's own input.
  if (/no ai model|fully local|local deterministic|deterministic local/i.test(models)) {
    return feature.inputKinds.includes('synthetic-demo') ? 'simulation' : 'on-device';
  }

  // Conservative fallback: never claim AI that the registry does not name.
  return 'on-device';
}

/**
 * User-facing badge label for one feature. Only the 'ai' kind depends on
 * configuration: without a configured endpoint the same feature honestly
 * falls back to its prewritten guide.
 */
export function featureModeLabel(feature: FeatureEntry, apiConfigured: boolean): string {
  switch (featureModeKind(feature)) {
    case 'simulation':
      return 'Simulation';
    case 'on-device':
      return 'On this device';
    case 'mixed':
      return 'Mixed: on-device + optional AI';
    case 'ai':
      return apiConfigured ? 'Live AI' : 'Offline guide';
  }
}
