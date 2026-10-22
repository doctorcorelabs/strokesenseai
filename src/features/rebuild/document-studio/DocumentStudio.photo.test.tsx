import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentStudio from './DocumentStudio';
import { analyzeWithAi } from '../../../ai/visionClient';

vi.mock('../../../ai/visionClient', () => ({
  analyzeWithAi: vi.fn(),
}));

vi.mock('../../../ml/analyze', () => ({
  imageFileToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,photo'),
}));

const analyzeMock = vi.mocked(analyzeWithAi);

const PRIVACY_LINE =
  'Your photo is sent to the AI service for analysis. The pasted-text tools on this page stay fully on this device.';
const FRAMING_LINE =
  'The AI reads and summarizes what it can see in the photo. Check every item against the original document; the AI can misread handwriting, doses, and names.';

function openPhotoMode(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: 'Start trying' }));
  fireEvent.click(screen.getByRole('button', { name: 'Upload a photo' }));
  const input = container.querySelector('input[type="file"]');
  expect(input).toBeTruthy();
  return input as HTMLInputElement;
}

async function pickPhoto(container: HTMLElement) {
  const input = openPhotoMode(container);
  const file = new File(['fake-jpeg'], 'summary.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  const button = await screen.findByRole('button', { name: 'Analyze photo with AI' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  return button;
}

describe('DocumentStudio photo path', () => {
  beforeEach(() => {
    analyzeMock.mockReset();
  });

  it('offers Paste text by default and shows the exact AI privacy line in photo mode', () => {
    const { container } = render(<DocumentStudio />);
    fireEvent.click(screen.getByRole('button', { name: 'Start trying' }));
    // Paste mode is the default: the textarea and the on-device label show.
    expect(container.querySelector('#ds-input')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Upload a photo' }));
    expect(screen.getByText(PRIVACY_LINE)).toBeTruthy();
    expect(screen.getByText('Source: AI photo analysis')).toBeTruthy();
    // The analyze button waits for a photo.
    const button = screen.getByRole('button', { name: 'Analyze photo with AI' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('shows the AI result as Live AI with the framing line after an explicit analyze tap', async () => {
    analyzeMock.mockResolvedValue({
      headline: 'This photo shows a discharge summary with two medicines.',
      observations: ['Diagnosis listed: ischemic stroke.', 'Medicine listed: aspirin 80 mg.'],
      cannotAnalyze: false,
      reason: null,
      emergency: false,
    });
    const { container } = render(<DocumentStudio />);
    const button = await pickPhoto(container);
    fireEvent.click(button);
    expect(await screen.findByText('AI analysis of your photo')).toBeTruthy();
    expect(
      screen.getByText('This photo shows a discharge summary with two medicines.'),
    ).toBeTruthy();
    expect(screen.getByText('Medicine listed: aspirin 80 mg.')).toBeTruthy();
    expect(screen.getByText('Live AI')).toBeTruthy();
    expect(screen.getByText(FRAMING_LINE)).toBeTruthy();
    expect(analyzeMock).toHaveBeenCalledWith({
      task: 'document-photo',
      images: ['data:image/jpeg;base64,photo'],
    });
  });

  it('reports a blurred photo through the cannot-analyze sheet with the model reason', async () => {
    analyzeMock.mockResolvedValue({
      headline: 'AI analysis',
      observations: [],
      cannotAnalyze: true,
      reason: 'The photo is too blurred to read the medicine names.',
      emergency: false,
    });
    const { container } = render(<DocumentStudio />);
    const button = await pickPhoto(container);
    fireEvent.click(button);
    expect(await screen.findByText('The AI could not read this photo')).toBeTruthy();
    expect(
      screen.getByText('The photo is too blurred to read the medicine names.'),
    ).toBeTruthy();
    expect(screen.getByText(FRAMING_LINE)).toBeTruthy();
  });

  it('shows the emergency panel when the guard fires', async () => {
    analyzeMock.mockResolvedValue({
      headline: 'Emergency guidance',
      observations: [],
      cannotAnalyze: false,
      reason: null,
      emergency: true,
    });
    const { container } = render(<DocumentStudio />);
    const button = await pickPhoto(container);
    // Only the slim strip is on the page before the analysis runs.
    expect(container.querySelector('aside[aria-labelledby="emergency-banner-title"]')).toBeNull();
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        container.querySelector('aside[aria-labelledby="emergency-banner-title"]'),
      ).toBeTruthy(),
    );
  });

  it('offers a retry panel when the analysis request fails', async () => {
    analyzeMock.mockRejectedValue(new Error('network down'));
    const { container } = render(<DocumentStudio />);
    const button = await pickPhoto(container);
    fireEvent.click(button);
    expect(await screen.findByText('The photo analysis did not finish')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
