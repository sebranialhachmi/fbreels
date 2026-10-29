import { expect, test } from '@playwright/test';
import { ARTICLES, LEAK_PATTERN, LOCALES, PATHS, blogPath, trackErrors, type Loc } from './helpers';

const DIR: Record<Loc, string> = { en: 'ltr', fr: 'ltr', es: 'ltr', ar: 'rtl' };

test.describe('every public page in every language', () => {
  for (const loc of LOCALES) {
    for (const [name, byLoc] of Object.entries(PATHS)) {
      test(`${loc} ${name} renders correctly`, async ({ page }) => {
        const t = trackErrors(page);
        const res = await page.goto(byLoc[loc]);
        expect(res?.status()).toBe(200);

        const html = page.locator('html');
        await expect(html).toHaveAttribute('lang', loc);
        await expect(html).toHaveAttribute('dir', DIR[loc]);
        await expect(page.locator('h1')).toHaveCount(1);
        await expect(page.locator('h1')).toBeVisible();
        expect((await page.title()).length).toBeGreaterThan(10);

        // canonical + hreflang for all four languages and x-default
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical).toContain(`/${loc}`);
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(5);
        for (const l of [...LOCALES, 'x-default'])
          await expect(page.locator(`link[rel="alternate"][hreflang="${l}"]`)).toHaveCount(1);
        await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
        await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
        await expect(page.locator('meta[name="description"]')).toHaveCount(1);

        const text = await page.locator('body').innerText();
        expect(text).not.toMatch(LEAK_PATTERN);
        // landmarks
        await expect(page.getByRole('banner')).toHaveCount(1);
        await expect(page.locator('main#main')).toHaveCount(1);
        await expect(page.getByRole('contentinfo')).toHaveCount(1);
        t.expectNone();
      });
    }

    test(`${loc} blog articles render with one h1, headings and metadata`, async ({ page }) => {
      const t = trackErrors(page);
      for (const slug of ARTICLES[loc]) {
        const res = await page.goto(blogPath(loc, slug));
        expect(res?.status(), slug).toBe(200);
        await expect(page.locator('h1')).toHaveCount(1);
        expect(await page.locator('article h2').count()).toBeGreaterThanOrEqual(5);
        await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(5);
        await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
        expect(await page.locator('body').innerText()).not.toMatch(LEAK_PATTERN);
      }
      t.expectNone();
    });

    test(`${loc} blog index lists the five articles`, async ({ page }) => {
      await page.goto(PATHS.blog![loc]!);
      await expect(
        page.locator(
          'main ul li a[href*="/blog/"], main ul li a[href*="%D8%A7%D9%84%D9%85%D8%AF%D9%88%D9%86%D8%A9/"]',
        ),
      ).toHaveCount(5);
    });
  }
});

test.describe('custom 404 and unknown routes', () => {
  for (const loc of LOCALES) {
    test(`${loc} 404 page is localized, useful and noindex`, async ({ page }) => {
      const res = await page.goto(`/${loc}/this-page-does-not-exist`);
      expect(res?.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', loc);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
      expect(await page.locator('main a').count()).toBeGreaterThanOrEqual(6);
      expect(await page.locator('body').innerText()).not.toMatch(LEAK_PATTERN);
    });
  }

  test('unknown article slug and unknown locale', async ({ request }) => {
    expect((await request.get('/en/blog/nope')).status()).toBe(404);
    expect((await request.get('/fr/blog/nope')).status()).toBe(404);
    expect((await request.get('/ar/المدونة/nope')).status()).toBe(404);
  });
});

test.describe('root redirect and language detection', () => {
  for (const [header, expected] of [
    ['fr-FR,fr;q=0.9,en;q=0.8', '/fr'],
    ['es-MX,es;q=0.9', '/es'],
    ['ar-EG,ar;q=0.9', '/ar'],
    ['de-DE,de;q=0.9', '/en'],
    ['en-GB', '/en'],
  ] as const) {
    test(`Accept-Language ${header} -> ${expected}`, async ({ request }) => {
      const res = await request.get('/', {
        headers: { 'accept-language': header },
        maxRedirects: 0,
      });
      expect([307, 308]).toContain(res.status());
      expect(new URL(res.headers().location!, 'http://x').pathname).toBe(expected);
    });
  }

  test('an explicit stored language preference wins over Accept-Language', async ({ request }) => {
    const res = await request.get('/', {
      headers: { 'accept-language': 'fr', cookie: 'NEXT_LOCALE=ar' },
      maxRedirects: 0,
    });
    expect(new URL(res.headers().location!, 'http://x').pathname).toBe('/ar');
  });
});

test.describe('SEO files and security headers', () => {
  test('robots.txt, sitemap.xml, manifest and security headers', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toMatch(/Sitemap: http:\/\/localhost:3100\/sitemap\.xml/);

    const sm = await request.get('/sitemap.xml');
    expect(sm.status()).toBe(200);
    const xml = await sm.text();
    expect(xml).toContain('hreflang="ar"');
    expect(xml).toContain('hreflang="x-default"');
    expect((xml.match(/<loc>/g) ?? []).length).toBe(15 * 4 + 5 * 4);
    expect(xml).not.toContain('/api/');

    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('ReelSave');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
    expect((await request.get('/og.png')).status()).toBe(200);
    expect((await request.get('/icon.svg')).status()).toBe(200);

    const headers = (await request.get('/en')).headers();
    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toContain('googlesyndication'); // ads host only when ads are configured
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBeTruthy();
    // This e2e build uses an http:// site URL, so HTTPS-only hardening (HSTS, upgrade-insecure-requests) is deliberately off.
    expect(headers['strict-transport-security']).toBeUndefined();
    expect(headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('ads.txt is not published without a real publisher id', async ({ request }) => {
    expect((await request.get('/ads.txt')).status()).toBe(404);
  });

  test('no ad containers or ad scripts in production without configuration', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByTestId('ad-dev-placeholder')).toHaveCount(0);
    await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
    expect(
      await page.locator('script[src*="googlesyndication"], script[src*="plausible"]').count(),
    ).toBe(0);
    expect(await page.getByText('Advertisement').count()).toBe(0);
  });
});
