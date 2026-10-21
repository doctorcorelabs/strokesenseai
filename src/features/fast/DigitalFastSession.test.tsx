import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DigitalFastSession from './DigitalFastSession';

function startSession() {
  fireEvent.click(screen.getByRole('button', { name: 'No, nobody has symptoms' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start the session' }));
}

/** Answer every visible checklist item with the given option label. */
function answerAllVisible(label: string) {
  for (const button of screen.getAllByRole('button', { name: label })) {
    fireEvent.click(button);
  }
}

describe('DigitalFastSession', () => {
  it('opens at the symptom gate with a visible safety disclaimer', () => {
    render(<DigitalFastSession />);
    expect(screen.getByRole('heading', { name: 'Symptom gate' })).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose stroke/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /call 119 now/i })).toHaveAttribute('href', 'tel:119');
  });

  it('stops at the gate when symptoms are present and never shows a stage', () => {
    render(<DigitalFastSession />);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, symptoms are present now' }));
    expect(screen.getByRole('heading', { name: 'Do not start this session.' })).toBeInTheDocument();
    expect(screen.queryByText(/smile task/i)).not.toBeInTheDocument();
  });

  it('walks all three stages into a per modality summary', () => {
    render(<DigitalFastSession />);
    startSession();
    expect(screen.getByText(/Ask the person to smile/i)).toBeInTheDocument();

    answerAllVisible('Not observed');
    fireEvent.click(screen.getByRole('button', { name: 'Complete stage and continue' }));
    expect(screen.getByText(/raise both arms/i)).toBeInTheDocument();

    answerAllVisible('Not observed');
    fireEvent.click(screen.getByRole('button', { name: 'Complete stage and continue' }));
    expect(screen.getByText(/repeat the standard sentence/i)).toBeInTheDocument();

    answerAllVisible('Not observed');
    fireEvent.click(screen.getByRole('button', { name: 'Finish and see the summary' }));

    expect(
      screen.getByRole('heading', { name: 'Observation sheets, one per modality' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/cannot rule out stroke/i).length).toBeGreaterThan(0);
    // The coach fallback is the deterministic local interpretation.
    expect(screen.getByText(/Local summary of the Digital FAST Multimodal session/i)).toBeInTheDocument();
  });

  it('halts the whole session the moment a sign is observed', () => {
    render(<DigitalFastSession />);
    startSession();
    const observed = screen.getAllByRole('button', { name: 'Observed' });
    const first = observed[0];
    if (!first) throw new Error('expected checklist buttons');
    fireEvent.click(first);
    expect(
      screen.getByRole('heading', { name: 'A possible stroke sign was observed.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete stage and continue' })).not.toBeInTheDocument();
  });

  it('supports the cannot analyze path for a stage', () => {
    render(<DigitalFastSession />);
    startSession();
    fireEvent.click(screen.getByRole('button', { name: 'Mark stage as cannot analyze' }));
    const complete = screen.getByRole('button', { name: 'Complete stage and continue' });
    expect(complete).not.toBeDisabled();
    fireEvent.click(complete);
    expect(screen.getByText(/raise both arms/i)).toBeInTheDocument();
  });
});
