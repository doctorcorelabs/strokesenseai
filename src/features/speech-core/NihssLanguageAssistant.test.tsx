import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NihssLanguageAssistant from './NihssLanguageAssistant';

function completeAllTasks() {
  fireEvent.click(screen.getByRole('button', { name: /Start the naming task/i }));
  for (const button of screen.getAllByRole('button', { name: /Reveal patient answer/i })) {
    fireEvent.click(button);
  }
  fireEvent.click(screen.getByRole('button', { name: /Continue to the reading task/i }));
  fireEvent.click(screen.getByRole('button', { name: /Reveal patient attempt/i }));
  fireEvent.click(screen.getByRole('button', { name: /Continue to the conversation task/i }));
  fireEvent.click(screen.getByRole('button', { name: /Reveal patient response/i }));
  fireEvent.click(screen.getByRole('button', { name: /Continue to scoring/i }));
}

describe('NihssLanguageAssistant', () => {
  it('is watermarked as a training simulation and never offers a clinical score', () => {
    render(<NihssLanguageAssistant />);
    expect(screen.getByText(/TRAINING SIMULATION - NOT FOR CLINICAL USE/i)).toBeInTheDocument();
    expect(screen.getByText(/not the official scale/i)).toBeInTheDocument();
    expect(screen.getByText(/Never use this flow on a real patient/i)).toBeInTheDocument();
  });

  it('keeps the case key hidden until the student submits a score', () => {
    render(<NihssLanguageAssistant />);
    completeAllTasks();
    expect(screen.getByText(/The key stays hidden until you submit/i)).toBeInTheDocument();
    expect(screen.queryByText(/Case key, fixed by the author/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Why the author set that key/i)).not.toBeInTheDocument();
  });

  it('walks a case end to end and reveals the key with feedback after scoring', () => {
    render(<NihssLanguageAssistant />);
    completeAllTasks();
    fireEvent.click(screen.getByLabelText(/0 - No aphasia/i));
    fireEvent.change(screen.getByLabelText(/Justification/i), {
      target: { value: 'Naming correct, reading exact, conversation fluent.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit score and reveal the case key/i }));

    expect(screen.getByText(/Your score matches the case key/i)).toBeInTheDocument();
    expect(screen.getByText(/Case key, fixed by the author: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Why the author set that key/i)).toBeInTheDocument();
    const draft = screen.getByLabelText(/Documentation draft/i) as HTMLTextAreaElement;
    expect(draft.value).toContain('TRAINING SIMULATION NOTE');
    expect(draft.value).toContain('Naming correct, reading exact, conversation fluent.');
  });

  it('requires every naming answer to be revealed before continuing', () => {
    render(<NihssLanguageAssistant />);
    fireEvent.click(screen.getByRole('button', { name: /Start the naming task/i }));
    const continueButton = screen.getByRole('button', { name: /Continue to the reading task/i });
    expect(continueButton).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /Reveal patient answer/i })) {
      fireEvent.click(button);
    }
    expect(continueButton).not.toBeDisabled();
  });
});
