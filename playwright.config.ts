import { defineConfig } from '@playwright/test';

const port = 5173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    {
      // Chromium-based mobile emulation. The previous iPhone 13 device
      // descriptor silently switched this project to WebKit, which neither
      // local machines nor CI install (CI installs Chromium only), so the
      // mobile matrix never actually ran. A Chromium project with a mobile
      // viewport, touch, and mobile emulation keeps the layout coverage and
      // really executes. Engine diversity (real WebKit) is a known gap.
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    // package.json pins the dev script to port 5173 with strictPort, so a
    // port conflict fails loudly here instead of testing a foreign server.
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60000,
    env: { VITE_API_BASE_URL: '' },
  },
});
