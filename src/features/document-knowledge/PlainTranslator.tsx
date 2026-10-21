import { useMemo, useState } from 'react';
import { ConsentNotice, EmergencyBanner, UncertaintyNote } from '../../components/ui';
import { EMERGENCY_TEXT, mentionsAcuteSigns } from '../../safety';
import { getApiBase, requestConsentToken, requestToolExplanation } from '../../ai/client';
import {
  SAMPLE_TEXTS,
  plainRewriteLocal,
  readabilityStats,
  verifyPreserved,
} from './plain-text';
import type { PlainTarget, RewriteResult, VerificationResult } from './plain-text';
import './document-knowledge.css';

const MAX_CHARS = 3000;
const AI_MAX_CHARS = 1000;

interface ProducedResult extends RewriteResult {
  source: 'local' | 'ai';
  verification: VerificationResult;
}

function StatsLine({ text, lang }: { text: string; lang: 'en' | 'id' }) {
  const stats = useMemo(() => readabilityStats(text), [text]);
  if (stats.words === 0) return <p className="muted">No text yet.</p>;
  return (
    <p className="muted">
      {stats.words} words, {stats.sentences} sentences. Reading grade estimate: {stats.gradeLevel}{' '}
      ({stats.label}).
      {lang === 'id' &&
        ' The grade estimate formula is designed for English, so treat it as a rough guide only for Indonesian text.'}
    </p>
  );
}

/**
 * Plain-Language Translator workspace. The original text is always shown
 * beside the simplified version. Local mode rewrites with the curated
 * glossary; AI mode is optional and its output must pass the deterministic
 * number and medicine name check before it is shown as the result.
 */
export default function PlainTranslator() {
  const api = getApiBase();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState<PlainTarget>('en');
  const [result, setResult] = useState<ProducedResult | null>(null);
  // The data-sharing notice belongs to the AI path only. It stays hidden
  // until the visitor actually chooses "Simplify with AI"; the local path
  // never shows it and never needs it.
  const [aiRequested, setAiRequested] = useState(false);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [emergency, setEmergency] = useState(false);

  function runLocal() {
    const rewrite = plainRewriteLocal(input, target);
    setResult({
      ...rewrite,
      source: 'local',
      verification: verifyPreserved(input, rewrite.text),
    });
    setNotice(
      rewrite.replacedTerms.length === 0
        ? 'The local glossary found no listed medical terms to simplify in this text. The text is shown unchanged beside the original.'
        : '',
    );
  }

  async function runAi() {
    if (pending) return;
    setNotice('');
    // Emergency guard runs before any AI pipeline, as everywhere on this site.
    if (mentionsAcuteSigns(input)) {
      setEmergency(true);
      return;
    }
    setEmergency(false);
    if (!api) {
      setNotice(
        'Live AI is not configured in this build. Use the local simplify button; it works fully on this device.',
      );
      return;
    }
    if (!consent) {
      // First click on the AI path only reveals the notice; nothing is sent
      // until the visitor ticks its box and presses the AI button again.
      setAiRequested(true);
      setNotice(
        'Live AI would send the pasted text to the AI service, so its data-sharing notice is now shown above the buttons. Tick its box, then press Simplify with AI again. Nothing has been sent yet. The local simplify button needs no consent and sends nothing.',
      );
      return;
    }
    if (input.length > AI_MAX_CHARS) {
      setNotice(
        `AI mode in this build accepts up to ${AI_MAX_CHARS} characters at a time. Shorten the text or use the local simplify button, which handles the full ${MAX_CHARS} characters.`,
      );
      return;
    }
    setPending(true);
    try {
      const consentToken = await requestConsentToken(['tools']);
      const reply = await requestToolExplanation(
        {
          tool: 'document',
          id: 'plain-translator',
          context: input,
          question:
            target === 'en'
              ? 'Rewrite the context text in plain English at a grade 6 to 8 reading level. Keep every number, dose, unit, date, and medicine name exactly the same. Do not add facts or advice.'
              : 'Rewrite the context text in simple everyday Indonesian (Bahasa Indonesia awam). Keep every number, dose, unit, date, and medicine name exactly the same. Do not add facts or advice.',
        },
        { consentToken },
      );
      if (reply.mode === 'emergency') {
        setEmergency(true);
        return;
      }
      const verification = verifyPreserved(input, reply.reply);
      if (!verification.ok) {
        // The check failed: the AI wording is rejected, never shown as the
        // result. Fall back to the local rewrite and say exactly why.
        const rewrite = plainRewriteLocal(input, target);
        setResult({
          ...rewrite,
          source: 'local',
          verification: verifyPreserved(input, rewrite.text),
        });
        setNotice(
          'The AI version was rejected because it changed protected details ' +
            `(numbers: ${[...verification.missingNumbers, ...verification.addedNumbers].join(', ') || 'none'}; ` +
            `medicine names: ${[...verification.missingMedicines, ...verification.addedMedicines].join(', ') || 'none'}). ` +
            'The local glossary version is shown instead.',
        );
        return;
      }
      setResult({ text: reply.reply, replacedTerms: [], source: 'ai', verification });
    } catch (caught) {
      setNotice(
        caught instanceof Error
          ? caught.message
          : 'Live AI could not respond. The local simplify button remains available.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-stack">
      <EmergencyBanner />

      <section className="panel">
        <p className="eyebrow">Document and Data AI</p>
        <h2 className="section-title">Plain-Language Translator</h2>
        <p>
          Paste medical text and get an everyday wording beside it. Numbers, doses, units, dates,
          and medicine names are locked and checked after every rewrite; a version that changes
          them is rejected, never quietly shown. The simplified text is a rewording, not new
          medical advice, and the original is never hidden.
        </p>
        <p className="muted">
          This is the one tool on this site that can output Indonesian, by design:{' '}
          <span lang="id">teks medis dapat disederhanakan ke Bahasa Indonesia awam</span>.
        </p>
        <div className="dk-chip-row">
          {SAMPLE_TEXTS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="dk-tab"
              onClick={() => {
                setInput(sample.text);
                setResult(null);
                setNotice('');
              }}
            >
              {sample.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="pt-workspace">
        <h2 className="section-title" id="pt-workspace">
          Your text
        </h2>
        <label htmlFor="pt-input">
          <strong>Medical text</strong> (up to {MAX_CHARS} characters). Do not paste text that
          identifies a real person.
        </label>
        <textarea
          id="pt-input"
          className="dk-textarea"
          value={input}
          maxLength={MAX_CHARS}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste medical text here, for example a discharge summary paragraph."
        />
        <p className="muted">
          {input.length} / {MAX_CHARS} characters. Simplify on this device accepts up to{' '}
          {MAX_CHARS} characters; Simplify with AI accepts up to {AI_MAX_CHARS} characters.
        </p>

        <div className="dk-actions" role="group" aria-label="Target language">
          <button
            type="button"
            className={`dk-tab${target === 'en' ? ' is-active' : ''}`}
            onClick={() => setTarget('en')}
          >
            Plain English
          </button>
          <button
            type="button"
            className={`dk-tab${target === 'id' ? ' is-active' : ''}`}
            onClick={() => setTarget('id')}
            lang="id"
          >
            Bahasa Indonesia awam
          </button>
        </div>

        {(aiRequested || consent) && (
          <ConsentNotice
            scopeLabel="the text you pasted"
            checked={consent}
            onChange={setConsent}
          />
        )}
        <div className="dk-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={runLocal}
            disabled={input.trim().length === 0}
          >
            Simplify on this device
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={runAi}
            disabled={pending || input.trim().length === 0 || input.length > AI_MAX_CHARS}
            aria-describedby={input.length > AI_MAX_CHARS ? 'pt-ai-limit' : undefined}
          >
            {pending ? 'Asking AI...' : 'Simplify with AI'}
          </button>
        </div>
        {input.length > AI_MAX_CHARS && (
          <p className="muted" id="pt-ai-limit">
            Simplify with AI is unavailable for this text: live AI accepts up to {AI_MAX_CHARS}{' '}
            characters at a time and the box now holds {input.length}. Shorten the text, or use
            Simplify on this device, which accepts the full {MAX_CHARS} characters.
          </p>
        )}
        {notice && <p role="note">{notice}</p>}
        {emergency && (
          <p role="alert">
            <strong>{EMERGENCY_TEXT}</strong>
          </p>
        )}
      </section>

      {result && (
        <section className="panel" aria-labelledby="pt-result">
          <h2 className="section-title" id="pt-result">
            Side by side
          </h2>
          <div
            className={`dk-verify ${result.verification.ok ? 'dk-verify-ok' : 'dk-verify-warn'}`}
            role="status"
          >
            {result.verification.ok
              ? 'All numbers and medicine names checked unchanged.'
              : 'Warning: protected details differ between the two versions. Compare the highlighted text before using it.'}
            {' Source of this version: '}
            {result.source === 'ai' ? 'live AI, checked on this device' : 'local glossary'}.
          </div>
          <div className="dk-side-by-side">
            <article className="dk-card">
              <h3>Original</h3>
              <p>{input}</p>
              <StatsLine text={input} lang="en" />
            </article>
            <article className="dk-card">
              <h3>{target === 'en' ? 'Plain English' : 'Bahasa Indonesia awam'}</h3>
              <p lang={target === 'id' ? 'id' : 'en'}>{result.text}</p>
              <StatsLine text={result.text} lang={target} />
            </article>
          </div>
          {result.replacedTerms.length > 0 && (
            <p>
              <strong>Terms simplified:</strong>{' '}
              {result.replacedTerms.map((term) => (
                <span key={term} className="dk-term-chip">
                  {term}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      <UncertaintyNote>
        Simplification can lose nuance. If the plain version and the original ever seem to say
        different things, the original is the source of truth. Do not act on a simplified text
        alone for medicine doses or schedules; confirm with the care team.
      </UncertaintyNote>
    </div>
  );
}
