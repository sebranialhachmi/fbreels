import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

// These run against a dev server using the TEST-ONLY mock provider. They verify the UI flow and
// download delivery mechanics. They do NOT demonstrate real Facebook downloading.

const reel = (id: string) => `https://www.facebook.com/reel/${id}`;

async function submit(page: import('@playwright/test').Page, url: string) {
  await page.getByLabel('Facebook Reel or video link').fill(url);
  await page.getByRole('button', { name: 'Download', exact: true }).click();
}

test.describe('downloader UI with the test-only mock provider', () => {
  test('renders a clearly-labelled result and delivers a safe attachment', async ({ page }) => {
    const t = trackErrors(page);
    await page.goto('/en');
    await submit(page, reel('5550000001'));
    const card = page.getByTestId('result-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Test data');
    await expect(card).toContainText('Test-only mock video 5550000001');
    await expect(card.getByRole('link', { name: /^Save/ })).toHaveCount(1);
    await expect(card).not.toContainText('HD');
    await expect(card).not.toContainText('Audio');

    const href = await card.getByRole('link', { name: /^Save/ }).getAttribute('href');
    expect(href).toMatch(/^\/api\/download\?t=[A-Za-z0-9_-]+$/);
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toMatch(
      /^attachment; filename="[A-Za-z0-9._-]+\.txt"/,
    );
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['cache-control']).toBe('no-store');
    expect(await res.text()).toContain('TEST-ONLY FILE');
    t.expectNone();
  });

  test('triggers a real browser download when Save is activated', async ({ page }) => {
    await page.goto('/en');
    await submit(page, reel('5550000002'));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('result-card').getByRole('link', { name: /^Save/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.txt$/);
  });

  test('shows HD, SD and audio only when the provider reports them', async ({ page }) => {
    await page.goto('/en');
    await submit(page, reel('9990006'));
    const items = page.getByTestId('result-card').locator('li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('HD');
    await expect(items.nth(1)).toContainText('SD');
    await expect(items.nth(2)).toContainText('Audio');
    for (const a of await page.getByTestId('result-card').getByRole('link').all())
      await expect(a).toHaveAttribute('href', /\/api\/download\?t=/);
  });

  test('handles share-link style and tracking-parameter URLs', async ({ page }) => {
    await page.goto('/en');
    await submit(page, 'https://m.facebook.com/reel/5550000003?s=abc&fbclid=zzz');
    await expect(page.getByTestId('result-card')).toBeVisible();
  });

  for (const [id, text] of [
    ['9990001', 'private or not publicly accessible'],
    ['9990002', 'unavailable'],
    ['9990003', 'no downloadable format'],
    ['9990004', 'temporarily unavailable'],
    ['9990005', 'took too long'],
  ] as const) {
    test(`scenario ${id} shows a clear error with retry`, async ({ page }) => {
      await page.goto('/en');
      await submit(page, reel(id));
      await expect(page.getByTestId('error-panel')).toContainText(text);
      await expect(page.getByTestId('result-card')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    });
  }

  test('loading state is shown and the button is disabled during the request', async ({ page }) => {
    await page.route('**/api/extract', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await page.goto('/en');
    await submit(page, reel('5550000004'));
    await expect(page.getByTestId('loading-skeleton')).toBeVisible();
    await expect(page.getByRole('button', { name: /Checking/ })).toBeDisabled();
    await expect(page.getByTestId('result-card')).toBeVisible();
    await expect(page.getByTestId('loading-skeleton')).toHaveCount(0);
  });

  test('result flow works in Arabic (RTL) and French', async ({ page }) => {
    await page.goto('/ar');
    await page.locator('input[name="url"]').fill(reel('5550000005'));
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByTestId('result-card')).toBeVisible();
    await expect(page.getByTestId('result-card')).toContainText('بيانات اختبار');
    await page.goto('/fr');
    await page.locator('input[name="url"]').fill(reel('5550000005'));
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByTestId('result-card')).toContainText('Données de test');
  });

  test('the dev placeholder for ads is visible only in development and is clearly labelled', async ({
    page,
  }) => {
    await page.goto('/en');
    const placeholder = page.getByTestId('ad-dev-placeholder').first();
    await expect(placeholder).toContainText('DEV ONLY');
    // Not adjacent to the downloader card: generous vertical gap
    const tool = await page.locator('form').first().boundingBox();
    const ad = await placeholder.boundingBox();
    expect(ad!.y - (tool!.y + tool!.height)).toBeGreaterThan(150);
  });
});
