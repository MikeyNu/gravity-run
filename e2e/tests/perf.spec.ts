import { test, expect } from '@playwright/test';

// Performance certification targets
// These thresholds must pass on real devices; CI uses approximate simulation.
const TARGETS = {
  // Startup
  ttfb_ms: 800,            // Time to first meaningful paint
  first_paint_ms: 2000,    // First canvas render

  // Steady-state gameplay (60 fps = 16.67ms/frame)
  p95_frame_ms: 25,        // 95th percentile frame budget (allow thermal variance)
  p99_frame_ms: 40,        // 99th percentile — no jank above ~25 fps
  dropped_frame_pct: 5,    // Max fraction of frames > 33ms

  // Memory (mobile limit)
  js_heap_mb: 128,         // JavaScript heap at steady state
  gpu_memory_mb: 256,      // Approximate GPU memory (via VRAM heuristic)

  // Bundle size
  initial_bundle_kb: 350,  // Total script bytes for first paint
};

const SAMPLE_DURATION_MS = 5000; // how long to measure frame times

test.describe('Performance certification', () => {
  test('startup timing within budget @mobile-chrome', async ({ page }) => {
    const startMs = Date.now();
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });
    await page.waitForTimeout(200);
    const elapsed = Date.now() - startMs;
    expect(elapsed).toBeLessThan(TARGETS.first_paint_ms);
  });

  test('steady-state frame timing @mobile-chrome', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });

    // Start a run
    const startBtn = page.locator('[data-testid="start-endless"]');
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }
    await page.waitForTimeout(1000); // warm up

    // Collect frame times via rAF loop
    const frameTimes = await page.evaluate(
      (durationMs: number) =>
        new Promise<number[]>((resolve) => {
          const times: number[] = [];
          let last = performance.now();
          const tick = (): void => {
            const now = performance.now();
            times.push(now - last);
            last = now;
            if (now - times[0]! < durationMs) {
              requestAnimationFrame(tick);
            } else {
              resolve(times.slice(1)); // drop first warm-up frame
            }
          };
          requestAnimationFrame(tick);
        }),
      SAMPLE_DURATION_MS,
    );

    const sorted = [...frameTimes].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    const droppedCount = frameTimes.filter((t) => t > 33).length;
    const droppedPct = (droppedCount / frameTimes.length) * 100;

    console.log(`[perf] frames=${frameTimes.length} p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms dropped=${droppedPct.toFixed(1)}%`);

    expect(p95).toBeLessThan(TARGETS.p95_frame_ms);
    expect(p99).toBeLessThan(TARGETS.p99_frame_ms);
    expect(droppedPct).toBeLessThan(TARGETS.dropped_frame_pct);
  });

  test('JavaScript heap within limit @mobile-chrome', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });
    await page.waitForTimeout(3000); // let assets load

    const heapMb = await page.evaluate(() => {
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
      if (!perf.memory) return 0;
      return perf.memory.usedJSHeapSize / 1024 / 1024;
    });

    console.log(`[perf] js-heap=${heapMb.toFixed(1)}MB limit=${TARGETS.js_heap_mb}MB`);
    if (heapMb > 0) {
      expect(heapMb).toBeLessThan(TARGETS.js_heap_mb);
    }
  });
});

test.describe('Bundle budget', () => {
  test('initial bundle does not exceed size limit', async ({ page }) => {
    const requests: { url: string; bytes: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/assets/') && !url.endsWith('.js')) return;
      const contentLength = parseInt(response.headers()['content-length'] ?? '0', 10);
      if (contentLength > 0) requests.push({ url, bytes: contentLength });
    });

    await page.goto('/');
    await page.waitForSelector('canvas', { timeout: 15_000 });

    const totalKb = requests.reduce((sum, r) => sum + r.bytes, 0) / 1024;
    console.log(`[bundle] total-js=${totalKb.toFixed(1)}KB limit=${TARGETS.initial_bundle_kb}KB`);

    if (requests.length > 0) {
      expect(totalKb).toBeLessThan(TARGETS.initial_bundle_kb);
    }
  });
});
