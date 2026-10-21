import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsentScope } from '../../shared/contracts';
import ToolCoach from './ToolCoach';

// P0 contract at the component level: consent given in one lab stays
// given when the coach renders for another lab in the same session. The
// second coach opens in the agreed state and can explain immediately,
// without the person ticking the agreement box again.
//
// The client module is replaced by a small in-memory double that mirrors
// its documented session semantics (record once per scope set, remember
// for the session, forget on revoke), because the real client's API base
// comes from import.meta.env, which this repo's vitest setup snapshots
// per worker beyond the reach of vi.stubEnv. The real client's own
// session record behaviour is covered in client.test.ts.

const REPLY = 'A grounded explanation.';

const session = vi.hoisted(() => {
  const agreedScopes = new Set<string>();
  return {
    consentRecordings: 0,
    agreedScopes,
    reset() {
      this.consentRecordings = 0;
      agreedScopes.clear();
    },
  };
});

vi.mock('./client', () => ({
  getApiBase: () => 'https://api.example.test',
  hasSessionConsent: (scope: ConsentScope) => session.agreedScopes.has(scope),
  requestConsentToken: async (scopes: ConsentScope[]) => {
    if (scopes.some((scope) => !session.agreedScopes.has(scope))) {
      session.consentRecordings += 1;
      for (const scope of scopes) session.agreedScopes.add(scope);
    }
    return 'consent-token-1';
  },
  requestToolExplanation: async () => ({ reply: REPLY, sources: [], mode: 'live' as const }),
  revokeSessionConsent: () => {
    session.agreedScopes.clear();
  },
}));

function submitCoachForm(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('coach form not rendered');
  fireEvent.submit(form);
}

beforeEach(() => {
  session.reset();
});

describe('ToolCoach session consent', () => {
  it('asks for agreement before any consent is given', () => {
    render(<ToolCoach tool="vision" moduleId="face-analyzer" fallback="Face guide." />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByText(/AI consent given for this session/)).toBeNull();
  });

  it('keeps consent given in one lab when the coach opens for another lab', async () => {
    // First lab: the person ticks the agreement and asks for an
    // explanation, which records the consent for the session.
    const first = render(
      <ToolCoach tool="vision" moduleId="face-analyzer" fallback="Face guide." />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    submitCoachForm(first.container);
    await screen.findByText(REPLY);
    expect(screen.getByText(/AI consent given for this session/)).toBeTruthy();
    expect(session.consentRecordings).toBe(1);
    first.unmount();

    // Second lab, same session: the coach opens already agreed, with no
    // agreement box to tick again, and Explain works immediately.
    const second = render(
      <ToolCoach tool="speech" moduleId="speech-analyzer" fallback="Speech guide." />,
    );
    await waitFor(() => {
      expect(screen.getByText(/AI consent given for this session/)).toBeTruthy();
    });
    expect(screen.queryByRole('checkbox')).toBeNull();

    submitCoachForm(second.container);
    await screen.findByText(REPLY);
    // Still exactly one consent recording for the whole session.
    expect(session.consentRecordings).toBe(1);
    second.unmount();
  });

  it('asks again after the session consent is revoked', async () => {
    const first = render(
      <ToolCoach tool="vision" moduleId="face-analyzer" fallback="Face guide." />,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    submitCoachForm(first.container);
    await screen.findByText(REPLY);
    expect(session.consentRecordings).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: /Revoke consent/ }));
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
    expect(screen.queryByText(/AI consent given for this session/)).toBeNull();
    first.unmount();
  });
});
