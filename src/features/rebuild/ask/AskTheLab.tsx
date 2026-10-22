import { useState } from 'react';
import { LoaderCircle, Send, ShieldCheck } from 'lucide-react';
import { getFeature } from '../../../../shared/registry';
import { LabShell } from '../../../shell';
import { ConsentNotice, EmergencyBanner } from '../../../components/ui';
import {
  getApiBase,
  hasSessionConsent,
  revokeSessionConsent,
} from '../../../ai/client';
import { getLastActivity } from '../../../ai/lastActivity';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../../safety';
import { requestAsk } from './askClient';
import type { ToolSource } from '../../../ai/client';
import './ask.css';

// Faithful Indonesian rendering of the main sentences of EMERGENCY_TEXT,
// matching the coach. Safety text is bilingual by decision; the rest of
// the UI stays English.
const EMERGENCY_TEXT_ID =
  'Tanda-tanda yang mungkin merupakan stroke adalah keadaan darurat medis. Segera hubungi 119 di Indonesia, atau layanan darurat setempat bila Anda berada di tempat lain. Jangan menunggu balasan obrolan, meskipun gejala hilang.';

const GENERAL_CHIPS = [
  'What does FAST stand for?',
  'What can this lab not do?',
  'How is my information handled here?',
  'Why does the lab ask for consent before AI answers?',
] as const;

interface ChatMessage {
  role: 'user' | 'assistant' | 'note';
  text: string;
  mode?: 'live' | 'emergency';
  sources?: ToolSource[];
}

/**
 * Step 1 content: two short sample exchanges, clearly labelled as
 * written examples. Nothing here is a live conversation.
 */
function AskExample() {
  return (
    <>
      <h2 className="section-title">See a finished example</h2>
      <p>
        Ask the Lab is the one door for questions about this whole site: what a feature does,
        how it works, and what it cannot do. These are written examples, not a live chat.
      </p>
      <p className="ask-example-label">Example conversation</p>
      <div className="ask-messages" aria-label="Example conversation">
        <div className="ask-bubble ask-bubble-user">
          <p>What does FAST stand for?</p>
        </div>
        <div className="ask-bubble ask-bubble-assistant">
          <p>
            FAST is a memory aid for stroke signs: Face drooping, Arm weakness, Speech
            difficulty, and Time to call emergency services. In Indonesia the number is 119.
            This is general education, not a diagnosis or individualized medical advice.
          </p>
        </div>
        <div className="ask-bubble ask-bubble-user">
          <p>Can you tell whether my scan shows a stroke?</p>
        </div>
        <div className="ask-bubble ask-bubble-assistant">
          <p>
            No. This lab cannot diagnose or advise on an individual case, and it cannot read
            scans. It can explain, in general terms, what a scan is used for. Decisions about
            your own care belong to your treating clinician.
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Step 2 content: the chat itself. One session consent covers it (the
 * same consent record every lab uses, chat scope here); the Worker door
 * behind it runs the same emergency guard, redaction, and rate limits as
 * the rest of the site. When the person just came from a lab, a short
 * context note (the feature label and counts only, from lastActivity)
 * travels with each question.
 */
function AskChat() {
  const apiConfigured = Boolean(getApiBase());
  const [activity] = useState(() => getLastActivity());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentPrompt, setConsentPrompt] = useState(false);
  const [sessionAgreed, setSessionAgreed] = useState(() => hasSessionConsent('chat'));

  const contextNote = activity ? `${activity.label}: ${activity.detail}` : undefined;
  const contextChips = activity
    ? [`Explain what I just did in ${activity.label}`, `What should I try after ${activity.label}?`]
    : [];

  function revokeConsent() {
    revokeSessionConsent();
    setSessionAgreed(false);
    setConsent(false);
    setConsentPrompt(false);
  }

  async function send(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || pending) return;
    // The local emergency check runs first, before consent and before
    // any network call, mirroring the coach: a symptom report gets the
    // static emergency guidance immediately, even in an offline build.
    if (mentionsAcuteSigns(question)) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        { role: 'assistant', text: EMERGENCY_TEXT, mode: 'emergency' },
      ]);
      setDraft('');
      setShowEmergency(true);
      return;
    }
    if (!apiConfigured) return;
    if (!sessionAgreed && !consent) {
      setDraft(question);
      setConsentPrompt(true);
      return;
    }
    setPending(true);
    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    try {
      const result = await requestAsk({ question, context: contextNote });
      setSessionAgreed(hasSessionConsent('chat'));
      setConsentPrompt(false);
      if (result.mode === 'emergency') setShowEmergency(true);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: result.reply, mode: result.mode, sources: result.sources },
      ]);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Live AI could not respond.';
      setMessages((prev) => [...prev, { role: 'note', text: message }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel ask-chat" aria-label="Ask the Lab chat">
      <h2 className="section-title">Ask a question</h2>
      <p className="muted">
        General questions about this lab and about stroke education. This door cannot
        diagnose or advise on an individual case.
      </p>

      {showEmergency ? <EmergencyBanner variant="full" /> : null}

      {messages.length ? (
        <div className="ask-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === 'user'
                  ? 'ask-bubble ask-bubble-user'
                  : message.role === 'note'
                    ? 'ask-bubble ask-bubble-note'
                    : message.mode === 'emergency'
                      ? 'ask-bubble ask-bubble-assistant ask-bubble-emergency'
                      : 'ask-bubble ask-bubble-assistant'
              }
            >
              <p>{message.text}</p>
              {message.mode === 'emergency' ? (
                <>
                  <p lang="id" className="ask-emergency-id">
                    {EMERGENCY_TEXT_ID}
                  </p>
                  <a className="btn btn-danger" href="tel:119">
                    Call 119 now
                  </a>
                </>
              ) : null}
              {message.sources?.length ? (
                <ul className="ask-sources">
                  {message.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="ask-chip-groups">
        <div>
          <p className="ask-chip-title">General questions</p>
          <div className="ask-chips">
            {GENERAL_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="btn ask-chip"
                disabled={pending}
                onClick={() => void send(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
        {contextChips.length ? (
          <div>
            <p className="ask-chip-title">About your last activity: {activity?.label}</p>
            <div className="ask-chips">
              {contextChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="btn ask-chip"
                  disabled={pending}
                  onClick={() => void send(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!apiConfigured ? (
        <p className="ask-offline-note">
          Live AI is not configured in this build, so questions cannot be sent. The example
          above and every lab on this site still work.
        </p>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label className="ask-label" htmlFor="ask-question">
              Your question
            </label>
            <div className="ask-composer">
              <input
                id="ask-question"
                className="form-input"
                value={draft}
                maxLength={2000}
                placeholder="Ask about any lab on this site"
                onChange={(event) => setDraft(event.target.value)}
                disabled={pending}
              />
              <button className="btn btn-primary" disabled={pending || !draft.trim()} type="submit">
                {pending ? (
                  <LoaderCircle className="ask-spinner" size={16} aria-hidden="true" />
                ) : (
                  <Send size={16} aria-hidden="true" />
                )}
                {pending ? 'Asking...' : 'Ask'}
              </button>
            </div>
          </form>
          {sessionAgreed ? (
            <p className="ask-consent-given">
              <ShieldCheck size={15} aria-hidden="true" />
              <span>
                AI consent given for this session. It covers live AI in every lab until you
                revoke it or close this tab.
              </span>
              <button type="button" className="ask-consent-revoke" onClick={revokeConsent}>
                Revoke consent
              </button>
            </p>
          ) : (
            <ConsentNotice
              scopeLabel="your question and a short activity note with labels and counts only"
              checked={consent}
              onChange={(checked) => {
                setConsent(checked);
                if (checked) setConsentPrompt(false);
              }}
            />
          )}
          {consentPrompt && !consent && !sessionAgreed ? (
            <p className="ask-consent-prompt">
              One step before live AI: tick the agreement box above so the service may
              process your question, then press Ask again.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function AskTheLab() {
  const feature = getFeature('ask-the-lab');
  if (!feature) {
    return (
      <section className="panel">
        <h1 className="section-title">Lab not found</h1>
        <p className="muted">Ask the Lab is not registered in this build.</p>
      </section>
    );
  }
  return <LabShell feature={feature} example={<AskExample />} tryIt={<AskChat />} />;
}
