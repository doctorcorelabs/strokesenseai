import { test, expect, type Page } from '@playwright/test';

// AI upload path coverage (2026-10-22, AI upload wave). The rebuilt
// labs accept an uploaded photo or video whose frames are described by
// the Worker AI endpoint (POST /api/vision, image mode). These tests
// pin that path end to end in a real browser: the upload panel is the
// default source, picking a file sends nothing anywhere until the
// person explicitly presses the Analyze button, and a stubbed Worker
// reply renders as a Live AI result sheet with its framing line.
//
// The Worker itself is not under test here; its contract is pinned by
// the worker test suite. Session, consent, and vision are intercepted
// at the network layer and answered with the exact response shapes the
// client validates, following the interception style of this suite.
//
// Run requirement: analyzeWithAi refuses to run when no API base is
// configured, and the shared web server defaults to an empty
// VITE_API_BASE_URL (the offline posture the privacy gate in
// site.spec.ts depends on). playwright.config.ts passes a shell-set
// VITE_API_BASE_URL through to the server, so this spec only runs
// when one is set, for example:
//   VITE_API_BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/upload-ai.spec.ts
// Pointing the base at the app origin itself is deliberate: every API
// request is intercepted below, so nothing ever reaches a real Worker.
// Without the variable the tests skip instead of failing, so a default
// full-suite run stays green.

const API_BASE_CONFIGURED = Boolean(process.env.VITE_API_BASE_URL?.trim());

// A 1x1 PNG, generated in the test as a pixel buffer. The preparation
// code decodes it in the real browser and redraws it to a JPEG data
// URL, so the bytes only need to be a valid image, not a real face:
// the Worker is stubbed and never judges the content.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const FACE_HEADLINE = 'The AI describes a face that starts relaxed and then smiles.';
const FACE_OBSERVATION = 'In the later frames, both mouth corners rise.';
const ARM_HEADLINE = 'Both arms are raised out to the sides, the right a little lower.';
const ARM_OBSERVATION = 'The left arm sits higher than the right arm.';
const DOCUMENT_HEADLINE = 'The photo shows a discharge summary page.';
const DOCUMENT_OBSERVATION = 'A follow-up appointment date is listed on the page.';
const LOCALIZER_HEADLINE =
  'The right lower face looks weaker, and the forehead still wrinkles on both sides.';
const LOCALIZER_SITE = 'Genu of the internal capsule, left side';
const LOCALIZER_VESSEL = 'Lateral lenticulostriate arteries';
const LOCALIZER_POSSIBILITY = 'Ischemic stroke in MCA territory';

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

interface ApiCounters {
  vision: number;
  /** The vision task name of each intercepted request, in order. */
  tasks: string[];
}

function recordTask(counters: ApiCounters, postData: string | null) {
  try {
    const body = JSON.parse(postData ?? '') as { task?: unknown };
    if (typeof body.task === 'string') counters.tasks.push(body.task);
  } catch {
    // A body that does not parse is still answered by the stub below.
  }
}

/**
 * Intercept the Worker endpoints the vision client calls and answer
 * with the shapes client.ts and visionClient.ts validate: session
 * returns a session id, consent returns a token, and vision returns
 * the analysis as a JSON string in `reply` with mode 'live-ai'. The
 * vision counter lets tests prove nothing was sent before the person
 * pressed Analyze, and the recorded task names pin which task each
 * file kind was sent to.
 */
async function stubWorker(page: Page, headline: string, observation: string) {
  const counters: ApiCounters = { vision: 0, tasks: [] };
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: 'e2e-upload-session' }),
    });
  });
  await page.route('**/api/consent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-consent-token', expiresIn: 7200 }),
    });
  });
  await page.route('**/api/vision', async (route) => {
    counters.vision += 1;
    recordTask(counters, route.request().postData());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: JSON.stringify({
          headline,
          observations: [observation],
          cannotAnalyze: false,
          reason: null,
        }),
        sources: [],
        mode: 'live-ai',
      }),
    });
  });
  return counters;
}

/**
 * Same interception as stubWorker, but the vision reply carries the
 * extended localizer shape: a pattern code, one candidate lesion
 * level, and one ranked possibility, exactly as the client parser
 * validates them.
 */
async function stubLocalizerWorker(page: Page) {
  const counters: ApiCounters = { vision: 0, tasks: [] };
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessionId: 'e2e-upload-session' }),
    });
  });
  await page.route('**/api/consent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-consent-token', expiresIn: 7200 }),
    });
  });
  await page.route('**/api/vision', async (route) => {
    counters.vision += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: JSON.stringify({
          headline: LOCALIZER_HEADLINE,
          observations: ['The right mouth corner sits lower in the photo.'],
          cannotAnalyze: false,
          reason: null,
          pattern: 'central-umn',
          lesionCandidates: [
            {
              site: LOCALIZER_SITE,
              tract: 'Corticobulbar tract',
              vessel: LOCALIZER_VESSEL,
              confidence: 'moderate',
              rationale: 'The forehead still wrinkles on both sides.',
            },
          ],
          possibilities: [
            {
              name: LOCALIZER_POSSIBILITY,
              note: 'Fits the forehead-sparing pattern in this photo.',
            },
          ],
        }),
        sources: [],
        mode: 'live-ai',
      }),
    });
  });
  return counters;
}

test.describe('AI upload path', () => {
  test.skip(
    !API_BASE_CONFIGURED,
    'Needs VITE_API_BASE_URL set for the dev server (see the header of this file).',
  );

  test('face lab upload sends nothing before Analyze and renders the Live AI sheet', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubWorker(page, FACE_HEADLINE, FACE_OBSERVATION);

    await gotoHash(page, '#lab/face-lab');
    await expect(
      page.getByRole('heading', { level: 1, name: /Face Lab/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start trying/i }).click();

    // Upload is the default source: its picker button is pressed and
    // the upload workspace, not the camera, is what renders.
    const uploadSource = page.getByRole('button', {
      name: 'Upload a photo or video',
      exact: true,
    });
    await expect(uploadSource).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('heading', { name: 'Upload a photo or video' }),
    ).toBeVisible();
    await expect(page.getByText('Upload a photo or video of your face')).toBeVisible();

    await page.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'face.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });

    // The prepared frame is shown for approval, and the consent box
    // and Analyze button appear. Nothing has been sent yet: preparing
    // frames is on-device work, and sending is the button's job alone.
    await expect(page.getByText('These frames will be sent to the AI')).toBeVisible();
    await expect(counters.vision).toBe(0);

    await page.locator('.consent-box input[type="checkbox"]').check();
    await expect(counters.vision).toBe(0);

    await page.getByRole('button', { name: 'Analyze with AI' }).click();

    const sheet = page.locator('.result-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Live AI', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: FACE_HEADLINE })).toBeVisible();
    await expect(sheet.getByText(FACE_OBSERVATION)).toBeVisible();
    // The framing line travels with the sheet: an AI description is
    // not a measurement.
    await expect(sheet.getByText(/does not measure/)).toBeVisible();
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });

  test('document studio photo upload renders the AI analysis section', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubWorker(page, DOCUMENT_HEADLINE, DOCUMENT_OBSERVATION);

    await gotoHash(page, '#lab/document-studio');
    await expect(
      page.getByRole('heading', { level: 1, name: /Document Studio/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start trying/i }).click();
    await page.getByRole('button', { name: 'Upload a photo' }).click();
    await expect(page.getByText('Upload a photo of the document')).toBeVisible();

    await page.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'discharge.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });

    // The studio states the gate in words as well: preparing the photo
    // sent nothing, and the counter agrees.
    await expect(page.getByText(/Photo ready\. Nothing has been sent yet/)).toBeVisible();
    await expect(counters.vision).toBe(0);

    await page.getByRole('button', { name: 'Analyze photo with AI' }).click();

    await expect(
      page.getByRole('heading', { name: 'AI analysis of your photo' }),
    ).toBeVisible();
    const sheet = page.locator('.result-sheet');
    await expect(sheet.getByText('Live AI', { exact: true })).toBeVisible();
    await expect(sheet.getByText(DOCUMENT_HEADLINE)).toBeVisible();
    await expect(sheet.getByText(DOCUMENT_OBSERVATION)).toBeVisible();
    // The photo framing line warns the reading can misread doses and
    // names, so the paper original still wins.
    await expect(sheet.getByText(/can misread handwriting, doses, and names/)).toBeVisible();
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });

  test('lesion localizer sends nothing before Analyze photo and renders the possibility sheet', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubLocalizerWorker(page);

    await gotoHash(page, '#lab/lesion-localizer');
    await expect(
      page.getByRole('heading', { level: 1, name: /Face Lesion Localizer/i }),
    ).toBeVisible();

    // The example step teaches the result shape first, with the same
    // pattern hero and pathway diagram a real result will use.
    await expect(page.getByText('Central pattern (upper motor neuron)')).toBeVisible();
    await expect(page.getByText('Lateral lenticulostriate arteries').first()).toBeVisible();

    await page.getByRole('button', { name: /start trying/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Upload one photo of a face' }),
    ).toBeVisible();
    await expect(page.getByText('Upload a photo of a face')).toBeVisible();

    await page.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'face.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });

    // The photo is prepared and shown for approval; preparing and
    // even ticking consent send nothing. Only the button sends.
    await expect(page.getByText('This photo will be sent to the AI')).toBeVisible();
    await expect(counters.vision).toBe(0);

    await page.locator('.consent-box input[type="checkbox"]').check();
    await expect(counters.vision).toBe(0);

    await page.getByRole('button', { name: 'Analyze photo' }).click();

    const sheet = page.locator('.result-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Live AI', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: LOCALIZER_HEADLINE })).toBeVisible();
    await expect(sheet.getByText('Central pattern (upper motor neuron)')).toBeVisible();
    await expect(sheet.getByText(LOCALIZER_SITE)).toBeVisible();
    await expect(sheet.getByText(LOCALIZER_VESSEL)).toBeVisible();
    await expect(sheet.getByText(LOCALIZER_POSSIBILITY)).toBeVisible();
    // The mandatory framing travels with the sheet: possibilities,
    // never a diagnosis.
    await expect(sheet.getByText(/possibility exploration/i)).toBeVisible();
    await expect(sheet.getByText(/not a diagnosis/i).first()).toBeVisible();
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });

  test('fast live face stage accepts one photo and renders the AI result with the photo note', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubWorker(page, FACE_HEADLINE, FACE_OBSERVATION);

    await gotoHash(page, '#lab/fast-live-check');
    await expect(
      page.getByRole('heading', { level: 1, name: /FAST Live Check/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start trying/i }).click();

    // The face stage is first and upload is its default source.
    const faceStage = page.locator('section[aria-label="Face stage"]');
    await expect(faceStage.getByText('Upload a face photo or video')).toBeVisible();

    await faceStage.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'face.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await expect(counters.vision).toBe(0);

    await page.locator('.consent-box input[type="checkbox"]').check();
    await faceStage.getByRole('button', { name: 'Analyze with AI' }).click();

    // One photo is enough: the result card renders as a success, not
    // as the cannot-analyze card, and the still-photo note stands on
    // it saying movement was not judged.
    await expect(faceStage.getByText('AI analysis of your uploaded photo')).toBeVisible();
    await expect(faceStage.getByText(FACE_HEADLINE)).toBeVisible();
    await expect(faceStage.getByText('The AI could not analyze that file.')).toHaveCount(0);
    await expect(
      faceStage.getByText(/one still photo, so movement could not be judged/),
    ).toBeVisible();
    // The photo went to the single-photo task, not the sequence task.
    expect(counters.tasks).toEqual(['face-photo']);
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });

  test('fast live arm stage accepts one photo and renders the AI result with the photo note', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubWorker(page, ARM_HEADLINE, ARM_OBSERVATION);

    await gotoHash(page, '#lab/fast-live-check');
    await expect(
      page.getByRole('heading', { level: 1, name: /FAST Live Check/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start trying/i }).click();

    // Skip the face stage to land on the arm stage.
    const faceStage = page.locator('section[aria-label="Face stage"]');
    await faceStage.getByRole('button', { name: 'Skip this stage' }).click();

    const armStage = page.locator('section[aria-label="Arm stage"]');
    await expect(armStage.getByText('Upload a photo or video of the arm hold')).toBeVisible();

    await armStage.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'arms.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });
    await expect(counters.vision).toBe(0);

    await page.locator('.consent-box input[type="checkbox"]').check();
    await armStage.getByRole('button', { name: 'Analyze with AI' }).click();

    // The photo is accepted and described; the note says drift over
    // time could not be judged from one still moment.
    await expect(armStage.getByText('AI analysis of your uploaded photo')).toBeVisible();
    await expect(armStage.getByText(ARM_HEADLINE)).toBeVisible();
    await expect(armStage.getByText('The AI could not analyze that file.')).toHaveCount(0);
    await expect(
      armStage.getByText(/one still photo, so arm drift and movement over time could not be judged/),
    ).toBeVisible();
    expect(counters.tasks).toEqual(['fast-arm']);
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });

  test('movement lab arm mode accepts one photo and renders the AI sheet with the photo note', async ({
    page,
  }) => {
    const fatal = watchFatalErrors(page);
    const counters = await stubWorker(page, ARM_HEADLINE, ARM_OBSERVATION);

    await gotoHash(page, '#lab/movement-lab');
    await expect(
      page.getByRole('heading', { level: 1, name: /Movement Lab/i }),
    ).toBeVisible();
    await page.getByRole('button', { name: /start trying/i }).click();

    // Arm Raise is the default mode and upload its default source;
    // the panel now takes a photo as well as a video.
    await expect(page.getByText('Upload a photo or video of the arm hold')).toBeVisible();

    await page.locator('.upload-panel input[type="file"]').setInputFiles({
      name: 'arms.png',
      mimeType: 'image/png',
      buffer: PNG_BUFFER,
    });

    // The photo is prepared on this device and shown for approval;
    // preparing it sent nothing anywhere.
    await expect(
      page.getByText('This photo is what the AI will look at. Nothing has been sent yet.'),
    ).toBeVisible();
    await expect(counters.vision).toBe(0);

    await page.getByRole('button', { name: 'Analyze with AI' }).click();

    const sheet = page.locator('.result-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Live AI', { exact: true })).toBeVisible();
    await expect(sheet.getByText(ARM_HEADLINE)).toBeVisible();
    // The photo note stands on the sheet: position change over time
    // could not be judged from one still photo.
    await expect(
      sheet.getByText(/one still photo, so how the arm position changed or held over time/),
    ).toBeVisible();
    expect(counters.tasks).toEqual(['arm-video']);
    await expect(counters.vision).toBe(1);
    expect(fatal).toEqual([]);
  });
});
