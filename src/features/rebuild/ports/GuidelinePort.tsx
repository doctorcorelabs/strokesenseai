import { getFeature } from '../../../../shared/registry';
import { LabShell } from '../../../shell';
import GuidelineNavigator, { EvidenceCardView } from '../../document-knowledge/GuidelineNavigator';
import { EXAMPLE_QUESTIONS, answerFromCards } from '../../document-knowledge/guideline-engine';
import './ports.css';

/**
 * Step 1 content: one example question answered by the same local
 * evidence card library the workspace searches, rendered with the
 * workspace's own card view so the citation format is identical.
 */
function GuidelineExample() {
  const question = EXAMPLE_QUESTIONS[0] ?? '';
  const answer = answerFromCards(question);
  return (
    <>
      <h2 className="section-title">See a finished example</h2>
      <p>
        Every answer in this lab is built only from a local library of evidence cards, each
        one a paraphrased claim from a published stroke guideline with its source named. Here
        is one question and the cards the library answers it with.
      </p>
      <p className="port-example-label">Example result</p>
      <p>
        <strong>Question:</strong> {question}
      </p>
      {answer.refused ? (
        <p className="muted">
          The library does not cover this question, so the tool says so instead of guessing.
        </p>
      ) : (
        <div className="page-stack">
          {answer.cards.map((card) => (
            <EvidenceCardView key={card.id} card={card} />
          ))}
        </div>
      )}
      <p className="muted">
        In the try step you can ask your own question, browse topics, or follow the guided
        questions. If no card matches, the navigator refuses honestly rather than inventing
        an answer.
      </p>
    </>
  );
}

/**
 * Rebuild port for Ask the Guidelines (Guideline Navigator): the
 * existing workspace, unchanged, mounted inside the shared shell. The
 * workspace renders its answers inline, so this port passes no
 * separate result sheet. The workspace also renders its own emergency
 * banner, as it did in the old shell.
 */
export default function GuidelinePort() {
  const feature = getFeature('guideline-navigator');
  if (!feature) return null;
  return (
    <LabShell feature={feature} example={<GuidelineExample />} tryIt={<GuidelineNavigator />} />
  );
}
