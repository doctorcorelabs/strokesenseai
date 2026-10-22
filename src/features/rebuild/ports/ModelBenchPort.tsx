import { useState } from 'react';
import { getFeature } from '../../../../shared/registry';
import { LabShell } from '../../../shell';
import ModelBench from '../../research-bench/ModelBench';
import { allBenchCases, type BenchCase } from '../../research-bench/data';
import './ports.css';

/**
 * The three curated starting cases for this port. They are resolved
 * against the bench's own case list, so the text and the picker label
 * shown here always match what the bench offers in its dropdown.
 * Clicking a card selects that case: the port keeps the selection and
 * passes it to the bench as initialCaseId (with a key remount), so the
 * bench opens on the chosen case when the visitor starts trying.
 */
const CURATED: { caseId: string; title: string; watchFor: string }[] = [
  {
    caseId: 'synthetic-fast-meaning',
    title: 'Case 1: a general education question',
    watchFor:
      'All three configurations can answer. Compare how the live coach replies differ from the prewritten offline guide, and check latency and rubric flags side by side.',
  },
  {
    caseId: 'bank-0',
    title: 'Case 2: a symptom report, stopped by the guard',
    watchFor:
      'This case reads like someone reporting symptoms right now. The emergency guard intercepts it locally before consent and before any network call, so every configuration shows the emergency guidance instead of a model answer.',
  },
  {
    caseId: 'bank-42',
    title: 'Case 3: a personal dosage question, outside the scope',
    watchFor:
      'This asks for a personal medicine dose, which the coach must not answer. Watch which configurations refuse or stay silent, and whether the rubric flags dosage-like language in any output that does appear.',
  },
];

/** The option label exactly as the bench dropdown renders it. */
function pickerLabel(benchCase: BenchCase): string {
  return benchCase.source === 'redteam-bank'
    ? `[${benchCase.category}] ${benchCase.text}`
    : benchCase.text;
}

function BenchExample({
  selectedCaseId,
  onSelect,
}: {
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
}) {
  const cases = allBenchCases();
  return (
    <>
      <h2 className="section-title">Start from a curated case</h2>
      <p>
        The bench runs one test case through several configurations of the same AI coach and
        places the outputs side by side. These three cases are the recommended way in: an
        ordinary education question, a symptom report the guard must stop, and a personal
        dosage question that sits outside what the coach may answer. Select a case here and
        the bench opens on it when you start trying; you can always change it inside the
        bench.
      </p>
      <p className="port-example-label">Example result</p>
      <div className="port-card-list">
        {CURATED.map((entry) => {
          const benchCase = cases.find((item) => item.id === entry.caseId);
          if (!benchCase) return null;
          const isSelected = entry.caseId === selectedCaseId;
          return (
            <article
              className={isSelected ? 'port-card port-card-selected' : 'port-card'}
              key={entry.caseId}
            >
              <h3>{entry.title}</h3>
              <p className="port-card-case">&ldquo;{benchCase.text}&rdquo;</p>
              <p className="muted">
                In the bench, this is the Test case entry:{' '}
                <strong>{pickerLabel(benchCase)}</strong>
              </p>
              <p>{entry.watchFor}</p>
              <button
                type="button"
                className={isSelected ? 'btn btn-primary' : 'btn'}
                aria-pressed={isSelected}
                onClick={() => onSelect(entry.caseId)}
              >
                {isSelected ? 'Selected for the bench' : 'Open the bench with this case'}
              </button>
            </article>
          );
        })}
      </div>
      <p className="muted">
        The full case list inside the bench also contains the raw red-team paraphrase bank.
        The three cases above are the curated path; the bank stays available for deeper
        testing.
      </p>
    </>
  );
}

/**
 * Rebuild port for the Model Experiment Bench: the existing bench,
 * mounted inside the shared shell with a curated-case preselection on
 * top. The bench carries its own results and history, so this port
 * passes no separate result sheet.
 */
export default function ModelBenchPort() {
  const feature = getFeature('model-bench');
  const [selectedCaseId, setSelectedCaseId] = useState<string>(CURATED[0]?.caseId ?? '');
  if (!feature) return null;
  return (
    <LabShell
      feature={feature}
      example={<BenchExample selectedCaseId={selectedCaseId} onSelect={setSelectedCaseId} />}
      tryIt={<ModelBench key={selectedCaseId} initialCaseId={selectedCaseId} />}
    />
  );
}
