// "How this works" panel: renders the honest per-feature explanation that
// already lives in the registry (models, retention, evalReport) but was
// never shown in the UI. The registry text is written for reviewers, so the
// models line goes through a small, conservative plain-language pass:
// insider phrases are swapped for everyday words, and at most the first two
// sentences are shown. The pass never adds a capability the registry text
// does not state; when in doubt the original wording survives.

import type { FeatureEntry } from '../../shared/registry';

// Longest, most specific phrases first. Each rule only rewords; it never
// changes what the feature claims to do.
const PHRASE_REPLACEMENTS: Array<[string, string]> = [
  // Insider parentheticals that mean nothing to a lay reader.
  [' (tool explanation endpoint)', ''],
  [' (models configured on the server)', ''],
  // Whole-clause rewrites where word swaps alone would break the grammar.
  ['Local deterministic measurement on device:', 'Everything is measured on this device:'],
  [
    'Local deterministic tracking statistics computed in the browser',
    'Tracking statistics worked out in your browser with fixed rules',
  ],
  [
    'Local deterministic analysis of a pose series in the browser',
    'Fixed-rule analysis, in your browser, of how body positions change over time',
  ],
  [
    'Local deterministic pose proxy statistics in the browser:',
    'Simple body-position estimates worked out in your browser with fixed rules:',
  ],
  [
    'Local deterministic chaining of the face and arm steps in the browser',
    'The face and arm steps run one after another under fixed rules in your browser',
  ],
  [
    'Local deterministic tap detection and rhythm statistics in the browser',
    'Fixed-rule tap counting and rhythm statistics in your browser',
  ],
  [
    'Local deterministic tracking of practice error patterns in the browser',
    'Your practice mistakes are tracked with fixed rules in your browser',
  ],
  [
    'Deterministic landmark geometry and image quality checks',
    'Fixed-rule measurements of facial landmarks and checks of image quality',
  ],
  ['Deterministic local scoring', 'Fixed-rule scoring on this device'],
  ['Rewriting is requested through the Worker AI endpoint', 'The rewrite is written by an AI service'],
  ['a deterministic local check', 'a fixed-rule check on this device'],
  ['a deterministic line-based parser', 'a fixed-rule line-by-line reader'],
  [
    'verbatim source line verification',
    'a check of each fact against the exact line it came from',
  ],
  ['a local personal data scan', 'a personal data scan on this device'],
  ['plus a local personal data check', 'plus a personal data check on this device'],
  ['a local deterministic rubric', 'a fixed-rule checklist on this device'],
  ['deterministic rubric scoring', 'fixed-rule checklist scoring'],
  ['deterministic score comparison', 'fixed-rule score comparison'],
  ['deterministic clue comparison and scoring', 'fixed-rule clue comparison and scoring'],
  ['deterministic partial credit', 'fixed-rule partial credit'],
  ['deterministic checklist scoring', 'fixed-rule checklist scoring'],
  [
    'deterministic pattern suggestions computed on device',
    'fixed-rule suggestions worked out on this device',
  ],
  ['deterministic time interval calculator', 'fixed-rule time calculator'],
  ['deterministic local alignment', 'fixed-rule matching on this device'],
  ['fixed rubric scoring', 'fixed checklist scoring'],
  [
    'per-feature data flow inventory rendered in the browser',
    'list of what data each feature uses, shown in your browser',
  ],
  [
    'Static aggregation in the browser of evaluation artifacts bundled from the repository',
    'Simple totals, worked out in your browser, of the evaluation results that ship with the site',
  ],
  ['check on this device verifies', 'check on this device makes sure'],
  [
    'weak citation support falls back to the raw cards',
    'if the citations are weak, you just see the cards themselves',
  ],
  ['session feedback narrative', 'session feedback'],
  ['verified as an exact quote', 'checked as an exact quote'],
  ['local acoustic features', 'simple sound features'],
  ['edit distance', 'how many letters differ'],
  ['simple phonetic closeness', 'how similar the sounds are'],
  ['phonetic closeness', 'how similar the sounds are'],
  ['semantic field table', 'table of related words'],
  ['guard recall', 'safety guard catch rate'],
  ['hip angle transitions', 'hip angle changes'],
  ['a hip midpoint proxy', 'the movement of your hip midpoint'],
  ['speech output uses browser text to speech', "speech uses your browser's read-aloud voice"],
  ['browser text to speech plays the commands', 'your browser reads the commands aloud'],
  ['No AI model and no clinical score', 'No AI model is used, and no clinical score is produced'],
  ['population norm table', 'comparison table against other people'],
  // Who does the work: drop the internal service name.
  ['Worker AI coach', 'AI helper'],
  ['Worker AI explanation', 'AI explanation'],
  ['Worker AI endpoint', 'AI service'],
  // Where the work happens.
  ['computed locally in the browser', 'worked out on this device, in your browser'],
  ['computed in the browser', 'worked out in your browser'],
  ['retrieved locally', 'searched on this device'],
  ['in the browser', 'in your browser'],
  ['on the device', 'on this device'],
  // Single technical words with everyday equivalents.
  ['curated', 'hand-picked'],
  ['synthetic', 'made-up'],
  ['latency', 'response times'],
  ['bisection', 'line-splitting'],
  ['elevation angle', 'height angle'],
  ['lateral deviation', 'sideways movement'],
  ['asymmetry', 'left-right difference'],
  ['verifies', 'checks'],
  ['narrate', 'talk you through'],
];

/** Capitalization-preserving swap for the one word that appears everywhere. */
function swapDeterministic(text: string): string {
  return text.replace(/deterministic/gi, (match) =>
    match.startsWith('D') ? 'Fixed-rule' : 'fixed-rule',
  );
}

/**
 * Plain-language version of a registry `models` string: one or two
 * sentences, jargon swapped for everyday words, claims unchanged.
 */
export function plainHowItWorks(models: string): string {
  let text = models.replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Honest openers in the registry become plain lead sentences.
  text = text.replace(/^No AI model\./, 'No AI model is used here.');
  text = text.replace(
    /^Fully local and deterministic:/,
    'Everything runs on this device with fixed rules:',
  );
  text = text.replace(/^Fully local:/, 'Everything runs on this device:');

  for (const [from, to] of PHRASE_REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  text = swapDeterministic(text);

  // Keep at most the first two sentences; the full registry text stays
  // available on the Scope page for reviewers.
  const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/);
  const kept = sentences.slice(0, 2).join(' ').trim();
  return kept.endsWith('.') || kept.endsWith(':') ? kept : `${kept}.`;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

export default function HowItWorks({ feature }: { feature: FeatureEntry }) {
  const how = plainHowItWorks(feature.models);
  const retention = feature.retention?.trim();
  const evalReport = feature.evalReport?.trim();
  if (!how && !retention && !evalReport) return null;

  const headingId = `how-it-works-${feature.id}`;
  return (
    <section className="panel" aria-labelledby={headingId}>
      <p className="eyebrow">Transparency</p>
      <h2 className="section-title" id={headingId}>
        How this works
      </h2>
      {how && <p>{how}</p>}
      {retention && (
        <p className="muted">
          <strong>Your data:</strong> {sentence(retention)}
        </p>
      )}
      {evalReport && (
        <p className="muted">
          <strong>Evaluation:</strong>{' '}
          {evalReport === 'Not evaluated yet'
            ? 'This experiment has not been formally evaluated yet.'
            : sentence(evalReport)}
        </p>
      )}
    </section>
  );
}
