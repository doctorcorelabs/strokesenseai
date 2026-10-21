import { useState } from 'react';
import { ConsentNotice, EmergencyBanner, UncertaintyNote } from '../../components/ui';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../safety';
import { getApiBase, requestConsentToken, requestToolExplanation } from '../../ai/client';
import {
  CARD_LABEL,
  CORPUS_REVIEW_DATE,
  GUIDELINE_TOPICS,
  cardsForTopic,
} from './guideline-cards';
import type { EvidenceCard } from './guideline-cards';
import {
  TREE_ROOT_ID,
  answerFromCards,
  cardsForNode,
  getTreeNode,
} from './guideline-engine';
import './document-knowledge.css';

function citationLine(card: EvidenceCard): string {
  const c = card.citation;
  return `${c.publisher}. ${c.document} (${c.year}), section: ${c.section}.`;
}

export function EvidenceCardView({ card }: { card: EvidenceCard }) {
  return (
    <article className="dk-card">
      <h3>{card.title}</h3>
      <p>{card.claim}</p>
      <p className="dk-citation muted">Source: {citationLine(card)}</p>
      <p className="dk-card-label">{CARD_LABEL}</p>
    </article>
  );
}

type Tab = 'topics' | 'guided' | 'ask';

/**
 * Guideline Navigator workspace. Answers come from the local evidence card
 * library only; the optional AI mode may rephrase the retrieved cards but
 * never adds facts, and it follows the same consent pattern as the coach.
 */
export default function GuidelineNavigator() {
  const api = getApiBase();
  const [tab, setTab] = useState<Tab>('topics');
  const [topicId, setTopicId] = useState<string>(GUIDELINE_TOPICS[0]?.id ?? '');
  const [path, setPath] = useState<string[]>([TREE_ROOT_ID]);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [consent, setConsent] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiPending, setAiPending] = useState(false);
  const [emergency, setEmergency] = useState(false);

  const answer = asked ? answerFromCards(asked) : null;
  const currentNode = getTreeNode(path[path.length - 1] ?? TREE_ROOT_ID);

  function runAsk() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setAiReply('');
    setAiError('');
    // Emergency check first, before retrieval and before any AI call.
    if (mentionsAcuteSigns(trimmed)) {
      setEmergency(true);
      setAsked('');
      return;
    }
    setEmergency(false);
    setAsked(trimmed);
  }

  async function askAi() {
    if (!answer || answer.refused || aiPending) return;
    if (!api) {
      setAiError(
        'Live AI is not configured in this build. The cards above are the complete local answer.',
      );
      return;
    }
    if (!consent) {
      setAiError(
        'Acknowledge the data-sharing notice before requesting live AI. The local cards remain available without sending data.',
      );
      return;
    }
    setAiPending(true);
    setAiError('');
    try {
      const consentToken = await requestConsentToken(['tools']);
      const cardContext = answer.cards
        .map((card) => `${card.title}: ${card.claim}`)
        .join('\n')
        .slice(0, 1000);
      const result = await requestToolExplanation(
        {
          tool: 'document',
          id: 'guideline-navigator',
          context: cardContext,
          question:
            `Using only these evidence card facts, explain the answer to: ${asked}. ` +
            'Do not add facts that are not in the cards.',
        },
        { consentToken },
      );
      if (result.mode === 'emergency') {
        setEmergency(true);
        setAiReply('');
        return;
      }
      setAiReply(result.reply);
    } catch (caught) {
      setAiError(
        caught instanceof Error
          ? caught.message
          : 'Live AI could not respond. The local cards above remain the answer.',
      );
    } finally {
      setAiPending(false);
    }
  }

  return (
    <div className="page-stack">
      <EmergencyBanner />

      <section className="panel">
        <p className="eyebrow">Document and Data AI</p>
        <h2 className="section-title">Guideline Navigator</h2>
        <p>
          Answers are built only from a local library of evidence cards: short paraphrased claims
          from published stroke guidelines, each with its source. If the library does not cover a
          question, the tool says so instead of guessing. {CARD_LABEL}
        </p>
        <p className="muted">Card library last reviewed: {CORPUS_REVIEW_DATE}.</p>
        <div className="dk-tabs" role="group" aria-label="Guideline Navigator modes">
          <button
            type="button"
            className={`dk-tab${tab === 'topics' ? ' is-active' : ''}`}
            aria-pressed={tab === 'topics'}
            onClick={() => setTab('topics')}
          >
            Browse topics
          </button>
          <button
            type="button"
            className={`dk-tab${tab === 'guided' ? ' is-active' : ''}`}
            aria-pressed={tab === 'guided'}
            onClick={() => setTab('guided')}
          >
            Guided questions
          </button>
          <button
            type="button"
            className={`dk-tab${tab === 'ask' ? ' is-active' : ''}`}
            aria-pressed={tab === 'ask'}
            onClick={() => setTab('ask')}
          >
            Ask a question
          </button>
        </div>
      </section>

      {tab === 'topics' && (
        <section className="panel" aria-labelledby="gn-topics">
          <h2 className="section-title" id="gn-topics">
            Topics
          </h2>
          <div className="dk-chip-row">
            {GUIDELINE_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className={`dk-tab${topic.id === topicId ? ' is-active' : ''}`}
                onClick={() => setTopicId(topic.id)}
              >
                {topic.label}
              </button>
            ))}
          </div>
          <p className="muted">{GUIDELINE_TOPICS.find((t) => t.id === topicId)?.blurb}</p>
          <div className="page-stack">
            {cardsForTopic(topicId).map((card) => (
              <EvidenceCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {tab === 'guided' && (
        <section className="panel" aria-labelledby="gn-guided">
          <h2 className="section-title" id="gn-guided">
            Guided questions
          </h2>
          {currentNode && (
            <>
              <p>
                <strong>{currentNode.prompt}</strong>
              </p>
              {currentNode.options && (
                <div className="dk-chip-row">
                  {currentNode.options.map((option) => (
                    <button
                      key={option.next}
                      type="button"
                      className="choice-card"
                      onClick={() => setPath((prev) => [...prev, option.next])}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {currentNode.cardIds && (
                <div className="page-stack">
                  {cardsForNode(currentNode).map((card) => (
                    <EvidenceCardView key={card.id} card={card} />
                  ))}
                </div>
              )}
              <div className="dk-actions">
                {path.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setPath((prev) => prev.slice(0, -1))}
                  >
                    Back one step
                  </button>
                )}
                {path.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setPath([TREE_ROOT_ID])}
                  >
                    Start over
                  </button>
                )}
              </div>
            </>
          )}
          {!currentNode && <p className="muted">This guided path is unavailable.</p>}
        </section>
      )}

      {tab === 'ask' && (
        <section className="panel" aria-labelledby="gn-ask">
          <h2 className="section-title" id="gn-ask">
            Ask a question
          </h2>
          <p className="muted">
            Example questions: &quot;What is the time window for thrombolysis?&quot; or &quot;When
            is aspirin started after stroke?&quot; General education only, in English.
          </p>
          <div className="dk-actions">
            <input
              className="dk-input"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runAsk();
              }}
              placeholder="Type an education question about stroke guidelines"
              aria-label="Guideline question"
            />
            <button type="button" className="btn btn-primary" onClick={runAsk}>
              Search the cards
            </button>
          </div>

          {emergency && (
            <p role="alert">
              <strong>{EMERGENCY_TEXT}</strong>
            </p>
          )}

          {answer && !answer.refused && (
            <div className="page-stack">
              <p className="muted">
                Matched {answer.cards.length} card{answer.cards.length === 1 ? '' : 's'} for
                &quot;{asked}&quot;. These cards are the whole answer; the AI option below may only
                rephrase them.
              </p>
              {answer.cards.map((card) => (
                <EvidenceCardView key={card.id} card={card} />
              ))}
              <ConsentNotice
                scopeLabel="your question and the matched card text"
                checked={consent}
                onChange={setConsent}
              />
              <div className="dk-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={askAi}
                  disabled={aiPending}
                >
                  {aiPending ? 'Asking AI...' : 'Ask AI to explain these cards'}
                </button>
                {!api && (
                  <span className="muted">
                    Live AI is not configured in this build; the local answer above is complete.
                  </span>
                )}
              </div>
              {aiError && <p role="alert">{aiError}</p>}
              {aiReply && (
                <article className="dk-card">
                  <h3>AI explanation of the cards above</h3>
                  <p>{aiReply}</p>
                  <p className="dk-card-label">{CARD_LABEL}</p>
                </article>
              )}
            </div>
          )}

          {answer && answer.refused && (
            <p role="note">
              <strong>No matching card.</strong> {answer.refusalText}
            </p>
          )}
        </section>
      )}

      <UncertaintyNote>
        This navigator summarizes guideline topics for learning. It is not the guideline itself,
        it does not know any individual patient, and local protocols differ between hospitals.
        Every claim here is a paraphrase; verify against the official documents listed on each
        card.
      </UncertaintyNote>
    </div>
  );
}
