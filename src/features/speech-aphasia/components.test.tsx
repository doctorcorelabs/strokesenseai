import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AphasiaExpressionLab from './AphasiaExpressionLab';
import AphasiaCommunicationMode from './AphasiaCommunicationMode';
import ComprehensionCheck from './ComprehensionCheck';

describe('AphasiaExpressionLab', () => {
  it('scores a correct typed answer and records it in the session log', () => {
    render(<AphasiaExpressionLab />);
    expect(screen.getByText('Practice only.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByText(/Correct\. The word is "apple"\./)).toBeTruthy();
    expect(screen.getByText(/Score so far: 3 of 3 practice points/)).toBeTruthy();
  });

  it('reveals the semantic cue after a miss and still lets the learner score', () => {
    render(<AphasiaExpressionLab />);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'bicycle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByText(/That is not the target word yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show a semantic cue' }));
    expect(screen.getByText(/round fruit that grows on a tree/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'apple' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(screen.getByText(/Correct\. The word is "apple"\./)).toBeTruthy();
    expect(screen.getByText(/Score so far: 2 of 3 practice points/)).toBeTruthy();
  });

  it('offers multiple choice as the last cue step', () => {
    render(<AphasiaExpressionLab />);
    fireEvent.click(screen.getByRole('button', { name: 'Show a semantic cue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show the first sound' }));
    expect(screen.getByText(/First sound cue/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show multiple choice' }));
    fireEvent.click(screen.getByRole('button', { name: 'apple' }));
    expect(screen.getByText(/Correct\. The word is "apple"\./)).toBeTruthy();
  });
});

describe('AphasiaCommunicationMode', () => {
  it('builds a sentence from tapped core words in tap order', () => {
    render(<AphasiaCommunicationMode />);
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Actions' }));
    fireEvent.click(screen.getByRole('button', { name: 'want' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Needs and things' }));
    fireEvent.click(screen.getByRole('button', { name: 'water' }));
    expect(screen.getByText('I want water.')).toBeTruthy();
  });

  it('offers local pattern suggestions and applies one on tap', () => {
    render(<AphasiaCommunicationMode />);
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Needs and things' }));
    fireEvent.click(screen.getByRole('button', { name: 'water' }));
    expect(screen.getByText('I water.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I need water.' }));
    expect(screen.getByText('I need water.')).toBeTruthy();
  });

  it('adds a typed fragment to the sentence', () => {
    render(<AphasiaCommunicationMode />);
    fireEvent.change(screen.getByLabelText('Or type your own word or fragment'), {
      target: { value: 'please' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to sentence' }));
    expect(screen.getByText('Please.')).toBeTruthy();
  });
});

describe('ComprehensionCheck', () => {
  it('runs setup, then scores a one step command by touch', () => {
    render(<ComprehensionCheck />);
    expect(screen.getByText('Step 1: volume check')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'dog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start the one step commands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show the text' }));
    expect(screen.getByText('Touch the apple')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'apple' }));
    expect(screen.getByText('Correct.')).toBeTruthy();
  });
});
