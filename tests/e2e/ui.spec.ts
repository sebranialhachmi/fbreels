import { expect, test } from '@playwright/test';
import { PAGES, alertBox, trackErrors } from './helpers';

test.describe('navigation and links', () => {
  test('header and footer links all resolve', async ({ page, request, isMobile }) => {
    await page.goto('/');
    if (isMobile) await page.getByRole('button', { name: 'فتح القائمة' }).click();
    const nav = isMobile ? page.locator('#mobile-nav-panel') : page.locator('header nav').first();
    const header = await nav
      .locator('a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    expect(header).toHaveLength(5);
    const footer = await page
      .locator('footer a')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    expect(footer.length).toBeGreaterThanOrEqual(17);
    for (const href of new Set([...header, ...footer])) {
      expect(href).toMatch(/^\//);
      expect((await request.get(href)).status(), href).toBe(200);
    }
  });

  test('every internal link on every page resolves (no dead links)', async ({ page, request }) => {
    test.setTimeout(120_000);
    const seen = new Set<string>();
    for (const path of Object.values(PAGES)) {
      await page.goto(path);
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
      for (const href of hrefs) {
        if (/^(mailto:|tel:|#)/.test(href) || /^https?:\/\/(?!localhost)/.test(href)) continue;
        const p = href.split('#')[0]!;
        if (!p || seen.has(p)) continue;
        seen.add(p);
        expect((await request.get(p)).status(), `dead link ${p} on ${path}`).toBe(200);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(Object.keys(PAGES).length - 1);
  });

  test('external links are only the documented official/policy URLs', async ({ page }) => {
    for (const path of Object.values(PAGES)) {
      await page.goto(path);
      const external = await page
        .locator('a[href^="http"]')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
      for (const href of external)
        expect([
          'https://www.hrsd.gov.sa/ministry-services/services/end-service-benefit-calculator',
          'https://policies.google.com/technologies/ads',
        ]).toContain(href);
    }
  });

  test('breadcrumbs: article page shows the trail and links back', async ({ page }) => {
    await page.goto(PAGES.howTo!);
    const crumbs = page.getByRole('navigation', { name: 'مسار التنقل' });
    await expect(crumbs.getByRole('link').first()).toHaveAttribute('href', '/');
    await expect(crumbs.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(page.locator('script[type="application/ld+json"]')).not.toHaveCount(0);
  });

  test('articles index lists the articles', async ({ page }) => {
    await page.goto(PAGES.articles!);
    await expect(page.locator('main ul li a')).toHaveCount(3);
  });
});

test.describe('theme', () => {
  test('toggle switches and persists; OS preference is the default; storage can be blocked', async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.goto('/');
    expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
    const toggle = page.getByRole('button', { name: 'التبديل بين المظهر الفاتح والداكن' });
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      'rgb(11, 16, 32)',
    );

    const ctx = await browser.newContext({ baseURL, colorScheme: 'dark' });
    const p2 = await ctx.newPage();
    await p2.goto('/');
    await expect(p2.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();

    const blocked = await browser.newContext({ baseURL });
    await blocked.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('blocked');
        },
      });
    });
    const p3 = await blocked.newPage();
    const t = trackErrors(p3);
    await p3.goto('/');
    await p3.getByRole('button', { name: 'التبديل بين المظهر الفاتح والداكن' }).click();
    await expect(p3.locator('html')).toHaveAttribute('data-theme', 'dark');
    t.expectNone();
    await blocked.close();
  });
});

test.describe('responsive layout and RTL', () => {
  test('mobile menu opens, closes with Escape and navigates; desktop shows inline nav', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/');
    if (isMobile) {
      await expect(page.locator('header nav').first()).toBeHidden();
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
      await expect(page.getByRole('button', { name: 'إغلاق القائمة' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-nav-panel')).toBeHidden();
      await page.getByRole('button', { name: 'فتح القائمة' }).click();
      await page.locator('#mobile-nav-panel').getByRole('link', { name: 'المقالات' }).click();
      await expect(page).toHaveURL(/%D8%A7%D9%84%D9%85%D9%82%D8%A7%D9%84%D8%A7%D8%AA$/);
      await expect(page.locator('#mobile-nav-panel')).toBeHidden();
    } else {
      await expect(page.locator('header nav').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'فتح القائمة' })).toBeHidden();
    }
  });

  test('no horizontal scrolling at any width on any page type', async ({ page }) => {
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const name of ['home', 'howTo', 'privacy', 'contact', 'government']) {
        await page.goto(PAGES[name]!);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${name}@${width}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test('RTL geometry: brand on the right, controls on the left, LTR numeric fields', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'geometry asserted on desktop');
    await page.goto('/');
    const vw = page.viewportSize()!.width;
    expect((await page.locator('header a').first().boundingBox())!.x).toBeGreaterThan(vw / 2);
    expect(
      (await page.getByRole('button', { name: 'التبديل بين المظهر الفاتح والداكن' }).boundingBox())!
        .x,
    ).toBeLessThan(vw / 2);
    expect(
      await page.evaluate(() => getComputedStyle(document.documentElement).fontFamily),
    ).toContain('Cairo');
    await expect(page.getByRole('radio', { name: 'إدخال المدة يدوياً' })).toBeVisible();
    await page.getByRole('radio', { name: 'إدخال المدة يدوياً' }).check();
    await expect(page.getByRole('textbox', { name: 'سنوات' })).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
  });
});

test.describe('FAQ accordion', () => {
  test('opens and closes with mouse and keyboard', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('#faq-h ~ div details, section[aria-labelledby="faq-h"] details');
    expect(await items.count()).toBeGreaterThanOrEqual(4);
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
  });
});

test.describe('cookie settings (no optional tracking configured)', () => {
  test('dialog is reachable from the footer, keyboard-operable and honest', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('contentinfo')
      .getByRole('button', { name: 'إعدادات ملفات الارتباط' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('التخزين الأساسي في المتصفح فقط');
    await expect(dialog.getByRole('switch')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect((await page.context().cookies()).length).toBe(0); // the site sets no cookies at all
  });
});

test.describe('keyboard accessibility', () => {
  test('skip link is the first focus stop and jumps to main content', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard flow is exercised on desktop');
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'الانتقال إلى المحتوى الرئيسي' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('every interactive element has an accessible name', async ({ page }) => {
    for (const path of [PAGES.home!, PAGES.contact!, PAGES.government!]) {
      await page.goto(path);
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
          const labelled = !!(el as HTMLInputElement).labels?.length;
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
      expect(unnamed, path).toEqual([]);
    }
  });
});

test.describe('contact form', () => {
  test('validation errors are accessible; an unconfigured server reports unavailability honestly; no fabricated email', async ({
    page,
  }) => {
    await page.goto(PAGES.contact!);
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'إرسال الرسالة' }).click();
    await expect(page.getByText('أدخل اسمك (حرفان على الأقل).')).toBeVisible();
    await expect(page.getByLabel('البريد الإلكتروني')).toHaveAttribute('aria-invalid', 'true');
    await expect(alertBox(page)).toContainText('يرجى تصحيح الحقول المحدّدة.');

    await page.getByLabel('الاسم', { exact: true }).fill('أحمد علي');
    await page.getByLabel('البريد الإلكتروني').fill('a@example.com');
    await page.getByLabel('الرسالة', { exact: true }).fill('هذه رسالة اختبار طويلة بما يكفي.');
    await page.waitForTimeout(2700); // humans take longer than the anti-bot minimum fill time
    await page.getByRole('button', { name: 'إرسال الرسالة' }).click();
    await expect(alertBox(page)).toContainText('غير متاح حالياً');
    await expect(page.getByText('تم إرسال رسالتك')).toHaveCount(0);
  });
});
