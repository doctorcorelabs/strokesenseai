import { TOKENS, readoutValueStyle } from './theme';

export type MeasureQuality = 'good' | 'fair' | 'poor';

/** One measured value with its unit and honest input quality. */
export interface Measure {
  label: string;
  value: string | number;
  unit?: string;
  quality?: MeasureQuality;
  note?: string;
}

export interface MeasureReadoutProps {
  title?: string;
  measures: Measure[];
  /** Text shown when there are no measurements yet. */
  emptyText?: string;
}

const QUALITY_LABELS: Record<MeasureQuality, string> = {
  good: 'Good quality',
  fair: 'Fair quality',
  poor: 'Poor quality',
};

const QUALITY_COLORS: Record<MeasureQuality, string> = {
  good: TOKENS.green,
  fair: TOKENS.amber,
  poor: TOKENS.red,
};

/**
 * Structured readout of measured values. Every value can carry its unit
 * and the quality of the input it came from, so a number is never shown
 * as more certain than its source. Renders an explicit empty state
 * instead of a blank area when nothing has been measured yet.
 */
export default function MeasureReadout({
  title,
  measures,
  emptyText = 'No measurements yet. Run the session to see values here.',
}: MeasureReadoutProps) {
  if (measures.length === 0) {
    return (
      <div>
        {title ? <h3 className="section-title">{title}</h3> : null}
        <p className="muted">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      {title ? <h3 className="section-title">{title}</h3> : null}
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
          margin: 0,
        }}
      >
        {measures.map((measure) => (
          <div
            key={measure.label}
            style={{
              background: TOKENS.mint,
              border: `1px solid ${TOKENS.line}`,
              borderRadius: TOKENS.radiusSm,
              padding: '0.75rem 0.9rem',
            }}
          >
            <dt style={{ color: TOKENS.muted, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              {measure.label}
            </dt>
            <dd style={{ margin: 0 }}>
              <span style={readoutValueStyle}>{measure.value}</span>
              {measure.unit ? (
                <span style={{ color: TOKENS.muted, marginLeft: '0.35rem' }}>{measure.unit}</span>
              ) : null}
            </dd>
            {measure.quality ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: QUALITY_COLORS[measure.quality],
                    marginRight: '0.4rem',
                  }}
                />
                {QUALITY_LABELS[measure.quality]}
              </p>
            ) : null}
            {measure.note ? (
              <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                {measure.note}
              </p>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
