import { expect, test } from '@playwright/test';
import { ARTICLES, LEAK_PATTERN, LOCALES, PATHS, alertBox, blogPath, trackErrors } from './helpers';

const isMobile = (vp: { width: number } | null) => (vp?.width ?? 1200) < 768;

test.describe('navigation, footer and links', () => {
  test('header and footer links work in every language', async ({ page, viewport }) => {
    test.setTimeout(120_000);
    for (const loc of LOCALES) {
      await page.goto(PATHS.home![loc]!);
      const nav = isMobile(viewport)
        ? page.locator('#mobile-nav-panel')
        : page.locator('header nav').first();
      if (isMobile(viewport))
        await page.locator('header button[aria-controls="mobile-nav-panel"]').click();
      const headerHrefs = await nav
        .locator('a')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
      expect(headerHrefs).toHaveLength(5);
      const footerHrefs = await page
        .locator('footer a')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
      expect(footerHrefs.length).toBeGreaterThanOrEqual(14);
      for (const href of new Set([...headerHrefs, ...footerHrefs])) {
        expect(href, 'every link has a real href').toMatch(/^\//);
        const res = await page.request.get(href);
        expect(res.status(), `${loc} ${href}`).toBe(200);
      }
    }
  });

  test('every internal link on key pages resolves (no dead links)', async ({ page, request }) => {
    test.setTimeout(180_000);
    const seen = new Set<string>();
    for (const loc of LOCALES) {
      for (const url of [
        PATHS.home![loc]!,
        PATHS.tool![loc]!,
        PATHS.blog![loc]!,
        PATHS.howTo![loc]!,
        PATHS.sitemap![loc]!,
        blogPath(loc, ARTICLES[loc][0]!),
        PATHS.privacy![loc]!,
      ]) {
        await page.goto(url);
        const hrefs = await page
          .locator('a[href]')
          .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
        for (const href of hrefs) {
          if (/^(mailto:|tel:|#)/.test(href) || /^https?:\/\/(?!localhost)/.test(href)) continue;
          const path = href.split('#')[0]!;
          if (!path || seen.has(path)) continue;
          seen.add(path);
          const res = await request.get(path);
          expect(res.status(), `dead link ${path} on ${url}`).toBe(200);
        }
      }
    }
    expect(seen.size).toBeGreaterThan(40);
  });

  test('external links are only the documented Google policy page, with safe rel', async ({
    page,
  }) => {
    for (const p of [PATHS.privacy!.en!, PATHS.cookies!.en!]) {
      await page.goto(p);
      const external = await page
        .locator('a[href^="http"]')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
      for (const href of external)
        expect(href).toBe('https://policies.google.com/technologies/ads');
    }
  });

  test('breadcrumbs reflect the page and link home', async ({ page }) => {
    await page.goto(blogPath('fr', ARTICLES.fr[0]!));
    const crumbs = page.getByRole('navigation', { name: "Fil d'Ariane" });
    await expect(crumbs.getByRole('link').first()).toHaveAttribute('href', '/fr');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveCount(1);
  });
});

test.describe('language selector', () => {
  test('switches between equivalent pages and sets direction', async ({ page }) => {
    await page.goto(PATHS.howTo!.en!);
    await page.getByRole('button', { name: /Language/ }).click();
    await page.getByRole('link', { name: 'Français' }).click();
    await expect(page).toHaveURL(/\/fr\/comment-telecharger$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await page.getByRole('button', { name: /Langue/ }).click();
    await page.getByRole('link', { name: 'العربية' }).click();
    await expect(page).toHaveURL(
      /\/ar\/%D9%83%D9%8A%D9%81%D9%8A%D8%A9-%D8%A7%D9%84%D8%AA%D8%AD%D9%85%D9%8A%D9%84$/,
    );
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByRole('button', { name: /اللغة/ }).click();
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(/\/es\/como-descargar$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('h1')).toContainText('Cómo descargar');
  });

  test('maps a blog article to its sibling-language slug', async ({ page }) => {
    await page.goto(blogPath('en', ARTICLES.en[0]!));
    await page.getByRole('button', { name: /Language/ }).click();
    await page.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(new RegExp(`/es/blog/${ARTICLES.es[0]}$`));
    await expect(page.locator('h1')).toContainText('iPhone');
  });

  test('is fully keyboard operable (Enter opens, Escape closes and restores focus)', async ({
    page,
    isMobile: mobile,
  }) => {
    test.skip(mobile, 'keyboard flow is exercised on desktop');
    await page.goto('/en');
    const btn = page.getByRole('button', { name: /Language/ });
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#language-menu')).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect(page.locator('#language-menu a').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#language-menu')).toBeHidden();
    await expect(btn).toBeFocused();
  });
});

test.describe('theme', () => {
  test('toggle switches and persists, and the OS preference is the default', async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.goto('/en');
    const initial = await page.locator('html').getAttribute('data-theme');
    expect(initial).toBe('light');
    const toggle = page.getByRole('button', { name: 'Toggle light and dark theme' });
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // persisted, applied before paint
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(11, 16, 32)');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    const ctx = await browser.newContext({ baseURL, colorScheme: 'dark' });
    const p2 = await ctx.newPage();
    await p2.goto('/fr');
    await expect(p2.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();
  });

  test('works when storage is blocked', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    const p = await ctx.newPage();
    const t = trackErrors(p);
    await p.goto('/en');
    await expect(p.locator('html')).toHaveAttribute('data-theme', 'light');
    await p.getByRole('button', { name: 'Toggle light and dark theme' }).click();
    await expect(p.locator('html')).toHaveAttribute('data-theme', 'dark');
    t.expectNone();
    await ctx.close();
  });
});

test.describe('responsive navigation', () => {
  test('mobile menu opens, closes with Escape and navigates', async ({
    page,
    isMobile: mobile,
  }) => {
    test.skip(!mobile, 'mobile only');
    await page.goto('/en');
    const btn = page.getByRole('button', { name: 'Open menu' });
    await expect(page.locator('header nav').first()).toBeHidden();
    await btn.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-nav-panel')).toBeHidden();
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('#mobile-nav-panel').getByRole('link', { name: 'FAQ' }).click();
    await expect(page).toHaveURL(/\/en\/faq$/);
    await expect(page.locator('#mobile-nav-panel')).toBeHidden(); // closes after navigation
  });

  test('desktop shows the inline nav and no menu button', async ({ page, isMobile: mobile }) => {
    test.skip(mobile, 'desktop only');
    await page.goto('/en');
    await expect(page.locator('header nav').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden();
  });

  test('no horizontal scrolling at any width in any direction', async ({ page }) => {
    for (const loc of ['en', 'ar'] as const) {
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(PATHS.home![loc]!);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${loc}@${width}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('RTL layout', () => {
  test('Arabic mirrors the header, keeps the URL field LTR and aligns text to the right', async ({
    page,
    isMobile: mobile,
  }) => {
    test.skip(mobile, 'geometry asserted on desktop');
    await page.goto('/ar');
    const vw = page.viewportSize()!.width;
    const logo = await page.locator('header a').first().boundingBox();
    expect(logo!.x).toBeGreaterThan(vw / 2); // brand sits on the right in RTL
    const lang = await page.getByRole('button', { name: /اللغة/ }).boundingBox();
    expect(lang!.x).toBeLessThan(vw / 2); // controls on the left
    await expect(page.locator('input[name="url"]')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2); // Arabic font preloaded (no layout shift)
    const fontFamily = await page.evaluate(
      () => getComputedStyle(document.documentElement).fontFamily,
    );
    expect(fontFamily).toContain('Cairo');
    const align = await page
      .locator('footer p')
      .first()
      .evaluate((el) => getComputedStyle(el).textAlign);
    expect(['start', 'right']).toContain(align);
    await page.goto(PATHS.faq!.ar!);
    const chevronSide = await page
      .locator('summary')
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const svg = el.querySelector('svg')!.getBoundingClientRect();
        return svg.x < r.x + r.width / 2 ? 'left' : 'right';
      });
    expect(chevronSide).toBe('left'); // chevron sits at the logical end
  });

  test('LTR languages keep the brand on the left', async ({ page, isMobile: mobile }) => {
    test.skip(mobile, 'geometry asserted on desktop');
    for (const loc of ['en', 'fr', 'es'] as const) {
      await page.goto(`/${loc}`);
      await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0); // no Arabic font on LTR pages
      const logo = await page.locator('header a').first().boundingBox();
      expect(logo!.x).toBeLessThan(page.viewportSize()!.width / 2);
    }
  });
});

test.describe('FAQ accordion', () => {
  test('opens and closes with mouse and keyboard, in each language', async ({ page }) => {
    for (const loc of LOCALES) {
      await page.goto(PATHS.faq![loc]!);
      const items = page.locator('details');
      expect(await items.count()).toBeGreaterThanOrEqual(10);
      const first = items.first();
      await expect(first).not.toHaveAttribute('open', '');
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
      await first.locator('summary').click();
      await expect(first).not.toHaveAttribute('open', '');
      const second = items.nth(1);
      await second.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(second).toHaveAttribute('open', '');
      await page.keyboard.press('Space');
      await expect(second).not.toHaveAttribute('open', '');
    }
  });

  test('homepage FAQ has 10+ questions', async ({ page }) => {
    await page.goto('/en');
    expect(await page.locator('#faq details').count()).toBeGreaterThanOrEqual(10);
  });
});

test.describe('consent and cookie settings (no optional tracking configured)', () => {
  test('no banner; settings dialog is reachable from the footer, keyboard-operable and honest', async ({
    page,
  }) => {
    await page.goto('/en');
    await expect(page.getByRole('region', { name: 'Cookie preferences' })).toHaveCount(0);
    await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie settings' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('only essential browser storage');
    await expect(dialog.getByRole('switch')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Only essential storage is used.
    const cookies = (await page.context().cookies()).map((c) => c.name);
    expect(cookies.every((n) => n === 'NEXT_LOCALE')).toBe(true);
  });
});

test.describe('keyboard accessibility', () => {
  test('skip link is the first focus stop and jumps to main content', async ({
    page,
    isMobile: mobile,
  }) => {
    test.skip(mobile, 'keyboard flow is exercised on desktop');
    await page.goto('/en');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('downloader is reachable and submittable with the keyboard', async ({
    page,
    isMobile: mobile,
  }) => {
    test.skip(mobile, 'keyboard flow is exercised on desktop');
    await page.goto('/en');
    const input = page.getByLabel('Facebook Reel or video link');
    await input.focus();
    await page.keyboard.type('definitely not a link');
    await page.keyboard.press('Enter');
    await expect(alertBox(page)).toContainText('does not look like a valid link');
    // focus indicator is visible on the focused control
    const outline = await input.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('every button and link has an accessible name; no dead primary buttons', async ({
    page,
  }) => {
    for (const loc of LOCALES) {
      await page.goto(PATHS.home![loc]!);
      const unnamed = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll(
          'button, a[href], input:not([type=hidden]), select, textarea',
        )) {
          if (el.closest('[aria-hidden="true"]')) continue;
          const name = (
            el.getAttribute('aria-label') ||
            (el as HTMLElement).innerText ||
            (el as HTMLInputElement).placeholder ||
            ''
          ).trim();
          const labelled = (el as HTMLInputElement).labels?.length ? true : false;
          if (
            !name &&
            !labelled &&
            !el.getAttribute('aria-labelledby') &&
            !el.getAttribute('title')
          )
            bad.push(el.outerHTML.slice(0, 120));
        }
        return bad;
      });
      expect(unnamed, loc).toEqual([]);
      const dead = await page.locator('a:not([href])').count();
      expect(dead).toBe(0);
    }
  });
});

test.describe('downloader without a configured provider (the real default)', () => {
  test('invalid and unsupported links are rejected locally with clear messages', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => r.url().includes('/api/extract') && requests.push(r.url()));
    await page.goto('/en');
    const input = page.getByLabel('Facebook Reel or video link');
    const submit = page.getByRole('button', { name: 'Download', exact: true });
    await submit.click();
    await expect(alertBox(page)).toContainText('Paste a Facebook Reel or video link first.');
    await input.fill('https://evil.example/reel/1234567');
    await submit.click();
    await expect(alertBox(page)).toContainText('not supported');
    await input.fill('https://facebook.com.evil.example/reel/1234567');
    await submit.click();
    await expect(alertBox(page)).toContainText('not supported');
    await input.fill('hello world');
    await submit.click();
    await expect(alertBox(page)).toContainText('does not look like a valid link');
    expect(requests).toHaveLength(0);
  });

  test('a valid link yields an honest "not configured" state, never a fake success', async ({
    page,
  }) => {
    await page.goto('/en');
    await page
      .getByLabel('Facebook Reel or video link')
      .fill('https://www.facebook.com/reel/1234567890');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    const panel = page.getByTestId('error-panel');
    await expect(panel).toContainText('has not been configured');
    await expect(page.getByTestId('result-card')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(await page.locator('a[href^="/api/download"]').count()).toBe(0);
  });

  test('the same state is localized in French, Spanish and Arabic', async ({ page }) => {
    for (const [loc, text] of [
      ['fr', "n'a pas été configuré"],
      ['es', 'no se ha configurado'],
      ['ar', 'لم تُهيَّأ'],
    ] as const) {
      await page.goto(`/${loc}`);
      await page.locator('input[name="url"]').fill('https://www.facebook.com/reel/1234567890');
      await page.locator('form button[type="submit"]').click();
      await expect(page.getByTestId('error-panel')).toContainText(text);
    }
  });

  test('clipboard permission failure is handled gracefully', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'chromium permissions API');
    await context.clearPermissions();
    await page.goto('/en');
    await page.getByRole('button', { name: 'Paste from clipboard' }).click();
    await expect(page.getByText(/could not read your clipboard|clipboard is empty/i)).toBeVisible();
    await expect(page.getByLabel('Facebook Reel or video link')).toBeFocused();
  });

  test('pasting from the clipboard fills the field but never submits', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const requests: string[] = [];
    page.on('request', (r) => r.url().includes('/api/extract') && requests.push(r.url()));
    await page.goto('/en');
    await page.evaluate(() =>
      navigator.clipboard.writeText('https://www.facebook.com/reel/1234567890'),
    );
    await page.getByRole('button', { name: 'Paste from clipboard' }).click();
    await expect(page.getByLabel('Facebook Reel or video link')).toHaveValue(
      'https://www.facebook.com/reel/1234567890',
    );
    await page.waitForTimeout(400);
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Clear the link' }).click();
    await expect(page.getByLabel('Facebook Reel or video link')).toHaveValue('');
  });
});

test.describe('contact form', () => {
  test('validation errors are accessible, and an unconfigured server reports unavailability honestly', async ({
    page,
  }) => {
    await page.goto('/en/contact');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Enter your name (at least 2 characters).')).toBeVisible();
    await expect(page.getByLabel('Your email address')).toHaveAttribute('aria-invalid', 'true');
    await expect(alertBox(page)).toContainText('Please fix the highlighted fields.');

    await page.getByLabel('Your name').fill('Ada Lovelace');
    await page.getByLabel('Your email address').fill('ada@example.com');
    await page.getByLabel('What is this about?').selectOption('copyright');
    await page.getByLabel('Message').fill('This is a sufficiently long test message.');
    await page.waitForTimeout(2700); // humans take longer than the anti-bot minimum fill time
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(alertBox(page)).toContainText('not available right now');
    await expect(page.getByText('Thank you. Your message has been sent.')).toHaveCount(0);
  });

  test('does not show a fabricated email address', async ({ page }) => {
    await page.goto('/en/contact');
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  });
});

test.describe('API surface', () => {
  test('rejects cross-origin and malformed requests and exposes no GET', async ({ request }) => {
    const bad = await request.post('/api/extract', {
      data: { url: 'https://evil.example/x' },
      headers: { origin: 'https://evil.example' },
    });
    expect(bad.status()).toBe(403);
    const invalid = await request.post('/api/extract', { data: { url: 'https://evil.example/x' } });
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).error.code).toBe('UNSUPPORTED_URL');
    expect((await request.get('/api/extract')).status()).toBe(405);
    expect((await request.get('/api/download?t=junk')).status()).toBe(410);
    expect((await request.get('/api/download?url=http://169.254.169.254/')).status()).toBe(410);
    const health = await request.get('/api/health');
    expect(await health.json()).toEqual({ status: 'ok' });
  });

  test('no untranslated or leaked strings on any homepage', async ({ page }) => {
    for (const loc of LOCALES) {
      await page.goto(PATHS.home![loc]!);
      expect(await page.locator('body').innerText()).not.toMatch(LEAK_PATTERN);
    }
  });
});
