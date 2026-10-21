// NIHSS Co-Pilot Trainer UI.
//
// TRAINING TOOL ONLY. All patients are fictional. This module teaches the
// structure of the NIH Stroke Scale with fixed case keys and deterministic
// feedback. It is not NIHSS certification, not an official scoring
// reference, and it has no mode for assessing a real patient.

import { useState } from 'react';
import { getFeature } from '../../../shared/registry';
import { EmergencyBanner, MaturityBadge, ModeBadge, UncertaintyNote } from '../../components/ui';
import HowItWorks from '../../components/HowItWorks';
import {
  NIHSS_CASES,
  NIHSS_ITEMS,
  drillsForItem,
  getNihssCase,
  getNihssItem,
  scoreNihssCase,
  type CaseScoreResult,
  type NihssScore,
} from './nihss';

type TrainerMode = 'guide' | 'exam';

function scoreLabel(value: NihssScore | null): string {
  if (value === null) return 'No answer';
  if (value === 'UN') return 'UN';
  return String(value);
}

function statusText(result: CaseScoreResult, itemId: string): string {
  const entry = result.items.find((item) => item.itemId === itemId);
  if (!entry) return '';
  if (entry.status === 'exact') return 'Exact match';
  if (entry.status === 'close') return 'Off by one';
  if (entry.status === 'miss') return 'Miss';
  return 'Not answered';
}

function DrillCard({ itemId, caseId }: { itemId: string; caseId: string }) {
  const drill = drillsForItem(itemId).find((entry) => entry.caseId === caseId);
  const item = getNihssItem(itemId);
  const [picked, setPicked] = useState<NihssScore | null>(null);
  if (!drill) return null;
  const checked = picked !== null;
  const isExact = checked && picked === drill.key;
  const isClose =
    checked && typeof picked === 'number' && typeof drill.key === 'number' && Math.abs(picked - drill.key) === 1;
  return (
    <div className="panel">
      <p className="eyebrow">{drill.caseTitle}</p>
      <p>{drill.finding}</p>
      <div className="card-grid" role="group" aria-label={`Score options for item ${itemId}`}>
        {item.options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className={picked === option.value ? 'choice-card is-selected' : 'choice-card'}
            aria-pressed={picked === option.value}
            onClick={() => setPicked(option.value)}
          >
            <strong>
              {scoreLabel(option.value)}: {option.label}
            </strong>
          </button>
        ))}
      </div>
      {checked && (
        <div role="note">
          <p>
            <strong>
              {isExact ? 'Exact match.' : isClose ? 'Off by one.' : 'Not the key.'} Key score:{' '}
              {scoreLabel(drill.key)}.
            </strong>
          </p>
          <p className="muted">{drill.explanation}</p>
        </div>
      )}
    </div>
  );
}

function GuideMode({ initialItem }: { initialItem: string }) {
  const [selectedItem, setSelectedItem] = useState<string>(initialItem);
  const item = getNihssItem(selectedItem);
  const drills = drillsForItem(selectedItem);
  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="nihss-guide-picker">
        <h3 className="section-title" id="nihss-guide-picker">
          Pick an item to study
        </h3>
        <div className="card-grid" role="group" aria-label="NIHSS items">
          {NIHSS_ITEMS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selectedItem === entry.id ? 'choice-card is-selected' : 'choice-card'}
              aria-pressed={selectedItem === entry.id}
              onClick={() => setSelectedItem(entry.id)}
            >
              <strong>{entry.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="nihss-guide-detail">
        <h3 className="section-title" id="nihss-guide-detail">
          {item.name}: how it is scored
        </h3>
        <p>{item.instructions}</p>
        <table className="table-simple">
          <thead>
            <tr>
              <th scope="col">Score</th>
              <th scope="col">Anchor</th>
              <th scope="col">What it means</th>
            </tr>
          </thead>
          <tbody>
            {item.options.map((option) => (
              <tr key={String(option.value)}>
                <td>
                  <strong>{scoreLabel(option.value)}</strong>
                </td>
                <td>{option.label}</td>
                <td>{option.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <UncertaintyNote>
          Classic trap: {item.trap}
        </UncertaintyNote>
      </section>

      <section aria-labelledby="nihss-guide-drills">
        <h3 className="section-title" id="nihss-guide-drills">
          Drills for this item
        </h3>
        <p className="muted">
          The same item, as it appears in each fictional case in the bank. Pick a score to check
          yourself against the case key.
        </p>
        <div className="page-stack">
          {drills.map((drill) => (
            <DrillCard key={`${selectedItem}-${drill.caseId}`} itemId={selectedItem} caseId={drill.caseId} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExamMode({ reviewItem }: { reviewItem: (itemId: string) => void }) {
  const [caseId, setCaseId] = useState<string>(NIHSS_CASES[0]?.id ?? 'case-a');
  const [answers, setAnswers] = useState<Record<string, NihssScore | null>>({});
  const [result, setResult] = useState<CaseScoreResult | null>(null);
  const kasus = getNihssCase(caseId);
  const answeredCount = kasus.findings.filter((entry) => answers[entry.itemId] != null).length;

  const pickCase = (nextId: string) => {
    setCaseId(nextId);
    setAnswers({});
    setResult(null);
  };

  const check = () => {
    setResult(scoreNihssCase(kasus, answers));
  };

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="nihss-exam-picker">
        <h3 className="section-title" id="nihss-exam-picker">
          Pick a fictional case
        </h3>
        <div className="card-grid" role="group" aria-label="NIHSS practice cases">
          {NIHSS_CASES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={caseId === entry.id ? 'choice-card is-selected' : 'choice-card'}
              aria-pressed={caseId === entry.id}
              onClick={() => pickCase(entry.id)}
            >
              <strong>{entry.title}</strong>
              <span className="muted">15 items to score. The key total stays hidden until you check your answers.</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="nihss-exam-vignette">
        <h3 className="section-title" id="nihss-exam-vignette">
          {kasus.title}
        </h3>
        <p>{kasus.vignette}</p>
        <p className="muted">
          Score every item from the written findings only. There is deliberately no video and no
          real patient: the skill being trained is matching findings to the scale anchors.
        </p>
      </section>

      {kasus.findings.map((caseFinding) => {
        const item = getNihssItem(caseFinding.itemId);
        const picked = answers[caseFinding.itemId] ?? null;
        const itemResult = result?.items.find((entry) => entry.itemId === caseFinding.itemId);
        return (
          <section key={caseFinding.itemId} className="panel" aria-label={item.name}>
            <h3 className="section-title">{item.name}</h3>
            <p>{caseFinding.finding}</p>
            <div className="card-grid" role="group" aria-label={`Your score for ${item.name}`}>
              {item.options.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  className={picked === option.value ? 'choice-card is-selected' : 'choice-card'}
                  aria-pressed={picked === option.value}
                  disabled={result !== null}
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [caseFinding.itemId]: option.value }))
                  }
                >
                  <strong>
                    {scoreLabel(option.value)}: {option.label}
                  </strong>
                </button>
              ))}
            </div>
            {result && itemResult && itemResult.status !== 'exact' && (
              <div role="note">
                <p>
                  <strong>
                    {statusText(result, caseFinding.itemId)}. Key: {scoreLabel(itemResult.key)}.
                  </strong>
                </p>
                <p className="muted">{itemResult.explanation}</p>
                <button type="button" className="btn" onClick={() => reviewItem(caseFinding.itemId)}>
                  Review this item in the guide
                </button>
              </div>
            )}
            {result && itemResult && itemResult.status === 'exact' && (
              <p role="note">
                <strong>Exact match.</strong> <span className="muted">{itemResult.explanation}</span>
              </p>
            )}
          </section>
        );
      })}

      {result === null ? (
        <div className="wizard-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={check}
            disabled={answeredCount < kasus.findings.length}
          >
            Check my scores ({answeredCount} of {kasus.findings.length} answered)
          </button>
        </div>
      ) : (
        <section className="panel" aria-labelledby="nihss-exam-result">
          <h3 className="section-title" id="nihss-exam-result">
            Your result
          </h3>
          <p>
            Your total: <strong>{result.userTotal}</strong> ({result.userBand}). Case key total:{' '}
            <strong>{result.keyTotal}</strong> ({result.keyBand}). Exact matches:{' '}
            <strong>
              {result.exactCount} of {kasus.findings.length}
            </strong>
            .
          </p>
          <p className="muted">
            Totals are a training summary. The difference map matters more than the total: it
            shows which items your eye is misjudging, and by how much.
          </p>
          <table className="table-simple">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">You</th>
                <th scope="col">Key</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((entry) => (
                <tr key={entry.itemId}>
                  <td>{getNihssItem(entry.itemId).name}</td>
                  <td>{scoreLabel(entry.user)}</td>
                  <td>{scoreLabel(entry.key)}</td>
                  <td>{statusText(result, entry.itemId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.recommended.length > 0 && (
            <div>
              <p>
                <strong>Review next:</strong>
              </p>
              <div className="wizard-actions">
                {result.recommended.map((itemId) => (
                  <button key={itemId} type="button" className="btn" onClick={() => reviewItem(itemId)}>
                    {getNihssItem(itemId).name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="wizard-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAnswers({});
                setResult(null);
              }}
            >
              Score this case again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function NihssTrainer() {
  const feature = getFeature('nihss-trainer');
  const [mode, setMode] = useState<TrainerMode>('guide');
  const [focusItem, setFocusItem] = useState<string>('5b');

  const reviewItem = (itemId: string) => {
    setFocusItem(itemId);
    setMode('guide');
    document.getElementById('nihss-trainer-top')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="page-stack" id="nihss-trainer-top">
      <header className="page-heading">
        <p className="eyebrow">Clinical Reasoning AI - Training tool</p>
        <h1
          style={{ fontSize: 'clamp(1.45rem, 3vw, 2rem)', fontWeight: 750, marginBottom: '0.5em' }}
        >
          {feature?.name ?? 'NIHSS Co-Pilot Trainer'}
        </h1>
        <p className="muted">{feature?.tagline ?? 'Score simulated patients, item by item'}</p>
        <div className="badge-row">
          <MaturityBadge maturity={feature?.maturity ?? 'concept'} />
          <ModeBadge mode="simulation" />
        </div>
      </header>

      <EmergencyBanner />

      <section className="panel" aria-labelledby="nihss-training-note">
        <h3 className="section-title" id="nihss-training-note">
          Training only, not a clinical reference
        </h3>
        <p>
          Every patient in this trainer is fictional and written for practice. The item layout
          follows the official NIH Stroke Scale so the habit you build is the real one, but this
          page is not NIHSS certification, not an official scoring authority, and it must never
          be used to score a real patient. Scores are compared with fixed case keys by simple
          arithmetic; no AI output can change a key.
        </p>
      </section>

      <div className="wizard-actions" role="group" aria-label="Trainer mode">
        <button
          type="button"
          className={mode === 'guide' ? 'btn btn-primary' : 'btn'}
          aria-pressed={mode === 'guide'}
          onClick={() => setMode('guide')}
        >
          Item by item guide and drills
        </button>
        <button
          type="button"
          className={mode === 'exam' ? 'btn btn-primary' : 'btn'}
          aria-pressed={mode === 'exam'}
          onClick={() => setMode('exam')}
        >
          Full case exam
        </button>
      </div>

      {mode === 'guide' ? (
        <GuideMode key={focusItem} initialItem={focusItem} />
      ) : (
        <ExamMode reviewItem={reviewItem} />
      )}

      {feature && <HowItWorks feature={feature} />}
    </div>
  );
}

export default NihssTrainer;
