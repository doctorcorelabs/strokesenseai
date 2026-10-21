import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AdaptiveTutor from './AdaptiveTutor';
import PrivacyShield from './PrivacyShield';
import { PROGRESS_STORAGE_KEY } from './tutor-logic';

describe('PrivacyShield', () => {
  it('masks the synthetic sample and reports the finds', () => {
    render(<PrivacyShield />);
    fireEvent.click(screen.getByRole('button', { name: /load synthetic sample/i }));

    expect(screen.getByText(/Found \d+ likely identifiers/)).toBeInTheDocument();
    expect(screen.getAllByText('keluarga.contoh@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[email removed]').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[phone number removed]').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[medical record number removed]').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /download masked text/i })).toBeInTheDocument();
  });

  it('says plainly when nothing is found', () => {
    render(<PrivacyShield />);
    fireEvent.change(screen.getByLabelText(/paste text to check/i), {
      target: { value: 'The MCA supplies the lateral frontal lobe.' },
    });
    expect(screen.getByText(/No identifier patterns were found/)).toBeInTheDocument();
  });
});

describe('AdaptiveTutor', () => {
  it('serves a question, gives feedback, and saves progress locally', () => {
    render(<AdaptiveTutor />);
    expect(screen.getByText('Level 1, Foundations')).toBeInTheDocument();

    const options = screen.getAllByRole('button').filter((button) =>
      button.classList.contains('rp-option'),
    );
    expect(options.length).toBe(4);
    fireEvent.click(options[0] as HTMLElement);

    expect(screen.getByRole('button', { name: /next question/i })).toBeInTheDocument();
    expect(screen.getByText(/1 answered, \d correct/)).toBeInTheDocument();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toContain('totalAnswered":1');
  });
});
