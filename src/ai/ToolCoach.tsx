import type {} from '../vite-env';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, LoaderCircle, LockKeyhole, Phone, Sparkles } from 'lucide-react';
import { LAB_RESOURCES, type LabSource } from '../../shared/lab';
import { EMERGENCY_TEXT, mentionsAcuteSigns, RESOURCE_LINKS } from '../safety';
import { ConsentNotice, MODE_LABELS } from '../components/ui';
import { getApiBase, requestConsentToken, requestToolExplanation } from './client';
import { matchOfflineTopic } from './offline';
import './coach.css';

// Faithful Indonesian rendering of the main sentences of EMERGENCY_TEXT.
// Safety text is bilingual by decision; the rest of the UI stays English.
const EMERGENCY_TEXT_ID =
  'Tanda-tanda yang mungkin merupakan stroke adalah keadaan darurat medis. Segera hubungi 119 di Indonesia, atau layanan darurat setempat bila Anda berada di tempat lain. Jangan menunggu balasan obrolan, meskipun gejala hilang.';

export type ToolCoachProps = {
  tool: string;
  moduleId: string;
  context?: string;
  fallback: string;
  title?: string;
};

type CoachMode = 'guide' | 'live' | 'emergency';

const ALLOWED_SOURCES: LabSource[] = [...Object.values(LAB_RESOURCES), ...RESOURCE_LINKS];

export default function ToolCoach({
  tool,
  moduleId,
  context = '',
  fallback,
  title = 'AI explanation',
}: ToolCoachProps) {
  const api = getApiBase();
  const selection = `${tool}:${moduleId}:${context}`;
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [reply, setReply] = useState('');
  const [sources, setSources] = useState<LabSource[]>([]);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<CoachMode>('guide');
  const [error, setError] = useState('');
  const generation = useRef(0);

  // A new tool or module invalidates the old answer and the old consent:
  // consent given for one selection never silently covers another.
  useEffect(() => {
    generation.current += 1;
    setReply('');
    setSources([]);
    setError('');
    setPending(false);
    setMode('guide');
  }, [selection]);

  useEffect(() => {
    setConsent(false);
    setQuestion('');
  }, [tool, moduleId]);

  async function explain() {
    if (pending) return;
    setError('');
    // The emergency check runs first: before offline mode, before
    // consent, and before any network request.
    if (mentionsAcuteSigns(question)) {
      setReply(EMERGENCY_TEXT);
      setSources(RESOURCE_LINKS);
      setMode('emergency');
      return;
    }
    if (!api) {
      // Offline: a typed question is never ignored. Match it against the
      // prewritten topics first; if nothing fits, show the guide and say
      // plainly that free-form questions need the live AI.
      const topic = matchOfflineTopic(question);
      if (topic) {
        setReply(topic.reply);
      } else if (question.trim()) {
        setReply(
          `${fallback} Free-form questions need the live AI, which is not configured in this build, so this prewritten guide is the offline answer for this tool.`,
        );
      } else {
        setReply(fallback);
      }
      setSources(Object.values(LAB_RESOURCES));
      setMode('guide');
      return;
    }
    if (!consent) {
      setError(
        'Acknowledge the data-sharing notice before requesting live AI. The local guide remains available without sending data.',
      );
      return;
    }
    const revision = generation.current;
    setPending(true);
    try {
      // The checkbox is the agreement; this records it with the Worker and
      // returns the consent token. If recording fails, show the honest
      // error and send nothing: there is no tools request without a token.
      let consentToken: string;
      try {
        consentToken = await requestConsentToken(['tools']);
      } catch (caught) {
        if (revision !== generation.current) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Your consent could not be recorded, so nothing was sent. The local guide remains available.',
        );
        return;
      }
      if (revision !== generation.current) return;
      const result = await requestToolExplanation(
        {
          tool,
          id: moduleId,
          context,
          question,
        },
        { consentToken },
      );
      if (revision !== generation.current) return;
      setSources(result.sources.filter((source) => ALLOWED_SOURCES.some((known) => known.url === source.url)));
      setReply(result.reply);
      setMode(result.mode);
    } catch (caught) {
      if (revision !== generation.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : 'Live AI could not respond. The local guide remains available.',
      );
    } finally {
      if (revision === generation.current) setPending(false);
    }
  }

  const displayedSources = sources.length ? sources : Object.values(LAB_RESOURCES);
  // One label source for the whole product: MODE_LABELS in components/ui.
  // The badge names the mode of the answer currently on screen: a live
  // reply, emergency guidance, or the prewritten offline guide.
  const modeLabel =
    mode === 'emergency'
      ? MODE_LABELS.emergency
      : mode === 'live'
        ? MODE_LABELS.live
        : MODE_LABELS.offline;

  return (
    <section className="coach" aria-label={title}>
      <div className="coach-heading">
        <span className="coach-avatar">
          <Bot size={23} aria-hidden="true" />
        </span>
        <div>
          <p className="coach-eyebrow">Contextual AI coach</p>
          <h3>{title}</h3>
        </div>
        <span className="badge badge-mode">{modeLabel}</span>
      </div>

      <div className="coach-reply" role="status" aria-live="polite">
        <p>{reply || fallback}</p>
        {mode === 'emergency' && (
          <>
            <p lang="id" className="reply-id">
              {EMERGENCY_TEXT_ID}
            </p>
            <a className="btn btn-danger" href="tel:119">
              <Phone size={16} aria-hidden="true" />
              Call 119 now
            </a>
          </>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void explain();
        }}
      >
        <label className="coach-label" htmlFor={`coach-q-${tool}-${moduleId}`}>
          Ask about this tool (optional)
        </label>
        <div className="coach-input-row">
          <input
            id={`coach-q-${tool}-${moduleId}`}
            className="form-input"
            value={question}
            maxLength={600}
            placeholder="What does this selection illustrate?"
            onChange={(event) => setQuestion(event.target.value)}
            disabled={pending}
          />
          <button className="btn btn-primary" disabled={pending} type="submit">
            {pending ? (
              <LoaderCircle className="coach-spinner" size={16} aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            {pending ? 'Explaining...' : api ? 'Explain with AI' : 'Show local guide'}
          </button>
        </div>
        {api && (
          <ConsentNotice
            scopeLabel="this tool selection, its display settings, and your question"
            checked={consent}
            onChange={setConsent}
          />
        )}
      </form>

      {error && (
        <p role="alert" className="coach-error">
          {error}
        </p>
      )}

      <div className="coach-sources">
        <span>Supporting resources</span>
        {displayedSources.map((source) => (
          <a href={source.url} key={source.url} target="_blank" rel="noreferrer">
            {source.title}
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        ))}
      </div>

      <p className="coach-footer">
        <LockKeyhole size={13} aria-hidden="true" />
        {api
          ? 'Generated explanations may be wrong. Supporting resources are not proof that every AI statement is verified. No chat history, images, or video are sent by this tool.'
          : 'No AI request is sent in offline mode. This explanation is curated text, not a generated response.'}
      </p>
    </section>
  );
}
