import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ARTICLES, LOCALES, PATHS, blogPath } from './helpers';

const pages = (loc: (typeof LOCALES)[number]) => [
  PATHS.home![loc]!,
  PATHS.tool![loc]!,
  PATHS.faq![loc]!,
  PATHS.contact![loc]!,
  PATHS.privacy![loc]!,
  PATHS.blog![loc]!,
  blogPath(loc, ARTICLES[loc][0]!),
  PATHS.sitemap![loc]!,
  PATHS.cookies![loc]!,
];

test.describe('automated accessibility (axe, WCAG 2.x A/AA rules)', () => {
  for (const loc of LOCALES) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${loc} ${theme}`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
        for (const url of pages(loc)) {
          await page.goto(url);
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const summary = results.violations.map(
            (v) =>
              `${v.id} (${v.impact}): ${v.nodes
                .slice(0, 3)
                .map((n) => n.target.join(' '))
                .join(' | ')}`,
          );
          expect(summary, `${url}\n${summary.join('\n')}`).toEqual([]);
        }
      });
    }
  }

  test('error state and open dialog are accessible', async ({ page }) => {
    await page.goto('/en');
    await page
      .getByLabel('Facebook Reel or video link')
      .fill('https://www.facebook.com/reel/1234567890');
    await page.getByRole('button', { name: 'Download', exact: true }).click();
    await expect(page.getByTestId('error-panel')).toBeVisible();
    let results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await page.getByRole('button', { name: 'Cookie settings' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
