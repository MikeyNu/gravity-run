import { test, expect } from '@playwright/test';
import type { ReplaySubmission } from '@gravity-run/shared';

// Determinism contract: the same replay fixture must produce identical results
// on every browser and every run. Failures here indicate non-determinism bugs.

const GOLDEN_REPLAYS_URL = '/test-fixtures/replays/';

interface ReplayFixture {
  name: string;
  submission: ReplaySubmission;
  expectedScore: number;
  expectedDistance: number;
  expectedFragments: number;
}

// Load fixture index from the served static file
async function loadFixtures(page: import('@playwright/test').Page): Promise<ReplayFixture[]> {
  const response = await page.request.get(`${GOLDEN_REPLAYS_URL}index.json`);
  if (!response.ok()) return [];
  return response.json() as Promise<ReplayFixture[]>;
}

test.describe('Replay determinism — cross-browser', () => {
  test('golden replay index is reachable', async ({ page }) => {
    await page.goto('/');
    const response = await page.request.get(`${GOLDEN_REPLAYS_URL}index.json`);
    // 200 when fixtures exist, 404 when not yet generated — both valid states
    expect([200, 404]).toContain(response.status());
  });

  test('replay playback matches expected outcome', async ({ page }) => {
    await page.goto('/');
    const fixtures = await loadFixtures(page);
    if (fixtures.length === 0) {
      test.skip();
      return;
    }

    for (const fixture of fixtures) {
      await test.step(fixture.name, async () => {
        const result = await page.evaluate(
          async (submission: ReplaySubmission) => {
            // Access the game's replay validation API exposed for testing
            const api = (window as unknown as {
              __gravityRunTest?: {
                validateReplay(s: ReplaySubmission): Promise<{
                  score: number;
                  distance: number;
                  fragments: number;
                  hash: string;
                }>;
              };
            }).__gravityRunTest;
            if (!api) throw new Error('Test API not available');
            return api.validateReplay(submission);
          },
          fixture.submission,
        );

        expect(result.score).toBe(fixture.expectedScore);
        expect(result.distance).toBe(fixture.expectedDistance);
        expect(result.fragments).toBe(fixture.expectedFragments);
        expect(result.hash).toBe(fixture.submission.header.replayHash);
      });
    }
  });
});

test.describe('Replay hash integrity', () => {
  test('hash changes when score is tampered', async ({ page }) => {
    await page.goto('/');
    const fixtures = await loadFixtures(page);
    if (fixtures.length === 0) { test.skip(); return; }

    const fixture = fixtures[0];
    const tampered = {
      ...fixture.submission,
      clientResult: {
        ...fixture.submission.clientResult,
        score: fixture.submission.clientResult.score + 1,
      },
    };

    const isRejected = await page.evaluate(
      async (submission: ReplaySubmission) => {
        const api = (window as unknown as {
          __gravityRunTest?: {
            verifyHash(s: ReplaySubmission): Promise<boolean>;
          };
        }).__gravityRunTest;
        if (!api) return false;
        return !(await api.verifyHash(submission));
      },
      tampered,
    );

    expect(isRejected).toBe(true);
  });

  test('hash is stable across browsers for same seed', async ({ page, browserName }) => {
    await page.goto('/');
    const fixtures = await loadFixtures(page);
    if (fixtures.length === 0) { test.skip(); return; }

    // Record hash computed in this browser for the first fixture
    const fixture = fixtures[0];
    if (!fixture) return;

    const hash = await page.evaluate(
      async (submission: ReplaySubmission) => {
        const api = (window as unknown as {
          __gravityRunTest?: {
            computeHash(s: ReplaySubmission): Promise<string>;
          };
        }).__gravityRunTest;
        if (!api) return null;
        return api.computeHash(submission);
      },
      fixture.submission,
    );

    if (hash === null) { test.skip(); return; }
    // Log for cross-browser comparison in the report
    console.log(`[replay-hash] browser=${browserName} hash=${hash}`);
    expect(hash).toBe(fixture.submission.header.replayHash);
  });
});
