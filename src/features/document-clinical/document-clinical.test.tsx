import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('runs the analysis in one click from a sample, with consent counted as given', async () => {
    render(<DischargeLens />);
    expect(screen.getByText('Samples are fictional and need no consent.')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Synthetic sample 1: structured discharge summary' }),
    );

    expect(await screen.findByText('Extracted checklist')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Aspirin')).toBeInTheDocument();
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Show source: line 5' }));
    const activeLine = document.querySelector('li.dc-line-active');
    expect(activeLine?.textContent).toContain('Aspirin 100 mg');
  });

  it('keeps consent and results when the text is edited, and marks the results stale', async () => {
    render(<DischargeLens />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Synthetic sample 1: structured discharge summary' }),
    );
    expect(await screen.findByText('Extracted checklist')).toBeInTheDocument();

    const textarea = screen.getByLabelText('Discharge summary text') as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: `${textarea.value}\nPatient feels well today.` },
    });

    expect(screen.getByText('Extracted checklist')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Text changed, run again to refresh results.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Analyze locally' }));
    await waitFor(() =>
      expect(screen.queryByText('Text changed, run again to refresh results.')).toBeNull(),
    );
    expect(screen.getByText('Extracted checklist')).toBeInTheDocument();
  });

  it('blocks analysis on personal data, offers redaction, and keeps the checkbox ticked', async () => {
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
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});

describe('RiskExtractor page', () => {
  it('builds the 10 factor profile in one click from fictional history 1 and highlights evidence', async () => {
    render(<RiskExtractor />);
    expect(screen.getByText('Samples are fictional and need no consent.')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Fictional history 1: several stated factors' }),
    );

    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
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
    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/risk score of|your risk is|% risk/i)).toBeNull();
  });

  it('labels the Indonesian history sample in English and extracts from it in one click', async () => {
    render(<RiskExtractor />);
    expect(screen.getByText(/parser accepts Indonesian input/i)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Fictional sample 3: history written in Indonesian/ }),
    );
    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Hypertension (high blood pressure)').length).toBeGreaterThan(0);
  });

  it('keeps consent and results when the text is edited, and marks the results stale', async () => {
    render(<RiskExtractor />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Fictional history 1: several stated factors' }),
    );
    expect(
      await screen.findByText('Risk factor profile (10 fixed factors)'),
    ).toBeInTheDocument();

    const textarea = screen.getByLabelText('History text', {
      selector: 'textarea',
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: `${textarea.value} He sleeps well at night.` },
    });

    expect(screen.getByText('Risk factor profile (10 fixed factors)')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Text changed, run again to refresh results.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Extract profile locally' }));
    await waitFor(() =>
      expect(screen.queryByText('Text changed, run again to refresh results.')).toBeNull(),
    );
    expect(screen.getByText('Risk factor profile (10 fixed factors)')).toBeInTheDocument();
  });
});
