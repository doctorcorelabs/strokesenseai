import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ArmDriftLab from './ArmDriftLab';
import FingerTappingLab from './FingerTappingLab';

const FORBIDDEN = /abnormal|diagnos|healthy|\bnormal\b|stroke detected|weak side/i;

describe('ArmDriftLab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the workspace with a visible practice disclaimer', () => {
    render(<ArmDriftLab />);
    expect(screen.getByText(/Practice workspace: measure a 10 second hold/i)).toBeInTheDocument();
    expect(screen.getByText(/practice measurement only/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('runs a simulated session to quantitative results', async () => {
    render(<ArmDriftLab />);
    fireEvent.click(screen.getByRole('button', { name: /Start 10 second hold/i }));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText(/What this recording showed/i)).toBeInTheDocument();
    expect(screen.getByText(/Lowering over the hold/i)).toBeInTheDocument();
    expect(screen.getByText(/Lowering speed/i)).toBeInTheDocument();
    expect(screen.getByText(/Usable samples/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });
});

describe('FingerTappingLab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the workspace with the no comparison table disclaimer', () => {
    render(<FingerTappingLab />);
    expect(screen.getByText(/15 seconds of tapping per hand/i)).toBeInTheDocument();
    expect(screen.getByText(/no comparison table/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });

  it('loads a synthetic example and reports tapping metrics', () => {
    render(<FingerTappingLab />);
    fireEvent.click(screen.getByRole('button', { name: /Synthetic example: right hand/i }));
    expect(screen.getByText(/Right hand \(synthetic example\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Taps counted/i)).toBeInTheDocument();
    expect(screen.getByText(/Rhythm variation/i)).toBeInTheDocument();
    expect(screen.getByText(/Hesitation pauses/i)).toBeInTheDocument();
  });

  it('records pad taps for 15 seconds and compares both hands', async () => {
    render(<FingerTappingLab />);
    fireEvent.click(screen.getByRole('button', { name: /Start right hand/i }));
    const pad = screen.getByLabelText(/Tap pad for the right hand/i);
    for (let i = 0; i < 12; i += 1) {
      fireEvent.pointerDown(pad);
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
    }
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByText(/Right hand \(your recording\)/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Synthetic example: left hand/i }));
    expect(screen.getByText(/Side by side/i)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(FORBIDDEN);
  });
});
