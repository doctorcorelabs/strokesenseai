import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DocumentStudio from './DocumentStudio';

describe('DocumentStudio', () => {
  it('shows the example step first with a labelled example result and no consent checkbox', () => {
    render(<DocumentStudio />);
    expect(screen.getByText('Example result')).toBeTruthy();
    expect(screen.getByText('Checklist')).toBeTruthy();
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('loads a fictional sample and runs the analysis in one click', () => {
    render(<DocumentStudio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start trying' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Synthetic sample 1: structured discharge summary/,
      }),
    );
    expect(screen.getByText('Detected: Discharge summary')).toBeTruthy();
    expect(screen.getByText(/facts in this discharge summary/)).toBeTruthy();
    // The honest label is attached twice on purpose: once by the paste box
    // and once on the result sheet itself, so it travels with the result.
    expect(
      screen.getAllByText(/Checked on this device - no AI, no OCR, nothing uploaded/)
        .length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('switches the detected kind with one tap and keeps both outputs', () => {
    render(<DocumentStudio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start trying' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Fictional history 1: several stated factors/ }),
    );
    expect(screen.getByText('Detected: Health history')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Discharge summary' }));
    expect(screen.getByText('Detected: Discharge summary')).toBeTruthy();
    expect(screen.getByText('Risk profile (also found in this text)')).toBeTruthy();
  });
});
