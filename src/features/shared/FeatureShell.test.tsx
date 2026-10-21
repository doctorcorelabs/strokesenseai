import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FeatureEntry } from '../../../shared/registry';
import FeatureShell, { SAFETY_DISCLAIMER } from './FeatureShell';

const feature: FeatureEntry = {
  id: 'test-lab',
  name: 'Test Lab',
  tagline: 'A tagline for the test lab',
  group: 'Vision AI',
  maturity: 'lab',
  phase: 1,
  summary: 'A summary.',
  limitations: 'It cannot measure anything in a test.',
  inputKinds: ['camera'],
  route: '#lab/test-lab',
  models: 'None',
  retention: 'Nothing is stored',
  evalReport: 'Not evaluated yet',
};

describe('FeatureShell', () => {
  it('renders the registry heading, badges, disclaimer, limitations, and children', () => {
    render(
      <FeatureShell feature={feature} mode="offline">
        <p>Workspace content</p>
      </FeatureShell>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Test Lab' })).toBeInTheDocument();
    expect(screen.getByText('A tagline for the test lab')).toBeInTheDocument();
    expect(screen.getByText('Experimental lab')).toBeInTheDocument();
    expect(screen.getByText('Offline guide')).toBeInTheDocument();
    expect(screen.getByText('Workspace content')).toBeInTheDocument();
    expect(screen.getByText(SAFETY_DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText('It cannot measure anything in a test.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Call 119 now' })).toBeInTheDocument();
  });

  it('shows a loading state instead of the workspace', () => {
    render(
      <FeatureShell feature={feature} status="loading">
        <p>Workspace content</p>
      </FeatureShell>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Preparing this lab');
    expect(screen.queryByText('Workspace content')).not.toBeInTheDocument();
  });

  it('shows the error as a cannot-analyze alert and calls onRetry', () => {
    const onRetry = vi.fn();
    render(
      <FeatureShell
        feature={feature}
        status="error"
        errorMessage="The camera module failed to load."
        onRetry={onRetry}
      >
        <p>Workspace content</p>
      </FeatureShell>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot analyze');
    expect(screen.getByText('The camera module failed to load.')).toBeInTheDocument();
    expect(screen.queryByText('Workspace content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
