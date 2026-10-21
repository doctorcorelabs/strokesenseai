import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NihssTrainer } from './NihssTrainer';
import { StrokeCodeSimulator } from './StrokeCodeSimulator';
import { NIHSS_ITEMS, getNihssCase } from './nihss';

describe('NihssTrainer', () => {
  it('labels itself as a training tool and shows the item guide', () => {
    render(<NihssTrainer />);
    expect(screen.getByText(/Training only, not a clinical reference/i)).toBeInTheDocument();
    expect(screen.getByText(/not NIHSS certification/i)).toBeInTheDocument();
    // Default guide item is motor arm right (5b), with its anchors and trap.
    expect(screen.getByText(/Laterality mix-ups are the most common clerical error/i)).toBeInTheDocument();
  });

  it('checks a drill answer against the case key', () => {
    render(<NihssTrainer />);
    // Case A drill for item 5b has key 2, anchor label "Some effort". Scope
    // the click to the case A card: every drill card offers the same anchors.
    const cardTitle = screen.getByText(/Mrs\. R, 68: right-sided weakness/);
    const card = cardTitle.closest('div');
    if (!card) throw new Error('Drill card not found');
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /^2: Some effort/ }));
    expect(screen.getByText(/Exact match\./)).toBeInTheDocument();
    expect(screen.getByText(/Key score:/)).toBeInTheDocument();
  });

  it('runs a full exam with key answers and reports a matching total', () => {
    const { container } = render(<NihssTrainer />);
    fireEvent.click(screen.getByRole('button', { name: /Full case exam/i }));
    const kasus = getNihssCase('case-a');
    const sections = container.querySelectorAll('section[aria-label]');
    const itemSections = Array.from(sections).filter((section) =>
      NIHSS_ITEMS.some((item) => item.name === section.getAttribute('aria-label')),
    );
    expect(itemSections).toHaveLength(15);
    for (const caseFinding of kasus.findings) {
      const item = NIHSS_ITEMS.find((entry) => entry.id === caseFinding.itemId);
      const option = item?.options.find((entry) => entry.value === caseFinding.key);
      const section = itemSections.find(
        (entry) => entry.getAttribute('aria-label') === item?.name,
      );
      if (!section || !option) throw new Error(`Missing section or option for ${caseFinding.itemId}`);
      const label = caseFinding.key === 'UN' ? 'UN' : String(caseFinding.key);
      fireEvent.click(
        within(section as HTMLElement).getByRole('button', {
          name: new RegExp(`^${label}: ${option.label}`),
        }),
      );
    }
    fireEvent.click(screen.getByRole('button', { name: /Check my scores/i }));
    expect(screen.getByText(/Exact matches:/)).toBeInTheDocument();
    expect(screen.getByText(/15 of 15/)).toBeInTheDocument();
    // Fifteen scored sections re-render on every answer in jsdom; this test
    // is interaction-heavy, so it gets a generous explicit timeout.
  }, 30000);
});

describe('StrokeCodeSimulator', () => {
  it('labels itself as a training simulation and lists scenarios', () => {
    render(<StrokeCodeSimulator />);
    expect(screen.getByText(/Training simulation, not a clinical protocol/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /First Light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Found at Dawn/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Two Contraindications/i })).toBeInTheDocument();
  });

  it('plays the optimal classic path to a 100 point debrief', () => {
    render(<StrokeCodeSimulator />);
    fireEvent.click(screen.getByRole('button', { name: /First Light/i }));
    fireEvent.click(screen.getByRole('button', { name: /Activate the stroke code/i }));
    expect(screen.getByText(/Examiner note/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Check finger-stick glucose now/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Non-contrast head CT plus CT angiography/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /below the 185\/110 treatment threshold/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Give IV thrombolysis now and activate thrombectomy/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Structured handoff/i }));
    expect(screen.getByText(/Debrief/)).toBeInTheDocument();
    expect(screen.getByText(/100 of 100/)).toBeInTheDocument();
    expect(screen.getByText(/Ideal key decisions/i)).toBeInTheDocument();
  });

  it('surfaces a critical decision in the debrief', () => {
    render(<StrokeCodeSimulator />);
    fireEvent.click(screen.getByRole('button', { name: /Found at Dawn/i }));
    fireEvent.click(screen.getByRole('button', { name: /When he was found/i }));
    fireEvent.click(screen.getByRole('button', { name: /Activate the stroke code/i }));
    fireEvent.click(screen.getByRole('button', { name: /Check finger-stick glucose now/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /Non-contrast head CT plus CT angiography/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: /urgent thrombectomy evaluation/i }));
    fireEvent.click(screen.getByRole('button', { name: /Transfer to the angiography suite now/i }));
    expect(screen.getByText(/Critical decisions to review/i)).toBeInTheDocument();
    expect(screen.getByText(/Unsafe path/i)).toBeInTheDocument();
  });
});
