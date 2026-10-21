import type { ReactNode } from 'react';
import { CannotAnalyzePanel, UncertaintyNote } from '../../components/ui';
import MeasureReadout from './MeasureReadout';
import type { Measure } from './MeasureReadout';

export type ResultStatus = 'empty' | 'ready' | 'cannot-analyze';

export interface ResultPanelProps {
  title?: string;
  status: ResultStatus;
  /** Plain-language summary shown above the measurements when ready. */
  summary?: string;
  measures?: Measure[];
  /** Uncertainty statement rendered next to the result, never in a footer. */
  uncertainty?: string;
  /** Failure reason and guidance used by the cannot-analyze state. */
  cannotReason?: string;
  cannotGuidance?: string;
  /** Extra content (charts, explanations) rendered inside the ready state. */
  children?: ReactNode;
}

/**
 * The one result surface for every lab. It has exactly three states:
 * empty (nothing measured yet), ready (summary, measurements, and the
 * uncertainty note side by side), and cannot-analyze (a first-class
 * failure with a specific reason). A failed analysis is never dressed
 * up as a normal result.
 */
export default function ResultPanel({
  title = 'Result',
  status,
  summary,
  measures,
  uncertainty,
  cannotReason,
  cannotGuidance,
  children,
}: ResultPanelProps) {
  if (status === 'cannot-analyze') {
    return (
      <section aria-label={title}>
        <CannotAnalyzePanel
          role="alert"
          reason={cannotReason ?? 'The input did not meet the quality needed for a measurement.'}
          guidance={
            cannotGuidance ??
            'Check the input guidance for this lab and try again. No value was estimated in place of the missing measurement.'
          }
        />
      </section>
    );
  }

  return (
    <section className="panel" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      {status === 'empty' ? (
        <p className="muted">No result yet. Run the session to see measurements here.</p>
      ) : (
        <>
          {summary ? <p>{summary}</p> : null}
          {measures ? <MeasureReadout measures={measures} /> : null}
          {children}
          {uncertainty ? <UncertaintyNote>{uncertainty}</UncertaintyNote> : null}
        </>
      )}
    </section>
  );
}
