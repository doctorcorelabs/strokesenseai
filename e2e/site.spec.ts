import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FEATURES } from '../shared/registry';

// These tests pin the stable contracts of the product (feature names from
// the registry, the intended-use sentence on the Scope page, failure
// panels that appear only on a real failure, the FAST escalation to 119,
// WCAG A/AA cleanliness on every route, and the offline privacy guarantee
// that no request leaves the app origin), not exact marketing copy.

async function gotoHash(page: Page, hash: string) {
  await page.goto(`/${hash}`);
  await page.waitForLoadState('domcontentloaded');
}

test('home lists the lab features from the registry', async ({ page }) => {
  await gotoHash(page, '');
  await expect(page.getByText(/StrokeSense AI Lab/i).first()).toBeVisible();
  // A sample of feature names across groups must appear on the hub.
  await expect(page.getByText(/Face Symmetry Analyzer/i).first()).toBeVisible();
  await expect(page.getByText(/Arm Drift Quantifier/i).first()).toBeVisible();
  await expect(page.getByText(/Speech/i).first()).toBeVisible();
  await expect(page.getByText(/Document/i).first()).toBeVisible();
});

test('about page shows the intended use statement', async ({ page }) => {
  await gotoHash(page, '#about');
  await expect(
    page
      .getByText(/does not diagnose, screen for, or rule out stroke/i)
      .first(),
  ).toBeVisible();
});

// P0 design decision (2026-10-21, UX audit follow-up): the permanent
// cannot-analyze demo panel was removed from the lab shell on purpose.
// Failure panels now appear only on a real failure, so a freshly opened
// lab shows its workspace and no failure text.
//
// R1 adjustment (2026-10-22, rebuild): #lab/arm-drift is now an alias
// for Movement Lab inside the rebuilt LabShell, which opens on the
// example step. The phrase "cannot analyze" legitimately appears once
// in the DOM, inside the folded "About and help" limitations copy, so
// the old raw DOM count no longer measures what this test protects.
// The contract is unchanged: no failure panel is PRESENTED on open.
// The assertions below pin exactly that: the example step is what the
// person sees, there is no result sheet at all yet, and the single
// DOM match for the phrase stays hidden inside the folded section.
test('arm drift lab opens on its example step with no failure panel shown', async ({
  page,
}) => {
  await gotoHash(page, '#lab/arm-drift');
  await expect(
    page.getByRole('heading', { level: 1, name: /Movement Lab/i }),
  ).toBeVisible();
  await expect(page.getByText(/See finished examples first/i)).toBeVisible();
  await expect(
    page.getByRole('button', { name: /start trying/i }),
  ).toBeVisible();
  await expect(page.locator('.result-sheet')).toHaveCount(0);
  await expect(page.locator('.result-cannot')).toHaveCount(0);
  await expect(page.getByText(/cannot analyze/i).first()).toBeHidden();
});

test('FAST check escalates to calling 119 after a yes answer', async ({
  page,
}) => {
  await gotoHash(page, '#fast');

  // Answer "yes" on the first step, whichever control style the wizard uses.
  const yesRadio = page.getByRole('radio', { name: /yes/i }).first();
  const yesLabel = page.getByLabel(/yes/i).first();
  const yesButton = page.getByRole('button', { name: /yes/i }).first();
  if (await yesRadio.count()) {
    await yesRadio.check();
  } else if (await yesLabel.count()) {
    await yesLabel.check();
  } else {
    await yesButton.click();
  }

  // The escalation panel is the one element with role="alert" on this page
  // and it tells the user to call 119. Target it directly and only it: a
  // previous version OR-ed in a loose text locator whose "do not wait"
  // alternative also matched the page heading, which made this test fail
  // strict-mode checks even though the app behaved correctly.
  await expect(
    page.getByRole('alert').filter({ hasText: /119/ }),
  ).toBeVisible({ timeout: 10000 });
});

test('no axe accessibility violations on home and about', async ({ page }) => {
  for (const hash of ['', '#about']) {
    await gotoHash(page, hash);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

// Accessibility gate for every lab route in the registry, plus the
// emergency page. PLANNING section 7.4 promises axe WCAG A/AA on ALL
// routes; this loop is what makes that promise testable. The list is
// generated from the registry, so a future feature is covered the moment
// it is registered.
for (const feature of FEATURES) {
  test(`no axe accessibility violations on lab route ${feature.id}`, async ({
    page,
  }) => {
    await gotoHash(page, `#lab/${feature.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test('no axe accessibility violations on the emergency route', async ({
  page,
}) => {
  await gotoHash(page, '#emergency');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

// Privacy gate for offline mode (the CI web server runs with an empty
// VITE_API_BASE_URL). Across the hub, two lab pages, and an offline coach
// interaction, every network request must stay on the app origin: no AI
// provider, no tracker, no external asset host may be contacted. This is
// the executable form of the network-capture control the DPIA outline
// describes; the analyst-13 audit verified the same property by hand.
test('offline mode makes no request to any external origin', async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1:5173').origin;
  const requestedUrls: string[] = [];
  page.on('request', (request) => {
    requestedUrls.push(request.url());
  });

  await gotoHash(page, '');
  await expect(page.getByText(/Face Symmetry Analyzer/i).first()).toBeVisible();

  await gotoHash(page, '#lab/arm-drift');
  await expect(
    page.getByRole('button', { name: /start/i }).first(),
  ).toBeVisible();

  // R1 adjustment (2026-10-22, rebuild): the rebuilt labs render inside
  // LabShell, which carries no ToolCoach; the coach now lives on the
  // legacy lab pages and in Ask the Lab. The offline privacy contract
  // this test protects is unchanged, so the coach interaction below
  // runs on #lab/mimic-detective: a legacy workspace lab whose rebuild
  // target (Case Room) is an R2 feature that is not built yet, so the
  // route still renders inside the classic lab page, which hosts the
  // coach inside its collapsed "About and help" section (P0 reorder);
  // open that section before interacting.
  await gotoHash(page, '#lab/mimic-detective');
  await page.locator('summary', { hasText: 'About and help' }).click();

  // Offline coach interaction: asking a question must be answered from the
  // local prewritten guide without any network call.
  await page
    .getByLabel(/ask about this tool/i)
    .fill('What does this selection illustrate?');
  await page.getByRole('button', { name: /show local guide/i }).click();
  await expect(page.getByText(/prewritten guide/i).first()).toBeVisible();

  await gotoHash(page, '#lab/face-analyzer');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Sanity: the listener really observed the app loading, and every single
  // request it observed stayed on the app origin.
  expect(requestedUrls.length).toBeGreaterThan(0);
  const external = requestedUrls.filter((url) => {
    try {
      return new URL(url).origin !== origin;
    } catch {
      return true;
    }
  });
  expect(external).toEqual([]);
});
