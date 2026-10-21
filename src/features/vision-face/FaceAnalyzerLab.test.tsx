import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FaceAnalyzerLab from './FaceAnalyzerLab';

describe('FaceAnalyzerLab', () => {
  it('opens in synthetic mode with the honest framing and no diagnosis labels', () => {
    const { container } = render(<FaceAnalyzerLab />);
    expect(screen.getByRole('heading', { name: 'What this lab measures' })).toBeInTheDocument();
    expect(screen.getByText(/does not diagnose anything/i)).toBeInTheDocument();
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\bbell\b/i);
    expect(text).not.toMatch(/palsy/i);
    expect(text).not.toMatch(/central versus/i);
    expect(text).not.toMatch(/asymmetry detected/i);
    expect(text).not.toMatch(/symmetry score/i);
  });

  it('measures the neutral teaching face and shows all three metrics', () => {
    render(<FaceAnalyzerLab />);
    expect(screen.getByText('Mouth corner height offset')).toBeInTheDocument();
    expect(screen.getByText('Eye opening ratio')).toBeInTheDocument();
    expect(screen.getByText('Brow height difference')).toBeInTheDocument();
    expect(
      screen.getAllByText('Single capture. Unit: in units of the distance between the eyes.'),
    ).toHaveLength(2);
  });

  it('shows the ground truth comparison for the one-sided teaching sample', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('button', { name: /One-sided teaching sample/i }));
    expect(screen.getByText(/Ground truth: mouth corner offset about -0\.09/i)).toBeInTheDocument();
    expect(screen.getByText('-0.09')).toBeInTheDocument();
  });

  it('refuses the tilted head sample with a cannot analyze panel', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('button', { name: /Head tilt/i }));
    expect(screen.getByRole('heading', { name: 'Cannot analyze' })).toBeInTheDocument();
    expect(screen.queryByText('Mouth corner height offset')).not.toBeInTheDocument();
  });

  it('refuses the uneven light sample', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('button', { name: /Uneven light/i }));
    expect(screen.getByRole('heading', { name: 'Cannot analyze' })).toBeInTheDocument();
  });

  it('builds an uncertainty range from repeated captures', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('button', { name: /Add another capture/i }));
    expect(screen.getAllByText(/Mean of 2 captures/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Add another capture/i }));
    expect(screen.getAllByText(/Mean of 3 captures/i).length).toBeGreaterThan(0);
  });

  it('offers the photo and camera modes as explicit opt-ins', () => {
    render(<FaceAnalyzerLab />);
    fireEvent.click(screen.getByRole('tab', { name: /Upload a photo/i }));
    expect(screen.getByText(/The photo never leaves this device/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Camera snapshot/i }));
    expect(screen.getByRole('button', { name: /Start camera/i })).toBeInTheDocument();
  });
});
