import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FaceDynamicsLab from './FaceDynamicsLab';

function startWithSyntheticBaseline() {
  fireEvent.click(screen.getByRole('button', { name: /synthetic neutral face as baseline/i }));
}

describe('FaceDynamicsLab', () => {
  it('starts at the baseline step with the honesty rules stated', () => {
    const { container } = render(<FaceDynamicsLab />);
    expect(
      screen.getByRole('heading', { name: /Step 1: record a neutral baseline/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never given a pattern label/i)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\bbell\b/i);
    expect(text).not.toMatch(/palsy/i);
    expect(text).not.toMatch(/lesion/i);
  });

  it('records a measured smile from the synthetic performer', () => {
    render(<FaceDynamicsLab />);
    startWithSyntheticBaseline();
    expect(screen.getByRole('heading', { name: /Task 1 of 4: Smile/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Perform with the synthetic performer/i }));
    const table = screen.getByRole('table');
    const smileRow = within(table).getByText('Smile').closest('tr');
    expect(smileRow?.textContent).toMatch(/recorded/);
    expect(smileRow?.textContent).toMatch(/measured/);
    expect(smileRow?.textContent).toMatch(/\+0\.180/);
    expect(screen.getByRole('heading', { name: /Task 2 of 4: Raise your brows/i })).toBeInTheDocument();
  });

  it('supports self report and skip, then finishes the session', () => {
    render(<FaceDynamicsLab />);
    startWithSyntheticBaseline();
    fireEvent.click(screen.getByRole('button', { name: /Perform with the synthetic performer/i }));
    fireEvent.click(screen.getByRole('button', { name: /Mark done without measuring/i }));
    fireEvent.click(screen.getByRole('button', { name: /Skip this task/i }));
    fireEvent.click(screen.getByRole('button', { name: /Perform with the synthetic performer/i }));
    expect(
      screen.getByText(
        /Recorded 3 of 4 tasks \(2 measured, 1 self-reported\), 1 skipped, 0 still pending/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start a new session/i })).toBeInTheDocument();
  });

  it('labels the synthetic reference curve as synthetic', () => {
    render(<FaceDynamicsLab />);
    startWithSyntheticBaseline();
    expect(screen.getAllByText(/Synthetic reference \(labelled teaching curve/i).length).toBeGreaterThan(0);
  });
});
