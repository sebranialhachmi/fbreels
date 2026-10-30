import { expect, test } from '@playwright/test';
import { LEAK, PAGES, trackErrors } from './helpers';

test.describe('every public page', () => {
  for (const [name, path] of Object.entries(PAGES)) {
    test(`${name} renders correctly`, async ({ page }) => {
      const t = trackErrors(page);
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', 'ar');
      await expect(html).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toBeVisible();
      expect((await page.title()).length).toBeGreaterThan(15);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical).toMatch(/^http:\/\/localhost:3100/);
      expect(decodeURIComponent(canonical!)).toBe(
        `http://localhost:3100${path === '/' ? '' : path}`,
      );
      await expect(page.locator('meta[name="description"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0); // single-language site: no false alternates
      await expect(page.getByRole('banner')).toHaveCount(1);
      await expect(page.getByRole('contentinfo')).toHaveCount(1);
      await expect(page.locator('main#main')).toHaveCount(1);
      expect(await page.locator('body').innerText()).not.toMatch(LEAK);
      t.expectNone();
    });
  }
});

test.describe('404 and unknown routes', () => {
  test('custom Arabic 404 with useful links and noindex', async ({ page }) => {
    const res = await page.goto('/صفحة-غير-موجودة');
    expect(res?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('الصفحة غير موجودة');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(await page.locator('main a').count()).toBeGreaterThanOrEqual(6);
  });
  test('unknown ASCII and nested paths return 404', async ({ request }) => {
    expect((await request.get('/nope')).status()).toBe(404);
    expect((await request.get('/a/b/c')).status()).toBe(404);
    expect((await request.get('/en')).status()).toBe(404);
  });
});

test.describe('SEO files and security headers', () => {
  test('robots, sitemap, manifest, icons and headers', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toMatch(/Sitemap: http:\/\/localhost:3100\/sitemap\.xml/);

    const xml = await (await request.get('/sitemap.xml')).text();
    expect((xml.match(/<loc>/g) ?? []).length).toBe(Object.keys(PAGES).length);
    expect(xml).not.toContain('/api/');
    expect(xml).not.toContain('localhost:3000');

    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.lang).toBe('ar');
    expect(manifest.dir).toBe('rtl');
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
    expect((await request.get('/og.png')).status()).toBe(200);

    const headers = (await request.get('/')).headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toContain('googlesyndication');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-powered-by']).toBeUndefined();
    expect(
      (await request.get('/fonts/cairo-arabic-wght-normal.woff2')).headers()['cache-control'],
    ).toContain('immutable');
  });

  test('ads.txt is not published and no ad or analytics scripts load by default', async ({
    page,
    request,
  }) => {
    expect((await request.get('/ads.txt')).status()).toBe(404);
    await page.goto('/');
    await expect(page.getByTestId('ad-dev-placeholder')).toHaveCount(0);
    expect(
      await page.locator('script[src*="googlesyndication"], script[src*="plausible"]').count(),
    ).toBe(0);
    await expect(page.getByRole('region', { name: 'تفضيلات ملفات الارتباط' })).toHaveCount(0);
  });

  test('API surface is minimal and safe', async ({ request }) => {
    expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok' });
    expect((await request.get('/api/extract')).status()).toBe(404);
    expect((await request.get('/api/download')).status()).toBe(404);
    const cross = await request.post('/api/contact', {
      data: {},
      headers: { origin: 'https://evil.example' },
    });
    expect(cross.status()).toBe(403);
    const bad = await request.post('/api/contact', { data: { name: 'x' } });
    expect(bad.status()).toBe(422);
  });
});
