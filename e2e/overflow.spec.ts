import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/#lab/face-analyzer', '/#lab/arm-drift', '/#fast', '/#emergency', '/#about'];

for (const route of ROUTES) {
  test(`no horizontal overflow at 390px on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForTimeout(400);
    const dims = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth + 1);
  });
}
