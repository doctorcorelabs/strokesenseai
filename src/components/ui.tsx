import { useState, type ReactNode } from 'react';
import type { FeatureEntry } from '../../shared/registry';
import { featureModeLabel } from '../ai/featureMode';

export type CoachMode = 'live' | 'offline' | 'synthetic' | 'simulation' | 'emergency';
export type Maturity = 'concept' | 'lab' | 'validated';

/**
 * The single source of mode labels for the whole product. Badges, the top
 * bar, status panels, and the AI coach all read from this record so one
 * state never gets two different names on the same screen.
 */
export const MODE_LABELS: Record<CoachMode, string> = {
  live: 'Live AI',
  offline: 'Offline guide',
  synthetic: 'Synthetic demo',
  simulation: 'Simulation',
  emergency: 'Emergency guidance',
};

const MATURITY_LABELS: Record<Maturity, string> = {
  concept: 'Concept demo',
  lab: 'Experimental lab',
  validated: 'Validated',
};

const MATURITY_CLASSES: Record<Maturity, string> = {
  concept: 'badge badge-concept',
  lab: 'badge badge-lab',
  validated: 'badge badge-validated',
};

/**
 * Persistent emergency panel shown across lab and content pages.
 *
 * The default "full" variant carries the complete bilingual text. The
 * "slim" variant is one compact strip for dense lab pages: the core
 * English message and the Call 119 action share a row, and the Indonesian
 * text is condensed to a single smaller line underneath instead of a
 * full paragraph.
 */
export function EmergencyBanner({ variant = 'full' }: { variant?: 'full' | 'slim' } = {}) {
  if (variant === 'slim') {
    return (
      <aside className="panel emergency-note emergency-note-slim" aria-label="Emergency guidance">
        <div className="emergency-slim-row">
          <p>
            <strong>Sudden symptoms? Act now.</strong> Sudden face drooping, arm weakness, or
            speech difficulty can be signs of stroke. Call <strong>119</strong> in Indonesia now,
            even if the symptoms have stopped. Do not wait for any tool on this site.
          </p>
          <a className="btn btn-danger" href="tel:119">
            Call 119 now
          </a>
        </div>
        <p lang="id" className="emergency-note-id">
          Wajah mencong, lengan lemah, atau bicara sulit mendadak dapat menjadi tanda stroke.
          Segera hubungi <strong>119</strong> di Indonesia, meskipun gejala sudah berhenti. Jangan
          menunggu tool apa pun di situs ini.
        </p>
      </aside>
    );
  }
  return (
    <aside className="panel emergency-note" aria-labelledby="emergency-banner-title">
      <h2 id="emergency-banner-title" className="section-title">
        Sudden symptoms? Act now.
      </h2>
      <p>
        Sudden face drooping, arm weakness, speech difficulty, vision changes, loss of balance, or
        a severe unexplained headache can be signs of stroke. Call <strong>119</strong> in
        Indonesia now, even if the symptoms have stopped. Do not wait for any tool on this site.
      </p>
      <p lang="id" className="muted">
        Wajah mencong mendadak, lengan lemah, bicara sulit, perubahan penglihatan, kehilangan
        keseimbangan, atau sakit kepala hebat tanpa sebab yang jelas dapat menjadi tanda stroke.
        Segera hubungi <strong>119</strong> di Indonesia, meskipun gejala sudah berhenti. Jangan
        menunggu tool apa pun di situs ini.
      </p>
      <a className="btn btn-danger" href="tel:119">
        Call 119 now
      </a>
    </aside>
  );
}

/**
 * Honest mode label: live AI is never claimed when content is prewritten or
 * synthetic. Callers that know the feature pass it together with whether the
 * API is configured, and the label comes from featureModeLabel, derived from
 * that feature's own registry entry, never from one global switch. Callers
 * that only know a coach or session state keep passing mode.
 */
export function ModeBadge({
  mode,
  feature,
  apiConfigured,
}: {
  mode?: CoachMode;
  feature?: FeatureEntry;
  apiConfigured?: boolean;
}) {
  if (feature) {
    return (
      <span className="badge badge-mode">{featureModeLabel(feature, Boolean(apiConfigured))}</span>
    );
  }
  return <span className="badge badge-mode">{MODE_LABELS[mode ?? 'offline']}</span>;
}

/** Feature maturity label from the project registry: concept, lab, or validated. */
export function MaturityBadge({ maturity }: { maturity: Maturity }) {
  return <span className={MATURITY_CLASSES[maturity]}>{MATURITY_LABELS[maturity]}</span>;
}

/**
 * First-class failure state. A failed analysis is shown as a failure,
 * never replaced with a normal-looking result.
 *
 * The role defaults to "note": a static demonstration of this state is
 * information, not an event, and must not be announced as an alert on page
 * load. Callers showing a real, just-occurred failure pass role="alert".
 */
export function CannotAnalyzePanel({
  reason,
  guidance,
  role = 'note',
}: {
  reason: string;
  guidance: string;
  role?: 'note' | 'alert';
}) {
  return (
    <section className="cannot-panel" role={role} aria-labelledby="cannot-analyze-title">
      <h3 id="cannot-analyze-title">Cannot analyze</h3>
      <p>{reason}</p>
      <p>{guidance}</p>
      <p className="cannot-required">This result does not mean everything is normal.</p>
      <p>
        If you are experiencing sudden new symptoms, call <strong>119</strong> in Indonesia now.
      </p>
    </section>
  );
}

/** Uncertainty statement that sits next to a result, not in a footer. */
export function UncertaintyNote({ children }: { children: ReactNode }) {
  return (
    <div className="uncertainty-note" role="note">
      {children}
    </div>
  );
}

/**
 * Controlled consent notice. The caller owns the checked state so consent
 * can be reset whenever the tool, selection, or scope changes.
 *
 * Presentation only: the bilingual consent text itself is unchanged. The
 * English and Indonesian blocks are visually separated, the Indonesian
 * line renders smaller and muted, and the scope label is styled as a
 * distinct token so it does not read as a language mix-up inside either
 * sentence. Callers may pass `collapsible` to fold the notice into a
 * one-line summary once consent has been given; the Details button
 * expands the full text again.
 */
export function ConsentNotice({
  scopeLabel,
  checked,
  onChange,
  collapsible = false,
}: {
  scopeLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (collapsible && checked && !expanded) {
    return (
      <div className="consent-box consent-box-collapsed">
        <label className="consent-collapsed-main">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>
            Consent given for <span className="consent-scope-name">{scopeLabel}</span>
          </span>
        </label>
        <button
          type="button"
          className="btn btn-ghost consent-toggle"
          aria-expanded={false}
          onClick={() => setExpanded(true)}
        >
          Details
        </button>
      </div>
    );
  }

  const notice = (
    <label className="consent-box">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="consent-text">
        <span>
          I agree to send <span className="consent-scope-name">{scopeLabel}</span> through
          Cloudflare to the AI provider so it can generate an explanation. Do not include patient
          or identifying information. You can use the local guide without sending anything.
        </span>
        <span lang="id" className="consent-note-id">
          Saya setuju mengirim <span className="consent-scope-name">{scopeLabel}</span> melalui
          Cloudflare ke penyedia AI agar dapat membuat penjelasan. Jangan sertakan informasi pasien
          atau data pengenal apa pun. Anda dapat memakai panduan lokal tanpa mengirim apa pun.
        </span>
      </span>
    </label>
  );

  if (!collapsible) return notice;

  return (
    <div className="consent-block">
      {notice}
      {checked && (
        <button
          type="button"
          className="btn btn-ghost consent-toggle"
          aria-expanded={true}
          onClick={() => setExpanded(false)}
        >
          Hide details
        </button>
      )}
    </div>
  );
}
