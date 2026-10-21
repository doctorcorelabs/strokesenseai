import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DischargeLens from './DischargeLens';
import RiskExtractor from './RiskExtractor';

describe('DischargeLens page', () => {
  it('shows the privacy warning before any input', () => {
    render(<DischargeLens />);
    expect(
      screen.getByRole('heading', { name: /never paste real patient information/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Extraction can be wrong. Always check against the original paper.'),
    ).toBeInTheDocument();
  });

  it('extracts the synthetic sample and highlights the cited source line', async () => {
    render(<DischargeLens />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Synthetic sample 1: structured discharge summary' }),
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze locally' }));

    expect(await screen.findByText('Extracted checklist')).toBeInTheDocument();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show source: line 5' }));
    const activeLine = document.querySelector('li.dc-line-active');
    expect(activeLine?.textContent).toContain('Aspirin 100 mg');
  });

  it('blocks analysis on personal data and offers redaction', async () => {
    render(<DischargeLens />);
    const textarea = screen.getByLabelText('Discharge summary text');
    fireEvent.change(textarea, {
      target: { value: 'NIK 3201010101010001\nDiagnosis: Acute ischemic stroke' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze locally' }));

    expect(
      await screen.findByRole('heading', { name: /Analysis blocked/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Insert redactions' }));
    expect((textarea as HTMLTextAreaElement).value).not.toContain('3201010101010001');
    expect((textarea as HTMLTextAreaElement).value).toContain('[removed]');
  });
});

describe('RiskExtractor page', () => {
  it('builds the 10 factor profile from fictional history 1 and highlights evidence', async () => {
    render(<RiskExtractor />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fictional history 1: several stated factors' }),
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Extract profile locally' }));

    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Hypertension (high blood pressure)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stated absent').length).toBeGreaterThan(0);
    expect(screen.getByText('Not mentioned in this text')).toBeInTheDocument();

    const showButtons = screen.getAllByRole('button', { name: 'Show in text' });
    fireEvent.click(showButtons[0]);
    const highlighted = document.querySelector('.dc-sentence-active');
    expect(highlighted?.textContent).toContain('high blood pressure');
  });

  it('never shows a risk score', async () => {
    render(<RiskExtractor />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fictional history 2: mostly stated absent' }),
    );
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Extract profile locally' }));
    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/risk score of|your risk is|% risk/i)).toBeNull();
  });
});
