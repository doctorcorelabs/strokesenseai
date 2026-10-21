import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SpeechAnalyzer from './SpeechAnalyzer';

describe('SpeechAnalyzer', () => {
  it('shows the practice disclaimer and the symptom gate first', () => {
    render(<SpeechAnalyzer />);
    expect(screen.getByText(/Practice tool, not a medical test/i)).toBeInTheDocument();
    expect(screen.getByText(/does not detect dysarthria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/I am practicing/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/My speech is slurred/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a sentence/i)).not.toBeInTheDocument();
  });

  it('blocks the analyzer and shows the emergency banner when symptoms are happening now', () => {
    render(<SpeechAnalyzer />);
    fireEvent.click(screen.getByLabelText(/My speech is slurred/i));
    expect(screen.getByText(/The analyzer is paused/i)).toBeInTheDocument();
    expect(screen.getByText(/Call 119 now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choose a sentence/i)).not.toBeInTheDocument();
  });

  it('runs a typed transcript through the deterministic analysis', async () => {
    render(<SpeechAnalyzer />);
    fireEvent.click(screen.getByLabelText(/I am practicing/i));
    expect(screen.getByText(/Choose a sentence/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Transcript of the reading/i), {
      target: { value: 'The quick brown fox jumps over the lazy dog' },
    });
    fireEvent.change(screen.getByLabelText(/Reading duration in seconds/i), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Analyze reading/i }));

    expect(await screen.findByText(/What the machine heard/i)).toBeInTheDocument();
    expect(screen.getByText(/Word error rate:/i)).toBeInTheDocument();
    expect(screen.getByText(/9 of 9 target words matched/i)).toBeInTheDocument();
  });

  it('reports a missing transcript instead of inventing a result', async () => {
    render(<SpeechAnalyzer />);
    fireEvent.click(screen.getByLabelText(/I am practicing/i));
    fireEvent.click(screen.getByRole('button', { name: /Analyze reading/i }));
    expect(await screen.findByText(/no transcript to analyze/i)).toBeInTheDocument();
  });
});
