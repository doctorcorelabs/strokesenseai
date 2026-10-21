import { FEATURES, FEATURE_GROUPS } from '../../shared/registry';
import { featureModeLabel } from '../ai/featureMode';
import { MaturityBadge } from '../components/ui';

function groupLabel(group: unknown): string {
  if (typeof group === 'string') return group;
  const record = group as { title?: string; name?: string; id?: string };
  return record.title ?? record.name ?? record.id ?? 'Labs';
}

const NOT_IMPLEMENTED = [
  'No diagnosis of stroke from a photo, video, voice recording, or scan.',
  'No telling apart a central stroke pattern from Bell palsy, and no lesion localization from a face photo.',
  'No normal result as a substitute when a detector fails. Failure is reported as failure.',
  'No clinical NIHSS scoring for a real patient, no personal stroke risk calculator, and no prognosis estimate.',
  'No medication, dose, thrombolysis, or treatment eligibility recommendations.',
  'No analysis of real patient scans (DICOM CT or MRI, clinical ASPECTS, LVO or hemorrhage detection, perfusion maps) and no retinal screening.',
  'No user accounts, patient history storage, or medical database on any server.',
  'No live hospital integration: no bed availability, emergency department queues, or ambulance routing.',
  'No open-ended AI chat without safety guards and a locked topic allowlist.',
];

export default function ScopePage() {
  const apiConfigured = Boolean(import.meta.env.VITE_API_BASE_URL?.trim());
  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">StrokeSense AI Lab / Scope</p>
        <h1>Scope, limits, and privacy</h1>
        <p className="muted">
          This page is generated from the same feature registry that powers the site, so what is
          listed here is what is actually installed. If a feature is not listed, it does not exist
          here.
        </p>
      </header>

      <section className="panel" aria-labelledby="scope-intended">
        <h2 className="section-title" id="scope-intended">
          Intended use
        </h2>
        <blockquote>
          An experimental learning lab that illustrates how AI techniques measure signals related
          to stroke education. It does not diagnose, screen for, or rule out stroke.
        </blockquote>
        <p>
          Sudden symptoms require emergency help even if this site shows no abnormality. Call 119
          in Indonesia immediately.
        </p>
      </section>

      <section aria-labelledby="scope-features">
        <h2 className="section-title" id="scope-features">
          What this version does
        </h2>
        <p>
          Not every lab here works the same way, so each one below carries a plain label that says
          how it really runs. <strong>Live AI</strong> means an AI model on a server helps answer
          or explain, only after you agree, and only when this site is connected to one.{' '}
          <strong>On-device</strong> means the lab runs entirely in your browser with fixed
          measurements or written rules, and nothing you type or record is sent anywhere.{' '}
          <strong>Simulation</strong> means you are exploring a made-up example or a scripted
          exercise: it does not measure you at all. If a label says on-device or simulation, no AI
          model was involved in that lab, whatever its name suggests.
        </p>
        {FEATURE_GROUPS.map((rawGroup) => {
          const group = groupLabel(rawGroup);
          const features = FEATURES.filter((feature) => feature.group === group);
          if (features.length === 0) return null;
          return (
            <section className="panel" key={group} aria-label={group}>
              <h3>{group}</h3>
              <ul>
                {features.map((feature) => (
                  <li key={feature.id}>
                    <a href={`#lab/${feature.id}`}>
                      <strong>{feature.name}</strong>
                    </a>{' '}
                    <MaturityBadge maturity={feature.maturity} />{' '}
                    <span className="badge badge-mode">
                      {featureModeLabel(feature, apiConfigured)}
                    </span>
                    <br />
                    <span className="muted">{feature.tagline}</span>
                    {feature.limitations && (
                      <>
                        <br />
                        <span className="muted">{feature.limitations}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>

      <section className="panel" aria-labelledby="scope-data">
        <h2 className="section-title" id="scope-data">
          Data and zero retention
        </h2>
        <ul>
          <li>
            Camera, microphone, and document processing run in your browser by default. Raw
            photos, audio, and video are not uploaded.
          </li>
          <li>
            Live AI is optional and consent-based. Only derived measurements and your question are
            sent through the Cloudflare Worker to the AI provider, never raw media by default.
          </li>
          <li>
            The application stores no medical uploads, no chat transcripts, and no analysis results
            on a server. Lab state lives in memory for the visit unless a page states otherwise.
          </li>
          <li>
            Face and voice data are biometric data. Never upload a photo or recording of another
            person, a patient, or a child without the right to do so. Every lab offers a way to
            clear the session.
          </li>
          <li>
            Hosting, model download, map, and AI providers process connection metadata under their
            own policies. This page describes application behavior, not those providers.
          </li>
        </ul>
      </section>

      <section className="panel" aria-labelledby="scope-not">
        <h2 className="section-title" id="scope-not">
          What is not implemented
        </h2>
        <ul>
          {NOT_IMPLEMENTED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="muted">
          Clinical, usability, and privacy review is required before any public medical-facing
          launch. No clinical validation or endorsement is claimed.
        </p>
      </section>
    </div>
  );
}
