// The result body of the Face Lesion Localizer: one screen that
// reads top to bottom as pattern, pathway, candidate levels,
// observations, ranked possibilities, limits, closing. The example
// step renders this exact component with static teaching data, so
// what a person learns to read there is what a real result looks
// like. Framing texts come from the feature knowledge specification
// and are fixed copy, never model output.

import { PathwayDiagram } from './PathwayDiagram';
import { CONFIDENCE_LABELS, type LocalizerView } from './resultModel';

export const RESULT_OPENING =
  'Here is what this photo suggests. This is an exploration of possibilities to support learning and clinical discussion, based on one photo in experimental mode, and it is not a diagnosis.';

export const BALANCING_LINE =
  'The same pattern can arise from different locations. Only brain imaging can confirm where the lesion is.';

export const CLOSING_TEXT =
  'This is a possibility exploration for learning and clinical discussion, not a diagnosis. Certainty is only possible through an in-person examination and brain imaging (CT or MRI). If any part of this result worries you, please see a doctor and discuss it directly.';

const CANNOT_TELL: string[] = [
  'How fast the face moves, or whether it tires with repetition: a photo has no time dimension.',
  'Linked movements (synkinesis), where one part of the face moves along with another.',
  'Spontaneous blinking, and whether the eye keeps closing fully over time.',
  'The difference between a smile on command and a spontaneous smile.',
  'The exact depth of the fold beside the nose: lighting from one side can fake a shallow fold.',
];

export default function LesionResultBody({ view }: { view: LocalizerView }) {
  return (
    <div className="loc-result">
      <p className="loc-opening">{RESULT_OPENING}</p>
      <p className="loc-mode-marker">Based on one photo, experimental mode.</p>

      <div className="loc-pattern detail-panel">
        <p className="eyebrow">Pattern found</p>
        <p className="loc-pattern-title">{view.patternTitle}</p>
        {view.patternNote ? <p className="loc-pattern-note">{view.patternNote}</p> : null}
      </div>

      <h3>Most likely pathway involved</h3>
      <p className="muted">
        Face movement is commanded along one pathway, the corticobulbar tract (the command
        pathway from the brain to the face muscles). The diagram follows it from the cortex
        down to the face; the highlighted level is the top candidate in the list below.
      </p>
      <div className="loc-diagram">
        <PathwayDiagram activeLevel={view.activeLevel} />
      </div>

      <h3>Candidate lesion levels</h3>
      <p className="muted">
        A lesion is an area of damage. These are the places where it could sit, in the order
        the AI ranked them for this pattern. Confidence is a word, never a score, and one
        photo can support moderate confidence at best.
      </p>
      <div className="loc-candidates">
        {view.candidates.map((candidate, index) => (
          <article className="loc-candidate" key={`${candidate.site}-${index}`}>
            <div className="loc-candidate-head">
              <h4>{candidate.site}</h4>
              <span className={`loc-confidence is-${candidate.confidence}`}>
                {CONFIDENCE_LABELS[candidate.confidence]}
              </span>
            </div>
            <p className="loc-candidate-row">
              <span className="loc-row-label">Pathway:</span> {candidate.tract}
            </p>
            <p className="loc-candidate-row">
              <span className="loc-row-label">Candidate vessel:</span>{' '}
              <span className="fact-chip">{candidate.vessel}</span>
            </p>
            <p className="muted">{candidate.rationale}</p>
          </article>
        ))}
      </div>

      {view.observations.length > 0 ? (
        <>
          <h3>What the AI noticed in this photo</h3>
          <ul className="loc-observations">
            {view.observations.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}

      {view.possibilities.length > 0 ? (
        <>
          <h3>Possibilities to consider, ranked</h3>
          <ol className="step-list loc-possibilities">
            {view.possibilities.map((possibility, index) => (
              <li key={`${possibility.name}-${index}`}>
                <strong>{possibility.name}</strong>
                {index === 0 ? (
                  <span className="badge badge-mode loc-first-tag">
                    Most consistent with this pattern
                  </span>
                ) : null}
                <span className="loc-possibility-note">{possibility.note}</span>
              </li>
            ))}
          </ol>
          <p className="muted">{BALANCING_LINE}</p>
        </>
      ) : null}

      <h3>What this photo cannot tell us</h3>
      <ul className="loc-cannot-list">
        {CANNOT_TELL.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="muted">
        Judging the forehead from a single still photo is limited. A guided video session on
        the same person would raise the confidence ceiling.
      </p>

      <div className="uncertainty-note loc-closing">
        <p>{CLOSING_TEXT}</p>
      </div>
    </div>
  );
}
