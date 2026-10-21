import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FEATURES, getFeature } from '../../shared/registry';
import HowItWorks, { plainHowItWorks } from './HowItWorks';

const BANNED_JARGON = [
  'deterministic',
  'Worker',
  'endpoint',
  'synthetic',
  'rubric',
  'latency',
  'curated',
];

describe('plainHowItWorks', () => {
  it('keeps every registry feature to at most two plain sentences', () => {
    for (const feature of FEATURES) {
      const text = plainHowItWorks(feature.models);
      expect(text, feature.id).not.toBe('');
      const sentences = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(Boolean);
      expect(sentences.length, feature.id).toBeLessThanOrEqual(2);
      for (const word of BANNED_JARGON) {
        expect(text, `${feature.id} should not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('says plainly when a feature uses no AI model', () => {
    const feature = getFeature('face-analyzer');
    if (!feature) throw new Error('face-analyzer missing from registry');
    expect(plainHowItWorks(feature.models)).toContain('No AI model');
  });

  it('names the AI service when a feature really calls one', () => {
    const feature = getFeature('plain-translator');
    if (!feature) throw new Error('plain-translator missing from registry');
    expect(plainHowItWorks(feature.models)).toContain('AI service');
  });
});

describe('HowItWorks', () => {
  it('renders the explanation, retention line, and evaluation status', () => {
    const feature = getFeature('face-analyzer');
    if (!feature) throw new Error('face-analyzer missing from registry');
    render(<HowItWorks feature={feature} />);
    expect(screen.getByRole('heading', { name: 'How this works' })).toBeInTheDocument();
    expect(screen.getByText(/No AI model/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is stored\./)).toBeInTheDocument();
    expect(screen.getByText(/not been formally evaluated yet/)).toBeInTheDocument();
  });

  it('renders a long retention note in full', () => {
    const feature = getFeature('adaptive-tutor');
    if (!feature) throw new Error('adaptive-tutor missing from registry');
    render(<HowItWorks feature={feature} />);
    expect(screen.getByText(/never uploaded/)).toBeInTheDocument();
  });
});
