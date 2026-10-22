import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// R1 rebuild coverage (2026-10-22). The legacy suite pins the classic
// catalog; this spec pins the rebuilt surface: the hub's Start Here
// flagship card, the LabShell stepper contract (See an example, Try it,
// Your result), Document Studio showing a finished example before any
// input, the retired gaze tracker panel, and the legacy alias that
// lands on Face Lab, where a refused camera permission must end in the
// cannot-analyze result sheet, never in an invented value.
//
// Camera denial is made deterministic with an init script that rejects
// getUserMedia with NotAllowedError. Playwright grants no camera by
// default, but headless Chromium builds differ (some expose a fake
// device), and this suite must test the denial path, not the device
// lottery. The stub only replaces the permission result; the app code
// path after it is the real one.

async function gotoHash(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.waitForLoadState('domcontentloaded');
}

/** Collect fatal errors only: uncaught page errors and console errors
 * that are not plain resource-load noise. Returned list must be empty. */
function watchFatalErrors(page: Page): string[] {
  const fatal: string[] = [];
  page.on('pageerror', (error) => {
    fatal.push(`pageerror: ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.startsWith('Failed to load resource')) return;
    fatal.push(`console: ${text}`);
  });
  return fatal;
}

async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(
            new DOMException('Camera permission denied by test', 'NotAllowedError'),
          ),
      },
    });
  });
}

test('hub Start Here shows the FAST Live Check card and opens the rebuilt shell', async ({
  page,
}) => {
  const fatal = watchFatalErrors(page);
  await gotoHash(page, '');
  await expect(
    page.getByRole('heading', { name: /Start here/i }),
  ).toBeVisible();
  const flagshipCard = page.getByRole('link', { name: /FAST Live Check/i });
  await expect(flagshipCard).toBeVisible();
  await flagshipCard.click();
  await expect(page).toHaveURL(/#lab\/fast-live-check/);
  await expect(
    page.getByRole('heading', { level: 1, name: /FAST Live Check/i }),
  ).toBeVisible();
  const stepper = page.getByLabel('Lab steps');
  await expect(stepper.getByText('See an example')).toBeVisible();
  await expect(stepper.getByText('Try it', { exact: true })).toBeVisible();
  await expect(stepper.getByText('Your result')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /start trying/i }),
  ).toBeVisible();
  expect(fatal).toEqual([]);
});

test('document studio shows a finished example before any input', async ({
  page,
}) => {
  const fatal = watchFatalErrors(page);
  await gotoHash(page, '#lab/document-studio');
  await expect(
    page.getByRole('heading', { level: 1, name: /Document Studio/i }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /See a finished example/i }),
  ).toBeVisible();
  await expect(page.getByText('Example result').first()).toBeVisible();
  // The example checklist is a real extraction over the sample document:
  // facts render with their source lines, all before the person types
  // or pastes anything anywhere.
  await expect(page.getByText(/Source line/).first()).toBeVisible();
  expect(fatal).toEqual([]);
});

test('retired gaze tracker route shows the retirement panel', async ({
  page,
}) => {
  const fatal = watchFatalErrors(page);
  await gotoHash(page, '#lab/gaze-tracker');
  await expect(
    page.getByRole('heading', { level: 1, name: /has been retired/i }),
  ).toBeVisible();
  await expect(page.getByText(/pointer is not a gaze/i)).toBeVisible();
  expect(fatal).toEqual([]);
});

test('face analyzer alias lands on Face Lab and a refused camera ends in cannot-analyze', async ({
  page,
}) => {
  const fatal = watchFatalErrors(page);
  await denyCamera(page);
  await gotoHash(page, '#lab/face-analyzer');
  await expect(
    page.getByRole('heading', { level: 1, name: /Face Lab/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /start trying/i }).click();
  await expect(
    page.getByRole('heading', { name: /Try it with your camera/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /start camera/i }).click();
  // The model loads first (self-hosted, from this origin), then the
  // refused permission must surface as the cannot-analyze sheet with
  // the specific reason, not as a substituted value.
  await expect(
    page.getByText(/The camera could not measure your face movements this time/i),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.result-cannot')).toBeVisible();
  await expect(
    page.getByText(/Camera permission was refused/i),
  ).toBeVisible();
  expect(fatal).toEqual([]);
});

// Accessibility gate for the rebuilt routes, following the same pattern
// as the legacy loop in site.spec.ts (WCAG A/AA, zero violations). The
// legacy loop iterates the classic FEATURES list only, so the R1 routes
// are pinned here until the catalogs merge.
const R1_ROUTES: Array<{ hash: string; heading: RegExp }> = [
  { hash: '#lab/fast-live-check', heading: /FAST Live Check/i },
  { hash: '#lab/face-lab', heading: /Face Lab/i },
  { hash: '#lab/lesion-localizer', heading: /Face Lesion Localizer/i },
  { hash: '#lab/movement-lab', heading: /Movement Lab/i },
  { hash: '#lab/speech-lab', heading: /Speech Lab/i },
  { hash: '#lab/document-studio', heading: /Document Studio/i },
  { hash: '#lab/ask-the-lab', heading: /Ask the Lab/i },
  { hash: '#lab/gaze-tracker', heading: /has been retired/i },
];

for (const route of R1_ROUTES) {
  test(`no axe accessibility violations on rebuilt route ${route.hash}`, async ({
    page,
  }) => {
    await gotoHash(page, route.hash);
    await expect(
      page.getByRole('heading', { level: 1, name: route.heading }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
