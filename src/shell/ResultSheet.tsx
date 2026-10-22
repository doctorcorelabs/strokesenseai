// ResultSheet: the one result layout every rebuilt lab ends with.
//
// Three blocks, always in the same order, so a person learns the shape
// once and can read any lab's ending:
// 1. The headline: one conclusion sentence, written by the feature from
//    its real measurement. Nothing else competes with it on the sheet.
// 2. The body: the feature's own visual and detail (bars, charts, word
//    maps, extracted facts).
// 3. The limit row: one line stating what this result is not, with the
//    feature's honest mode label attached to the sheet itself, so the
//    label travels with the result instead of living only in a header.
//
// The cannot-analyze variant replaces block 2 with the planning's
// three-part failure pattern (what happened, why no result is shown,
// what to try). A failed measurement is a first-class ending, never a
// blank area and never a substitute value.

import { useId, type ReactNode } from 'react';
import './shell.css';

export interface CannotAnalyzeInfo {
  /** Specific reason this measurement could not be made, in plain words. */
  reason: string;
  /** One concrete thing the person can try next. */
  suggestion: string;
}

export interface ResultSheetProps {
  /** One conclusion sentence. The first and loudest thing on the sheet. */
  headline: string;
  /** The visual and detail block. Ignored when cannotAnalyze is set. */
  children?: ReactNode;
  /** One line stating the limit of this result, shown in the limit row. */
  limitLine: string;
  /** Honest mode label attached to the sheet, for example "On this device". */
  modeLabel?: string;
  /** When set, the sheet reports a measurement that could not be made. */
  cannotAnalyze?: CannotAnalyzeInfo;
}

export default function ResultSheet({
  headline,
  children,
  limitLine,
  modeLabel,
  cannotAnalyze,
}: ResultSheetProps) {
  const headlineId = useId();
  return (
    <section className="panel result-sheet" aria-labelledby={headlineId}>
      <p className="eyebrow">Your result</p>
      <h2 className="section-title result-headline" id={headlineId}>
        {headline}
      </h2>

      {cannotAnalyze ? (
        <div className="result-cannot">
          <div className="result-cannot-part">
            <h3>What happened</h3>
            <p>{cannotAnalyze.reason}</p>
          </div>
          <div className="result-cannot-part">
            <h3>Why no result is shown</h3>
            <p>
              A result needs a clear enough signal. Showing a guessed value instead would be
              misleading, so this lab reports that it cannot measure rather than inventing a
              number.
            </p>
          </div>
          <div className="result-cannot-part">
            <h3>What you can try</h3>
            <p>{cannotAnalyze.suggestion}</p>
          </div>
          <p className="result-cannot-required">
            This result does not mean everything is normal. If you are experiencing sudden new
            symptoms, call <strong>119</strong> in Indonesia now.
          </p>
        </div>
      ) : (
        <div className="result-body">{children}</div>
      )}

      <div className="result-limit-row">
        {modeLabel ? <span className="badge badge-mode">{modeLabel}</span> : null}
        <p className="result-limit-line">{limitLine}</p>
      </div>
    </section>
  );
}
