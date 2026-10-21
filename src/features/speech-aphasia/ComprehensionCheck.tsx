import { useMemo, useState } from 'react';
import { ONE_STEP_COMMANDS, SCENE_OBJECTS, STORY_SETS, TWO_STEP_COMMANDS } from './content';
import {
  nextComprehensionStage,
  scoreSequenceSelection,
  scoreYesNo,
  summarizeComprehension,
} from './logic';
import type { ComprehensionRecord, ComprehensionStage } from './logic';
import { speakText, ttsSupported } from './tts';
import PracticeNote from './PracticeNote';

function ObjectGrid({
  selected,
  onTap,
  disabled,
}: {
  selected: string[];
  onTap: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '0.5rem',
      }}
    >
      {SCENE_OBJECTS.map((object) => (
        <button
          key={object.id}
          type="button"
          className={selected.includes(object.id) ? 'btn btn-primary' : 'btn btn-ghost'}
          style={{ minHeight: '5rem', fontSize: '1.05rem' }}
          disabled={disabled}
          aria-pressed={selected.includes(object.id)}
          onClick={() => onTap(object.id)}
        >
          <span style={{ fontSize: '1.8rem', display: 'block' }} aria-hidden="true">
            {object.emoji}
          </span>
          {object.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Interactive Comprehension Check: a token test style listening exercise.
 * Commands are spoken with local text to speech, answers are taps, and
 * scoring is fully deterministic on the device. The session always starts
 * with a volume check and a familiarization item so a technical problem is
 * not mistaken for a comprehension problem.
 */
export default function ComprehensionCheck() {
  const [stage, setStage] = useState<ComprehensionStage>('setup');
  const [familiarDone, setFamiliarDone] = useState(false);
  const [familiarNote, setFamiliarNote] = useState('');
  const [oneIndex, setOneIndex] = useState(0);
  const [twoIndex, setTwoIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [answered, setAnswered] = useState(false);
  const [showText, setShowText] = useState(false);
  const [presentedAt, setPresentedAt] = useState(() => Date.now());
  const [records, setRecords] = useState<ComprehensionRecord[]>([]);

  const summary = useMemo(() => summarizeComprehension(records), [records]);
  const oneStep = ONE_STEP_COMMANDS[oneIndex];
  const twoStep = TWO_STEP_COMMANDS[twoIndex];
  const storySet = STORY_SETS[storyIndex];
  const storyQuestion = storySet?.questions[questionIndex];
  const speechReady = ttsSupported();

  function resetItemState() {
    setSelected([]);
    setFeedback('');
    setAnswered(false);
    setShowText(false);
    setPresentedAt(Date.now());
  }

  function advanceStage() {
    setStage((current) => nextComprehensionStage(current));
    resetItemState();
  }

  // ----- one step -----
  function tapOneStep(id: string) {
    if (!oneStep || answered) return;
    const result = scoreSequenceSelection([oneStep.targetId], [id]);
    setRecords((previous) => [
      ...previous,
      {
        itemId: oneStep.id,
        kind: 'one-step' as const,
        correct: result.correct,
        points: result.points,
        maxPoints: result.maxPoints,
        responseMs: Date.now() - presentedAt,
      },
    ]);
    setSelected([id]);
    setAnswered(true);
    setFeedback(
      result.correct
        ? 'Correct.'
        : `That was not it. The command was: ${oneStep.text}.`,
    );
  }

  function nextOneStep() {
    if (oneIndex + 1 >= ONE_STEP_COMMANDS.length) {
      advanceStage();
    } else {
      setOneIndex(oneIndex + 1);
      resetItemState();
    }
  }

  // ----- two step -----
  function tapTwoStep(id: string) {
    if (!twoStep || answered || selected.includes(id)) return;
    const nextSelected = [...selected, id];
    setSelected(nextSelected);
    if (nextSelected.length < 2) return;
    const result = scoreSequenceSelection([...twoStep.targetIds], nextSelected);
    setRecords((previous) => [
      ...previous,
      {
        itemId: twoStep.id,
        kind: 'two-step' as const,
        correct: result.correct,
        points: result.points,
        maxPoints: result.maxPoints,
        responseMs: Date.now() - presentedAt,
      },
    ]);
    setAnswered(true);
    setFeedback(
      result.correct
        ? 'Correct, both steps in order.'
        : result.rightObjectsWrongOrder
          ? 'You found both objects, but in the other order. Order is part of the command.'
          : `That was not it. The command was: ${twoStep.text}.`,
    );
  }

  function nextTwoStep() {
    if (twoIndex + 1 >= TWO_STEP_COMMANDS.length) {
      advanceStage();
    } else {
      setTwoIndex(twoIndex + 1);
      resetItemState();
    }
  }

  // ----- yes or no -----
  function answerYesNo(given: boolean) {
    if (!storyQuestion || answered) return;
    const result = scoreYesNo(storyQuestion.answer, given);
    setRecords((previous) => [
      ...previous,
      {
        itemId: storyQuestion.id,
        kind: 'yes-no' as const,
        correct: result.correct,
        points: result.points,
        maxPoints: 1,
        responseMs: Date.now() - presentedAt,
      },
    ]);
    setAnswered(true);
    setFeedback(result.correct ? 'Correct.' : 'Not quite. Listen to the story again if you like.');
  }

  function nextQuestion() {
    if (!storySet) return;
    if (questionIndex + 1 < storySet.questions.length) {
      setQuestionIndex(questionIndex + 1);
      resetItemState();
    } else if (storyIndex + 1 < STORY_SETS.length) {
      setStoryIndex(storyIndex + 1);
      setQuestionIndex(0);
      resetItemState();
    } else {
      advanceStage();
    }
  }

  function restart() {
    setStage('setup');
    setFamiliarDone(false);
    setFamiliarNote('');
    setOneIndex(0);
    setTwoIndex(0);
    setStoryIndex(0);
    setQuestionIndex(0);
    setRecords([]);
    resetItemState();
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="comprehension-title">
        <h2 className="section-title" id="comprehension-title">
          Listen and respond by touch
        </h2>
        <PracticeNote>
          Listening practice with spoken commands can support learning about auditory
          comprehension.
        </PracticeNote>
        {!speechReady && (
          <p className="muted" role="note">
            This browser does not offer text to speech. You can still do every task by showing
            the command as text, but that turns listening practice into reading practice.
          </p>
        )}

        {stage === 'setup' && (
          <div>
            <h3>Step 1: volume check</h3>
            <p>Play the test sentence and set your volume so you can hear it clearly.</p>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!speechReady}
              onClick={() => speakText('If you can hear this voice clearly, you are ready to begin.')}
            >
              Play test sentence
            </button>
            <h3>Step 2: try one together</h3>
            <p>
              Practice item: <strong>Touch the dog.</strong> This one is not scored.
            </p>
            <ObjectGrid
              selected={[]}
              disabled={familiarDone}
              onTap={(id) => {
                if (id === 'dog') {
                  setFamiliarDone(true);
                  setFamiliarNote('Good. That is how every task in this session works.');
                } else {
                  setFamiliarNote('That was a different picture. Try the dog.');
                }
              }}
            />
            {familiarNote && <p role="status">{familiarNote}</p>}
            <button
              type="button"
              className="btn btn-primary"
              disabled={!familiarDone}
              onClick={advanceStage}
            >
              Start the one step commands
            </button>
          </div>
        )}

        {stage === 'one-step' && oneStep && (
          <div>
            <h3>
              One step commands ({oneIndex + 1} of {ONE_STEP_COMMANDS.length})
            </h3>
            <div className="check-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!speechReady}
                onClick={() => speakText(oneStep.text)}
              >
                Play the command
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowText(!showText)}>
                {showText ? 'Hide the text' : 'Show the text'}
              </button>
            </div>
            {showText && <p role="note">{oneStep.text}</p>}
            <ObjectGrid selected={selected} disabled={answered} onTap={tapOneStep} />
            {feedback && <p role="status">{feedback}</p>}
            {answered && (
              <button type="button" className="btn btn-primary" onClick={nextOneStep}>
                Next command
              </button>
            )}
          </div>
        )}

        {stage === 'two-step' && twoStep && (
          <div>
            <h3>
              Two step commands ({twoIndex + 1} of {TWO_STEP_COMMANDS.length})
            </h3>
            <p className="muted">Touch the two pictures in the order the command names them.</p>
            <div className="check-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!speechReady}
                onClick={() => speakText(twoStep.text)}
              >
                Play the command
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowText(!showText)}>
                {showText ? 'Hide the text' : 'Show the text'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={answered || selected.length === 0}
                onClick={() => setSelected([])}
              >
                Clear touches
              </button>
            </div>
            {showText && <p role="note">{twoStep.text}</p>}
            <ObjectGrid selected={selected} disabled={answered} onTap={tapTwoStep} />
            {feedback && <p role="status">{feedback}</p>}
            {answered && (
              <button type="button" className="btn btn-primary" onClick={nextTwoStep}>
                Next command
              </button>
            )}
          </div>
        )}

        {stage === 'yes-no' && storySet && storyQuestion && (
          <div>
            <h3>
              Yes or no: {storySet.title} (story {storyIndex + 1} of {STORY_SETS.length})
            </h3>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!speechReady}
              onClick={() => speakText(storySet.story)}
            >
              Play the story
            </button>
            <p>{storySet.story}</p>
            <p>
              <strong>
                Question {questionIndex + 1} of {storySet.questions.length}:
              </strong>{' '}
              {storyQuestion.question}
            </p>
            <div className="check-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={answered}
                onClick={() => answerYesNo(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={answered}
                onClick={() => answerYesNo(false)}
              >
                No
              </button>
            </div>
            {feedback && <p role="status">{feedback}</p>}
            {answered && (
              <button type="button" className="btn btn-primary" onClick={nextQuestion}>
                Next question
              </button>
            )}
          </div>
        )}

        {stage === 'summary' && (
          <div>
            <h3>Session summary</h3>
            <p>
              {summary.totalCorrect} of {summary.totalItems} tasks fully correct, {summary.points}{' '}
              of {summary.maxPoints} practice points.
            </p>
            <table className="table-simple">
              <thead>
                <tr>
                  <th scope="col">Task type</th>
                  <th scope="col">Fully correct</th>
                  <th scope="col">Points</th>
                  <th scope="col">Average response time</th>
                </tr>
              </thead>
              <tbody>
                {summary.byKind.map((row) => (
                  <tr key={row.kind}>
                    <td>{row.kind === 'one-step' ? 'One step' : row.kind === 'two-step' ? 'Two step' : 'Yes or no'}</td>
                    <td>
                      {row.correct} of {row.items}
                    </td>
                    <td>
                      {row.points} of {row.maxPoints}
                    </td>
                    <td>{row.items === 0 ? 'not played' : `${(row.averageResponseMs / 1000).toFixed(1)} seconds`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              Response times and scores are observations from this practice session. A low score
              here can reflect the synthetic voice, the volume, or the English wording, not only
              comprehension.
            </p>
            <button type="button" className="btn btn-primary" onClick={restart}>
              Start a new session
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
