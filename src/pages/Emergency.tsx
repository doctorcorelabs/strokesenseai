import { useState } from 'react';

const HANDOVER_ITEMS = [
  'Your exact location and a nearby landmark',
  'What changed, and what you noticed first',
  'When symptoms started, or when the person was last known well',
  'Whether the person is conscious and breathing',
  'Medical conditions and medicines, if easy to find',
];

export default function EmergencyPage() {
  const [checked, setChecked] = useState<boolean[]>(HANDOVER_ITEMS.map(() => false));

  function toggle(index: number) {
    setChecked((previous) => previous.map((value, i) => (i === index ? !value : value)));
  }

  return (
    <div className="page-stack">
      <header className="page-heading">
        <p className="eyebrow">StrokeSense AI Lab / Emergency</p>
        <h1>Emergency help in Indonesia</h1>
        <p className="muted">
          For possible stroke signs, calling comes first. Everything on this page is preparation
          that must never delay the call.
        </p>
      </header>

      <section className="panel alert-emergency" aria-labelledby="emergency-call">
        <h2 className="section-title" id="emergency-call">
          Call 119 now
        </h2>
        <p>
          119 is Indonesia&apos;s national medical emergency number. Sudden face drooping, arm
          weakness, speech difficulty, vision changes, loss of balance, or a severe unexplained
          headache can signal stroke, even if symptoms stop.
        </p>
        <a className="btn btn-primary" href="tel:119">
          Call 119 now
        </a>
        <p className="muted">
          Outside Indonesia, or if 119 is unreachable, use your verified local emergency service.
        </p>
      </section>

      <section className="panel" aria-labelledby="emergency-handover">
        <h2 className="section-title" id="emergency-handover">
          Handover checklist
        </h2>
        <p className="muted">
          Five things that help the dispatcher and the receiving team. Missing information is
          never a reason to wait before calling. Your ticks stay in this visit only and are not
          uploaded.
        </p>
        <ul className="check-list">
          {HANDOVER_ITEMS.map((item, index) => (
            <li key={item}>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={checked[index]}
                  onChange={() => toggle(index)}
                />{' '}
                {item}
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="emergency-where">
        <h2 className="section-title" id="emergency-where">
          Where to go
        </h2>
        <p>
          Ask the 119 dispatcher which facility is appropriate. An ambulance team can start
          assessment on the way and warn the receiving hospital.
        </p>
        <p>
          This site does not include a facility directory, and this page makes no claim about
          live availability, opening hours, bed capacity, or the nearest stroke center. A
          limited, clearly dated directory may be added later; a stale list presented as current
          would be worse than none.
        </p>
        <p>
          <a
            href="https://www.google.com/maps/search/emergency+hospital+near+me+Indonesia"
            target="_blank"
            rel="noreferrer"
          >
            Search for emergency hospitals on Google Maps
          </a>{' '}
          (external link: opening it shares the search with Google).
        </p>
      </section>
    </div>
  );
}
