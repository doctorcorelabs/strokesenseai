import { useEffect } from 'react';
import { Camera, Mic, Type, MousePointerClick, Ban, Clock, Stethoscope, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FEATURES, FEATURE_GROUPS, R1_CATALOG } from '../../shared/registry';
import type { FeatureEntry, FeatureInput, FeatureZone } from '../../shared/registry';
import { MaturityBadge, ModeBadge, MODE_LABELS } from '../components/ui';
import { takePendingGroup } from '../nav-target';

function groupLabel(group: unknown): string {
  if (typeof group === 'string') return group;
  const record = group as { title?: string; name?: string; id?: string };
  return record.title ?? record.name ?? record.id ?? 'Labs';
}

function featuresInGroup(group: string): FeatureEntry[] {
  return FEATURES.filter((feature) => feature.group === group);
}

/** Scroll to the lab grid without changing the hash route. */
function scrollToLabs(): void {
  document.getElementById('labs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Friendly label for the main thing a lab asks from the visitor, derived from
 * the registry inputKinds. Passive kinds (synthetic demos, session history,
 * repository artifacts) are skipped; a lab with no active input kind left is
 * labeled "No input".
 */
const INPUT_KIND_LABELS: Record<string, string> = {
  camera: 'Camera',
  'photo-upload': 'Camera',
  microphone: 'Microphone',
  text: 'Text',
  'text-question': 'Text',
  pdf: 'Text',
  touch: 'Screen taps',
  mouse: 'Screen taps',
  'library-case': 'Screen taps',
};

const INPUT_LABEL_ICONS: Record<string, LucideIcon> = {
  Camera,
  Microphone: Mic,
  Text: Type,
  'Screen taps': MousePointerClick,
  'No input': Ban,
};

function inputLabel(feature: FeatureEntry): string {
  for (const kind of feature.inputKinds) {
    const label = INPUT_KIND_LABELS[kind];
    if (label) return label;
  }
  return 'No input';
}

/**
 * Rough time a first visit to each lab takes, kept as a local static map so
 * the registry stays untouched. Based on each lab's actual step count.
 */
const DURATION_LABELS: Record<string, string> = {
  'digital-fast-multimodal': 'About 3 min',
  'face-analyzer': 'About 2 min',
  'face-dynamics': '5-10 min',
  'gaze-tracker': 'About 5 min',
  'neglect-explorer': 'About 3 min',
  'scan-explainer': 'About 1 min',
  'speech-analyzer': 'About 3 min',
  'aphasia-expression': 'About 3 min',
  'aphasia-communication': 'About 1 min',
  'comprehension-check': '5-10 min',
  'nihss-language-assistant': 'About 5 min',
  'arm-drift': 'About 2 min',
  'finger-tapping': 'About 2 min',
  'balance-lab': 'About 5 min',
  'fast-vision-check': 'About 3 min',
  'nihss-trainer': '5-10 min',
  'stroke-code-simulator': '5-10 min',
  'mimic-detective': '20-30 min',
  'localization-challenge': 'About 2 min',
  'virtual-patient-osce': 'About 10 min',
  'discharge-lens': 'About 3 min',
  'risk-extractor': 'About 2 min',
  'guideline-navigator': 'About 2 min',
  'plain-translator': 'About 1 min',
  'model-bench': 'About 3 min',
  'privacy-shield': 'About 1 min',
  'adaptive-tutor': 'About 5 min',
  'transparency-dashboard': 'About 2 min',
};

/** Labs aimed at clinicians in training rather than the general public. */
const CLINICIAN_TRAINING_IDS = new Set([
  'nihss-trainer',
  'nihss-language-assistant',
  'stroke-code-simulator',
  'virtual-patient-osce',
]);

/** Rebuilt hub zones, in the order a first-time visitor meets them. */
const ZONE_ORDER: FeatureZone[] = ['check', 'play', 'think', 'review'];

const ZONE_LABELS: Record<FeatureZone, string> = {
  check: 'Check your body',
  play: 'Play a case',
  think: 'Understand and ask',
  review: 'See how the AI works',
};

const INPUT_ICONS_V2: Record<FeatureInput, LucideIcon> = {
  camera: Camera,
  microphone: Mic,
  text: Type,
  touch: MousePointerClick,
  none: Ban,
};

const INPUT_LABELS_V2: Record<FeatureInput, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  text: 'Text',
  touch: 'Screen taps',
  none: 'No input',
};

/** Facts row for a rebuilt card, driven by the registry v2 fields. */
function RebuildFacts({ feature }: { feature: FeatureEntry }) {
  return (
    <span className="lab-card-facts">
      {(feature.inputs ?? []).map((input) => {
        const InputIcon = INPUT_ICONS_V2[input];
        return (
          <span className="fact-chip" key={input}>
            <InputIcon size={14} aria-hidden="true" />
            {INPUT_LABELS_V2[input]}
          </span>
        );
      })}
      {typeof feature.minutes === 'number' && (
        <span className="fact-chip">
          <Clock size={14} aria-hidden="true" />
          About {feature.minutes} min
        </span>
      )}
    </span>
  );
}

function RebuildCard({
  feature,
  featured = false,
  apiConfigured,
}: {
  feature: FeatureEntry;
  featured?: boolean;
  apiConfigured: boolean;
}) {
  return (
    <a
      className={featured ? 'lab-card lab-card-featured' : 'lab-card'}
      href={`#lab/${feature.id}`}
    >
      {featured && (
        <span className="fact-chip fact-chip-flagship">
          <Star size={14} aria-hidden="true" />
          Flagship
        </span>
      )}
      <strong>{feature.displayName ?? feature.name}</strong>
      <span className="muted">{feature.benefit ?? feature.tagline}</span>
      <RebuildFacts feature={feature} />
      <span className="lab-card-meta">
        <MaturityBadge maturity={feature.maturity} />
        <ModeBadge feature={feature} apiConfigured={apiConfigured} />
        <span aria-hidden="true">Open lab</span>
      </span>
    </a>
  );
}

function FeatureFacts({ feature }: { feature: FeatureEntry }) {
  const label = inputLabel(feature);
  const InputIcon = INPUT_LABEL_ICONS[label];
  return (
    <span className="lab-card-facts">
      <span className="fact-chip">
        <InputIcon size={14} aria-hidden="true" />
        {label}
      </span>
      <span className="fact-chip">
        <Clock size={14} aria-hidden="true" />
        {DURATION_LABELS[feature.id] ?? 'About 2 min'}
      </span>
      {CLINICIAN_TRAINING_IDS.has(feature.id) && (
        <span className="fact-chip fact-chip-audience">
          <Stethoscope size={14} aria-hidden="true" />
          Clinician training
        </span>
      )}
    </span>
  );
}

export default function HomePage() {
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  let cardNumber = 0;

  // Footer group shortcuts record their target section before Home mounts;
  // consume it once and scroll there.
  useEffect(() => {
    const groupId = takePendingGroup();
    if (!groupId) return;
    document.getElementById(groupId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const flagship = R1_CATALOG.find((feature) => feature.id === 'fast-live-check');
  const rebuildZones = ZONE_ORDER.map((zone) => ({
    zone,
    features: R1_CATALOG.filter(
      (feature) => feature.id !== 'fast-live-check' && feature.zone === zone,
    ),
  })).filter((entry) => entry.features.length > 0);

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">StrokeSense AI Lab</p>
        <h1>Explore stroke through experimental AI</h1>
        <p className="muted">
          An AI-first playground where you can try, see, and question how AI measures face,
          speech, movement, documents, and emergency decisions in stroke care. It is an
          experimental learning lab for education and research: it does not diagnose, screen for,
          or rule out stroke.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#lab/fast-live-check">
            Try the flagship lab
          </a>
          <button className="btn" type="button" onClick={scrollToLabs}>
            Browse the labs
          </button>
        </div>
      </section>

      <section aria-labelledby="start-here-title">
        <p className="eyebrow">New here?</p>
        <h2 className="section-title" id="start-here-title">
          Start here
        </h2>
        <p className="muted">
          The rebuilt labs come first: a smaller set of experiments, each one measuring what
          its name says, in three steps (see an example, try it, read your result). Start with
          the flagship, then pick a zone. The classic catalog of 28 labs is still below.
        </p>
        {flagship && (
          <div className="hub-grid start-here-grid">
            <RebuildCard feature={flagship} featured apiConfigured={apiConfigured} />
          </div>
        )}
        {rebuildZones.map(({ zone, features }) => (
          <div key={zone}>
            <p className="eyebrow">{ZONE_LABELS[zone]}</p>
            <div className="hub-grid">
              {features.map((feature) => (
                <RebuildCard
                  feature={feature}
                  key={feature.id}
                  apiConfigured={apiConfigured}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="panel" aria-label="AI status">
        <p className="eyebrow">{MODE_LABELS[apiConfigured ? 'live' : 'offline']}</p>
        <p>
          {apiConfigured
            ? 'A live AI endpoint is configured. Labs can request an AI explanation after you consent to data sharing, and every answer is labeled as generated.'
            : 'Live AI is not configured, so every lab shows its prewritten guide and labels it honestly as an offline guide. Nothing is sent anywhere.'}
        </p>
      </aside>

      <section id="labs" aria-label="Experiment labs">
        <p className="eyebrow">Full catalog</p>
        <h2 className="section-title">All experiments (classic catalog)</h2>
        <p className="muted">
          The original 28 labs, in their original groups. Several of them now open their
          rebuilt successor instead of the old workspace, and one, the Eye and Gaze Tracker,
          was retired; its page explains why.
        </p>
        {FEATURE_GROUPS.map((rawGroup) => {
          const group = groupLabel(rawGroup);
          const features = featuresInGroup(group);
          if (features.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`group-${group.replace(/\s+/g, '-')}`}>
              <p className="eyebrow">Lab group</p>
              <h2 className="section-title" id={`group-${group.replace(/\s+/g, '-')}`}>
                {group}
              </h2>
              <div className="hub-grid">
                {features.map((feature) => {
                  cardNumber += 1;
                  const number = String(cardNumber).padStart(2, '0');
                  return (
                    <a className="lab-card" href={`#lab/${feature.id}`} key={feature.id}>
                      <span className="lab-card-number">
                        {number} / {feature.group}
                      </span>
                      <strong>{feature.name}</strong>
                      <span className="muted">{feature.tagline}</span>
                      <FeatureFacts feature={feature} />
                      <span className="lab-card-meta">
                        <MaturityBadge maturity={feature.maturity} />
                        <ModeBadge feature={feature} apiConfigured={apiConfigured} />
                        <span aria-hidden="true">Open lab</span>
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </section>

      <aside className="panel alert-emergency" aria-label="Emergency notice">
        <h2 className="section-title">Sudden symptoms? Act now.</h2>
        <p>
          Sudden face drooping, arm weakness, speech difficulty, vision changes, loss of balance,
          or a severe unexplained headache can signal stroke. Call 119 in Indonesia immediately,
          even if symptoms disappear. No result from any lab on this site can rule out stroke.
        </p>
        <a className="btn btn-primary" href="tel:119">
          Call 119 now
        </a>
      </aside>
    </div>
  );
}
