import { useMemo, useState } from 'react';
import { BOARD_CATEGORIES } from './content';
import type { BoardWord } from './content';
import { buildSentence, suggestExpansions } from './logic';
import type { SentenceToken } from './logic';
import { speakText, ttsSupported } from './tts';
import PracticeNote from './PracticeNote';

/**
 * Aphasia Communication Mode: a tap to build communication board.
 * The person taps core words (icon plus label), adds their own typed
 * fragment if they want, reviews the sentence, and only then is anything
 * spoken aloud. Local pattern suggestions are offered as buttons; they
 * are simple rules, not AI, and nothing is treated as the person's words
 * until they confirm it by tapping Speak or a suggestion.
 */
export default function AphasiaCommunicationMode() {
  const [activeCategory, setActiveCategory] = useState(BOARD_CATEGORIES[0]?.id ?? '');
  const [tokens, setTokens] = useState<SentenceToken[]>([]);
  const [typedWord, setTypedWord] = useState('');
  const [override, setOverride] = useState<string | null>(null);

  const category = BOARD_CATEGORIES.find((entry) => entry.id === activeCategory);
  const sentence = override ?? buildSentence(tokens);
  const suggestions = useMemo(() => (override ? [] : suggestExpansions(tokens)), [tokens, override]);
  const speechReady = ttsSupported();

  function tapWord(word: BoardWord) {
    setOverride(null);
    setTokens((previous) => [...previous, { label: word.label, kind: word.kind }]);
  }

  function addTypedWord() {
    const label = typedWord.trim().toLowerCase();
    if (!label) return;
    setOverride(null);
    setTokens((previous) => [...previous, { label, kind: 'thing' }]);
    setTypedWord('');
  }

  function undo() {
    setOverride(null);
    setTokens((previous) => previous.slice(0, -1));
  }

  function clearAll() {
    setOverride(null);
    setTokens([]);
  }

  return (
    <div className="page-stack">
      <section className="panel" aria-labelledby="communication-title">
        <h2 className="section-title" id="communication-title">
          Build a sentence by tapping
        </h2>
        <PracticeNote>
          This board is a practice prototype for building sentences from core words.
        </PracticeNote>

        <div
          aria-live="polite"
          style={{
            border: '2px solid currentColor',
            borderRadius: '8px',
            padding: '1rem',
            minHeight: '3.5rem',
            fontSize: '1.4rem',
          }}
        >
          {sentence || <span className="muted">Your sentence will appear here.</span>}
        </div>

        <div className="check-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!sentence || !speechReady}
            onClick={() => speakText(sentence)}
          >
            Speak this sentence
          </button>
          <button type="button" className="btn btn-ghost" onClick={undo} disabled={tokens.length === 0 && !override}>
            Undo last word
          </button>
          <button type="button" className="btn btn-ghost" onClick={clearAll} disabled={tokens.length === 0 && !override}>
            Clear
          </button>
        </div>
        {!speechReady && (
          <p className="muted" role="note">
            This browser does not offer text to speech, so sentences can be built and read on
            screen but not played aloud.
          </p>
        )}

        {suggestions.length > 0 && (
          <div>
            <p>
              <strong>Local pattern suggestions.</strong> These come from simple word rules on
              this device, not from AI. Tap one only if it says what you mean.
            </p>
            <div className="check-row">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setOverride(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="check-row" role="tablist" aria-label="Word categories">
          {BOARD_CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={entry.id === activeCategory}
              className={entry.id === activeCategory ? 'btn btn-primary' : 'btn btn-ghost'}
              onClick={() => setActiveCategory(entry.id)}
            >
              {entry.title}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {category?.words.map((word) => (
            <button
              key={word.label}
              type="button"
              className="btn btn-ghost"
              style={{ minHeight: '5rem', fontSize: '1.05rem' }}
              onClick={() => tapWord(word)}
            >
              <span style={{ fontSize: '1.8rem', display: 'block' }} aria-hidden="true">
                {word.emoji}
              </span>
              {word.label}
            </button>
          ))}
        </div>

        <label className="form-label" htmlFor="typed-fragment">
          Or type your own word or fragment
        </label>
        <div className="check-row">
          <input
            id="typed-fragment"
            className="form-input"
            type="text"
            value={typedWord}
            onChange={(event) => setTypedWord(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addTypedWord();
            }}
            autoComplete="off"
          />
          <button type="button" className="btn btn-ghost" onClick={addTypedWord}>
            Add to sentence
          </button>
        </div>
        <p className="muted">
          Nothing is sent anywhere. Words you tap stay in this tab, and the sentence is spoken
          only when you tap Speak.
        </p>
      </section>
    </div>
  );
}
