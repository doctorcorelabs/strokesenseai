import { useEffect } from 'react';
import { FEATURES, FEATURE_GROUPS } from '../../shared/registry';
import type { FeatureEntry } from '../../shared/registry';
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

  return (
    <div className="page-stack">
      <section className="hero">
        <p className="eyebrow">StrokeSense AI Lab</p>
        <h1>Explore stroke through experimental AI</h1>
        <p className="muted">
          An AI-first playground for stroke: multimodal tools that let you try, see, and question
          how AI measures face, speech, movement, documents, and emergency decisions. Built for
          education and research, not for diagnosis. An experimental learning lab that illustrates
          how AI techniques measure signals related to stroke education. It does not diagnose,
          screen for, or rule out stroke.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={scrollToLabs}>
            Browse the labs
          </button>
          <a className="btn" href="#fast">
            Manual FAST check
          </a>
        </div>
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
                      <span className="lab-card-meta">
                        <MaturityBadge maturity={feature.maturity} />
                        <ModeBadge mode={apiConfigured ? 'live' : 'offline'} />
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
