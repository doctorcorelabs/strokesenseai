import type { ReactNode } from 'react';

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

/** Persistent emergency panel shown across lab and content pages. */
export function EmergencyBanner() {
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

/** Honest mode label: live AI is never claimed when content is prewritten or synthetic. */
export function ModeBadge({ mode }: { mode: CoachMode }) {
  return <span className="badge badge-mode">{MODE_LABELS[mode]}</span>;
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
 */
export function ConsentNotice({
  scopeLabel,
  checked,
  onChange,
}: {
  scopeLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="consent-box">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="consent-text">
        <span>
          I agree to send {scopeLabel} through Cloudflare to the AI provider so it can generate an
          explanation. Do not include patient or identifying information. You can use the local
          guide without sending anything.
        </span>
        <span lang="id" className="consent-note-id">
          Saya setuju mengirim {scopeLabel} melalui Cloudflare ke penyedia AI agar dapat membuat
          penjelasan. Jangan sertakan informasi pasien atau data pengenal apa pun. Anda dapat
          memakai panduan lokal tanpa mengirim apa pun.
        </span>
      </span>
    </label>
  );
}
