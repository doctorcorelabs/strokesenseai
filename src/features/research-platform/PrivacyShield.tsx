import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Copy, Download, Eraser, ShieldCheck } from 'lucide-react';
import type { PiiMatch } from './pii';
import { PII_CATEGORY_LABELS, maskPii } from './pii';
import './research-platform.css';

// Fully synthetic sample with invented identifiers, so learners can try
// the tool without pasting anything real.
const SAMPLE_TEXT =
  'Patient: Budi Hartono, DOB: 14/02/1960. No. RM: 00-7781. ' +
  'His daughter can be reached at 0812-9000-1111 or keluarga.contoh@example.com. ' +
  'Dr. Maya Chen reviewed the head CT from 2026-01-05 and noted a left MCA infarct. ' +
  'NIK on file: 3171-0101-0101-0001. Ibu Sari will bring the discharge papers tomorrow.';

function HighlightedText({ text, matches }: { text: string; matches: PiiMatch[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) {
      parts.push(<span key={`plain-${index}`}>{text.slice(cursor, match.start)}</span>);
    }
    parts.push(
      <mark key={`mark-${index}`} className={`rp-mark rp-mark-${match.category}`}>
        {match.original}
      </mark>,
    );
    cursor = match.end;
  });
  if (cursor < text.length) parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <p className="rp-pane-text">{parts}</p>;
}

/**
 * Privacy Shield workspace: paste text, see likely personal identifiers
 * highlighted, and take away a masked copy. Detection and masking run
 * entirely in this browser tab using the local patterns in pii.ts; the
 * text is never uploaded, stored, or sent to the AI service.
 */
export default function PrivacyShield() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const result = useMemo(() => maskPii(input), [input]);
  const hasInput = input.trim().length > 0;

  function downloadMasked() {
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'privacy-shield-masked.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Masked text downloaded as privacy-shield-masked.txt.');
  }

  async function copyMasked() {
    try {
      await navigator.clipboard.writeText(result.text);
      setStatus('Masked text copied to the clipboard.');
    } catch {
      setStatus('Copying was blocked by the browser. Select the masked text and copy it manually.');
    }
  }

  return (
    <div className="rp-stack">
      <section className="panel" aria-labelledby="ps-about">
        <h2 className="section-title" id="ps-about">
          <ShieldCheck size={20} aria-hidden="true" /> See identifiers before you share text
        </h2>
        <p>
          Paste a draft message, case note, or document excerpt below. Privacy Shield scans it
          locally for patterns that look like personal identifiers (names after greetings and
          labels, dates, phone numbers, email addresses, medical record and national ID numbers)
          and shows a masked copy you can share instead.
        </p>
        <p>
          <strong>Everything happens on this device.</strong> The text you paste is processed in
          this browser tab only. It is not uploaded, not stored, and never sent to the AI service.
        </p>
        <p className="muted">
          Honest limits: this is a pattern-matching learning aid, not an official compliance tool
          and not a guarantee. It can miss identifiers and can mask words that are not
          identifiers. Always read the masked copy yourself before sharing it anywhere.
        </p>
      </section>

      <section className="panel" aria-labelledby="ps-input">
        <h2 className="section-title" id="ps-input">
          Your text
        </h2>
        <label className="rp-label" htmlFor="ps-text">
          Paste text to check (invented examples are best while learning)
        </label>
        <textarea
          id="ps-text"
          className="rp-textarea"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Paste text here, or load the synthetic sample to see how masking works."
          maxLength={20000}
        />
        <div className="rp-actions">
          <button type="button" className="btn" onClick={() => setInput(SAMPLE_TEXT)}>
            Load synthetic sample
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setInput('');
              setStatus('');
            }}
            disabled={!hasInput}
          >
            <Eraser size={16} aria-hidden="true" /> Clear
          </button>
        </div>

        {hasInput && (
          <>
            <p role="status">
              {result.total === 0
                ? 'No identifier patterns were found. That is not proof the text is safe to share; read it once more yourself.'
                : `Found ${result.total} likely identifier${result.total === 1 ? '' : 's'}:`}
            </p>
            {result.total > 0 && (
              <ul className="rp-chips">
                {Object.entries(result.counts).map(([category, count]) => (
                  <li key={category} className="rp-chip">
                    {PII_CATEGORY_LABELS[category as keyof typeof PII_CATEGORY_LABELS]}: {count}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {hasInput && (
        <section className="panel" aria-labelledby="ps-preview">
          <h2 className="section-title" id="ps-preview">
            Before and after
          </h2>
          <div className="rp-grid">
            <div className="rp-pane">
              <h3>Original, with finds highlighted</h3>
              <HighlightedText text={input} matches={result.matches} />
            </div>
            <div className="rp-pane">
              <h3>Masked copy</h3>
              <p className="rp-pane-text">{result.text}</p>
            </div>
          </div>

          {result.matches.length > 0 && (
            <>
              <h3>What was masked</h3>
              <ul className="rp-match-list">
                {result.matches.map((match, index) => (
                  <li key={`${match.start}-${index}`}>
                    <strong>{match.label}:</strong> <code>{match.original}</code> becomes{' '}
                    <code>{match.replacement}</code>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="rp-actions">
            <button type="button" className="btn btn-primary" onClick={downloadMasked}>
              <Download size={16} aria-hidden="true" /> Download masked text
            </button>
            <button type="button" className="btn" onClick={() => void copyMasked()}>
              <Copy size={16} aria-hidden="true" /> Copy masked text
            </button>
          </div>
          {status && (
            <p role="status" className="muted">
              {status}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export { PrivacyShield as PrivacyShieldWorkspace };
