import { test, expect, type Page } from '@playwright/test';

// Stable snapshot threshold — allows minor GPU-specific sub-pixel differences
const THRESHOLD = 0.1;

async function waitForCanvas(page: Page): Promise<void> {
  // Wait until the WebGL canvas is present and the game loop has started
  await page.waitForSelector('canvas', { timeout: 15_000 });
  // Allow one rAF cycle for initial render
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.waitForTimeout(500);
}

async function dismissIntro(page: Page): Promise<void> {
  // Accept any initial dialog / start screen by pressing the primary action key
  const startBtn = page.locator('[data-testid="start-endless"]');
  if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await startBtn.click();
  }
}

test.describe('Visual regression — start screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
  });

  test('start screen matches baseline @chromium', async ({ page }) => {
    await expect(page).toHaveScreenshot('start-screen.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test('settings panel matches baseline @chromium', async ({ page }) => {
    const settingsBtn = page.locator('[data-testid="open-settings"]');
    await settingsBtn.click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('settings-panel.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test('character roster matches baseline @chromium', async ({ page }) => {
    const rosterBtn = page.locator('[data-testid="open-characters"]');
    await rosterBtn.click();
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('character-roster.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});

test.describe('Visual regression — gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
    await dismissIntro(page);
  });

  test('HUD elements visible during play @chromium', async ({ page }) => {
    // Give the simulation one second to settle
    await page.waitForTimeout(1_000);
    const hud = page.locator('[data-testid="hud"]');
    await expect(hud).toBeVisible();
    await expect(page).toHaveScreenshot('gameplay-hud.png', {
      maxDiffPixelRatio: THRESHOLD,
      // Clip to HUD region only to avoid canvas GPU variance
      clip: await hud.boundingBox() ?? undefined,
    });
  });

  test('failure screen matches baseline @chromium', async ({ page }) => {
    // Trigger failure by waiting for natural end or dispatching a test event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('gravity-run:test-trigger-failure'));
    });
    await page.waitForSelector('[data-testid="failure-screen"]', { timeout: 10_000 });
    await expect(page).toHaveScreenshot('failure-screen.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});

test.describe('Visual regression — accessibility', () => {
  test('high-contrast focus rings visible @chromium', async ({ page }) => {
    await page.goto('/');
    await waitForCanvas(page);
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot('focus-ring.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });

  test('reduced-motion flag suppresses animations @chromium', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForCanvas(page);
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('reduced-motion.png', {
      maxDiffPixelRatio: THRESHOLD,
    });
  });
});
