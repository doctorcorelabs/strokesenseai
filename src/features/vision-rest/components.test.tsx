import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GazeTracker from './GazeTracker';
import NeglectExplorer from './NeglectExplorer';
import ScanExplainer from './ScanExplainer';

describe('vision-rest feature pages render', () => {
  it('GazeTracker shows calibration first and the honesty notes', () => {
    render(<GazeTracker />);
    expect(screen.getByRole('heading', { name: 'Eye and Gaze Tracker' })).toBeInTheDocument();
    expect(screen.getByText(/Calibration comes first/)).toBeInTheDocument();
    expect(screen.getByText(/pointer stands in for gaze/)).toBeInTheDocument();
    expect(screen.getByText(/Sudden symptoms\? Act now\./)).toBeInTheDocument();
  });

  it('NeglectExplorer shows the three tasks and the open rubric', () => {
    render(<NeglectExplorer />);
    expect(
      screen.getByRole('heading', { name: 'Visual Field and Neglect Explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancellation task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Line bisection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Peripheral awareness' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulated patient mode' })).toBeInTheDocument();
    expect(screen.getByText(/They are not a label about you/)).toBeInTheDocument();
  });

  it('ScanExplainer shows curated cases, calculator, and practice board', () => {
    render(<ScanExplainer />);
    expect(screen.getByRole('heading', { name: 'Scan Explainer' })).toBeInTheDocument();
    expect(screen.getByText(/A teaching library, not a reading service/)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Core, penumbra, and mismatch/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never uploaded, never sent to the AI coach/)).toBeInTheDocument();
    expect(screen.getByText(/License: CC BY 4.0/)).toBeInTheDocument();
  });
});
