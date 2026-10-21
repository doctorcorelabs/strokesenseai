import { useMemo, useState } from 'react';
import { NAMING_ITEMS } from './content';
import type { NamingLevel } from './content';
import {
  firstSoundCue,
  judgeNamingAnswer,
  multipleChoiceOptions,
  nextCueLevel,
  scoreNamingAttempt,
  summarizeNamingSession,
} from './logic';
import type { CueLevel, NamingAttemptRecord, NamingJudgement } from './logic';
import { speakText, ttsSupported } from './tts';
import PracticeNote from './PracticeNote';

const ERROR_KIND_TEXT: Record<NamingJudgement['errorKind'], string> = {
  none: '',
  semantic:
    'Experimental label: this answer is related in meaning to the target, similar to a semantic paraphasia pattern.',
  phonemic:
    'Experimental label: this answer sounds close to the target, similar to a phonemic paraphasia pattern.',
  circumlocution:
    'Experimental label: this answer describes the picture instead of naming it, similar to circumlocution.',
  unrelated: 'Experimental label: this answer does not match the target word.',
  'no-response': 'No answer was entered.',
};

function feedbackText(judgement: NamingJudgement, targetWord: string): string {
  if (judgement.band === 'correct') return `Correct. The word is "${targetWord}".`;
  if (judgement.band === 'close') {
    return `Very close. The target word is "${targetWord}".`;
  }
  if (judgement.band === 'no-response') return 'Nothing was typed yet. Type a word, or use a cue.';
  return 'That is not the target word yet. You can try again, reveal a cue, or skip this picture.';
}

/**
 * Aphasia Expression Lab: picture naming practice with a graded cue ladder
 * (semantic hint, first sound, multiple choice), deterministic scoring,
 * and a session log. Typed answers are judged locally in two layers:
 * an exact and semantic field layer, then a phonetic closeness layer.
 * Error kind labels are experimental and unvalidated by design.
 */
export default function AphasiaExpressionLab() {
  const [level, setLevel] = useState<NamingLevel>(1);
  const items = useMemo(() => NAMING_ITEMS.filter((item) => item.level === level), [level]);
  const [itemIndex, setItemIndex] = useState(0);
  const [cueLevel, setCueLevel] = useState<CueLevel>(0);
  const [answer, setAnswer] = useState('');
  const [judgement, setJudgement] = useState<NamingJudgement | null>(null);
  const [closed, setClosed] = useState(false);
  const [records, setRecords] = useState<NamingAttemptRecord[]>([]);
  const [finished, setFinished] = useState(false);

  const item = items[itemIndex];
  const summary = summarizeNamingSession(records);
  const options = useMemo(
    () => (item ? multipleChoiceOptions(item, NAMING_ITEMS) : []),
    [item],
  );
  const soundCue = item ? firstSoundCue(item.word) : null;

  function resetItem() {
    setCueLevel(0);
    setAnswer('');
    setJudgement(null);
    setClosed(false);
  }

  function selectLevel(next: NamingLevel) {
    setLevel(next);
    setItemIndex(0);
    setRecords([]);
    setFinished(false);
    resetItem();
  }

  function closeItem(finalJudgement: NamingJudgement, usedCues: CueLevel, givenAnswer: string) {
    if (!item) return;
    const record: NamingAttemptRecord = {
      itemId: item.id,
      word: item.word,
      level: item.level,
      answer: givenAnswer,
      band: finalJudgement.band,
      errorKind: finalJudgement.errorKind,
      cuesUsed: usedCues,
      points: scoreNamingAttempt(finalJudgement.band, usedCues),
    };
    setRecords((previous) => [...previous, record]);
    setJudgement(finalJudgement);
    setClosed(true);
  }

  function checkAnswer() {
    if (!item || closed) return;
    const result = judgeNamingAnswer(item, answer);
    if (result.band === 'correct' || result.band === 'close') {
      closeItem(result, cueLevel, answer);
    } else {
      // A miss stays open so a cue can still help. Nothing is recorded yet.
      setJudgement(result);
    }
  }

  function revealCue() {
    if (closed) return;
    setCueLevel((current) => nextCueLevel(current));
  }

  function skipItem() {
    if (!item || closed) return;
    const result = judgement ?? judgeNamingAnswer(item, answer);
    closeItem(
      result.band === 'correct' || result.band === 'close'
        ? result
        : { ...result, band: 'miss' as const },
      cueLevel,
      answer,
    );
  }

  function chooseOption(word: string) {
    if (!item || closed) return;
    const result: NamingJudgement =
      word === item.word
        ? { band: 'correct', errorKind: 'none', normalized: word }
        : { band: 'miss', errorKind: 'unrelated', normalized: word };
    closeItem(result, 3, word);
  }

  function nextItem() {
    if (itemIndex + 1 >= items.length) {
      setFinished(true);
      return;
    }
    setItemIndex(itemIndex + 1);
    resetItem();
  }

  function restart() {
    setItemIndex(0);
    setRecords([]);
    setFinished(false);
    resetItem();
  }

  if (finished || !item) {
    return (
      <div className="page-stack">
        <section className="panel" aria-labelledby="expression-done-title">
          <h2 className="section-title" id="expression-done-title">
            Naming practice summary
          </h2>
          <p>
            You finished level {level}: {summary.correct} correct, {summary.close} close,{' '}
            {summary.missed} missed, for {summary.points} of {summary.maxPoints} practice points (
            {summary.percent} percent).
          </p>
          <p className="muted">
            {summary.cuedCorrect} correct answer{summary.cuedCorrect === 1 ? '' : 's'} needed at
            least one cue. These counts describe this practice session only.
          </p>
          <button type="button" className="btn btn-primary" onClick={restart}>
            Practice this level again
          </button>
        </section>
        <PracticeNote>
          Naming practice with cues can support learning about word finding strategies.
        </PracticeNote>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="expression-title">
        <h2 className="section-title" id="expression-title">
          Name the picture
        </h2>
        <PracticeNote>
          Naming practice with a cue ladder can support learning about word finding.
        </PracticeNote>

        <div className="check-row" role="group" aria-label="Difficulty level">
          {([1, 2, 3] as NamingLevel[]).map((option) => (
            <button
              key={option}
              type="button"
              className={option === level ? 'btn btn-primary' : 'btn btn-ghost'}
              aria-pressed={option === level}
              onClick={() => selectLevel(option)}
            >
              Level {option}
            </button>
          ))}
          <span className="muted">
            Picture {itemIndex + 1} of {items.length}
          </span>
        </div>

        <div style={{ fontSize: '6rem', lineHeight: 1.1, textAlign: 'center' }} aria-hidden="true">
          {item.emoji}
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>
          Category: {item.category}. Type the word for this picture.
        </p>

        <label className="form-label" htmlFor="naming-answer">
          Your answer
        </label>
        <input
          id="naming-answer"
          className="form-input"
          type="text"
          value={answer}
          disabled={closed}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') checkAnswer();
          }}
          autoComplete="off"
        />

        {cueLevel >= 1 && (
          <p role="note">
            <strong>Semantic cue:</strong> {item.semanticCue}
          </p>
        )}
        {cueLevel >= 2 && soundCue && (
          <p role="note">
            <strong>First sound cue:</strong> the word starts with the letter {soundCue.letter} (
            {soundCue.skeleton}).
          </p>
        )}
        {cueLevel >= 3 && !closed && (
          <div role="group" aria-label="Multiple choice options">
            <p>
              <strong>Multiple choice:</strong> tap the word that names the picture.
            </p>
            <div className="check-row">
              {options.map((word) => (
                <button
                  key={word}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => chooseOption(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="check-row">
          <button type="button" className="btn btn-primary" onClick={checkAnswer} disabled={closed}>
            Check answer
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={revealCue}
            disabled={closed || cueLevel >= 3}
          >
            {cueLevel === 0
              ? 'Show a semantic cue'
              : cueLevel === 1
                ? 'Show the first sound'
                : 'Show multiple choice'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={skipItem} disabled={closed}>
            Skip this picture
          </button>
        </div>

        {judgement && (
          <div role="status">
            <p>{feedbackText(judgement, item.word)}</p>
            {judgement.errorKind !== 'none' && <p className="muted">{ERROR_KIND_TEXT[judgement.errorKind]}</p>}
            {closed && (
              <div className="check-row">
                {ttsSupported() && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => speakText(item.word)}
                  >
                    Hear the word
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={nextItem}>
                  {itemIndex + 1 >= items.length ? 'See summary' : 'Next picture'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel" aria-labelledby="expression-log-title">
        <h2 className="section-title" id="expression-log-title">
          Session log
        </h2>
        {records.length === 0 ? (
          <p className="muted">No scored answers yet. Your responses will be listed here.</p>
        ) : (
          <>
            <p>
              Score so far: {summary.points} of {summary.maxPoints} practice points across{' '}
              {summary.attempts} scored picture{summary.attempts === 1 ? '' : 's'}.
            </p>
            <ul className="result-list">
              {records.map((record, index) => (
                <li key={`${record.itemId}-${index}`}>
                  {record.word}: you answered "{record.answer || 'nothing'}", judged{' '}
                  {record.band}, {record.cuesUsed} cue{record.cuesUsed === 1 ? '' : 's'} used,{' '}
                  {record.points} point{record.points === 1 ? '' : 's'}.
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
