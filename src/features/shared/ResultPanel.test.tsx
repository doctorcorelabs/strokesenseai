import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MeasureReadout from './MeasureReadout';
import ResultPanel from './ResultPanel';

describe('MeasureReadout', () => {
  it('renders values with unit, quality, and note', () => {
    render(
      <MeasureReadout
        title="Measurements"
        measures={[
          { label: 'Symmetry index', value: 0.92, unit: 'ratio', quality: 'fair', note: 'Left side lower' },
          { label: 'Smile frames', value: 14 },
        ]}
      />,
    );
    expect(screen.getByText('Measurements')).toBeInTheDocument();
    expect(screen.getByText('Symmetry index')).toBeInTheDocument();
    expect(screen.getByText('0.92')).toBeInTheDocument();
    expect(screen.getByText('ratio')).toBeInTheDocument();
    expect(screen.getByText('Fair quality')).toBeInTheDocument();
    expect(screen.getByText('Left side lower')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('renders an explicit empty state', () => {
    render(<MeasureReadout measures={[]} />);
    expect(screen.getByText(/No measurements yet/)).toBeInTheDocument();
  });
});

describe('ResultPanel', () => {
  it('renders the empty state', () => {
    render(<ResultPanel status="empty" />);
    expect(screen.getByText(/No result yet/)).toBeInTheDocument();
  });

  it('renders summary, measures, and the uncertainty note when ready', () => {
    render(
      <ResultPanel
        status="ready"
        summary="The session produced one measurement."
        measures={[{ label: 'Drift', value: '3', unit: 'deg', quality: 'good' }]}
        uncertainty="Lighting was uneven, so treat this value as approximate."
      />,
    );
    expect(screen.getByText('The session produced one measurement.')).toBeInTheDocument();
    expect(screen.getByText('Drift')).toBeInTheDocument();
    expect(screen.getByText('Good quality')).toBeInTheDocument();
    expect(screen.getByText(/approximate/)).toBeInTheDocument();
  });

  it('renders cannot-analyze as a first-class failure', () => {
    render(
      <ResultPanel
        status="cannot-analyze"
        cannotReason="The face was not visible for most of the recording."
        cannotGuidance="Move into even light and try again."
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot analyze');
    expect(screen.getByText('The face was not visible for most of the recording.')).toBeInTheDocument();
    expect(screen.getByText('This result does not mean everything is normal.')).toBeInTheDocument();
  });
});
