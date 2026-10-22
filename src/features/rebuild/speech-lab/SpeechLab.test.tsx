import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SpeechLab from './SpeechLab';

// In jsdom there is no SpeechRecognition, so the lab must open in its
// first-class tap-along mode. These tests cover the example step and
// that fallback path end to end; the microphone path is exercised on
// real devices, where its hooks are the reused speech-core ones.

const SENTENCE_WORDS = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'the', 'lazy', 'dog'];

/** The tap-along word buttons, in sentence order. */
function wordButtons(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => SENTENCE_WORDS.includes((button.textContent ?? '').trim().toLowerCase()));
}

describe('SpeechLab', () => {
  it('shows the finished example word map first, with no device request', () => {
    render(<SpeechLab />);
    expect(screen.getByText(/See a finished word map/i)).toBeInTheDocument();
    expect(screen.getByText(/Example result/i)).toBeInTheDocument();
    // The example demonstrates one word heard differently: rain as train.
    expect(screen.getByText(/heard: train/i)).toBeInTheDocument();
    expect(screen.getByText('Steady')).toBeInTheDocument();
    expect(screen.queryByText(/Tap along with the example/i)).not.toBeInTheDocument();
  });

  it('falls back to tap-along mode where speech recognition is unavailable', () => {
    render(<SpeechLab />);
    fireEvent.click(screen.getByRole('button', { name: /Start trying/i }));
    expect(screen.getByText(/Tap along with the example/i)).toBeInTheDocument();
    expect(
      screen.getByText(/recorded as follow-along taps, never as a transcript/i),
    ).toBeInTheDocument();
  });

  it('records a full tap-along pass as taps, not as a transcript', () => {
    render(<SpeechLab />);
    fireEvent.click(screen.getByRole('button', { name: /Start trying/i }));

    // Default sentence: "The quick brown fox jumps over the lazy dog".
    const buttons = wordButtons();
    expect(buttons).toHaveLength(9);
    buttons.forEach((button) => fireEvent.click(button));
    fireEvent.click(screen.getByRole('button', { name: /^Finish$/i }));

    expect(screen.getByText(/You tapped along with 9 of 9 words/i)).toBeInTheDocument();
    expect(screen.getByText(/not a microphone reading/i)).toBeInTheDocument();
  });

  it('keeps an untouched word from counting when the pass ends early', () => {
    render(<SpeechLab />);
    fireEvent.click(screen.getByRole('button', { name: /Start trying/i }));
    const buttons = wordButtons();
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(screen.getByRole('button', { name: /^Finish$/i }));
    expect(screen.getByText(/You tapped along with 2 of 9 words/i)).toBeInTheDocument();
  });
});
