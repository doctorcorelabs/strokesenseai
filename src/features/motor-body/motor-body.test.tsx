import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BalanceLab from './BalanceLab';
import FastVisionCheck from './FastVisionCheck';

describe('BalanceLab', () => {
  it('shows the physical safety instructions prominently before anything runs', () => {
    render(<BalanceLab />);
    expect(screen.getByText('Read this before you start')).toBeInTheDocument();
    expect(screen.getByText(/Keep support within reach/)).toBeInTheDocument();
    expect(screen.getByText(/Stop at once if you feel dizzy/)).toBeInTheDocument();
    expect(screen.getByText(/Do not do the standing task alone/)).toBeInTheDocument();
  });

  it('keeps the start buttons locked until the checklist is confirmed', () => {
    render(<BalanceLab />);
    const startButtons = screen.getAllByRole('button', { name: /Start the/ });
    expect(startButtons.length).toBeGreaterThan(0);
    for (const button of startButtons) expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    for (const button of screen.getAllByRole('button', { name: /Start the/ })) {
      expect(button).not.toBeDisabled();
    }
  });

  it('states its limits without promising a score', () => {
    render(<BalanceLab />);
    expect(screen.getByText('What this lab cannot do')).toBeInTheDocument();
    expect(screen.getByText(/no balance score/)).toBeInTheDocument();
  });
});

describe('FastVisionCheck', () => {
  it('explains the one-eye-at-a-time flow and offers both starting eyes', () => {
    render(<FastVisionCheck />);
    expect(screen.getByText('How this check works')).toBeInTheDocument();
    expect(screen.getByText(/One eye at a time/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with my left eye' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start with my right eye' })).toBeInTheDocument();
  });

  it('asks the person to cover the other eye before a round starts', () => {
    render(<FastVisionCheck />);
    fireEvent.click(screen.getByRole('button', { name: 'Start with my left eye' }));
    expect(screen.getByText('Cover your right eye')).toBeInTheDocument();
    expect(screen.getByText(/Do not press on the covered eye/)).toBeInTheDocument();
  });

  it('states that the result is a map, not a combined score', () => {
    render(<FastVisionCheck />);
    expect(screen.getByText(/The result is a map, not a score/)).toBeInTheDocument();
    expect(screen.getByText('What this check cannot do')).toBeInTheDocument();
  });
});
