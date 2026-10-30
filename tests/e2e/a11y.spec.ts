import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { PAGES } from './helpers';

test.describe('automated accessibility (axe, WCAG 2.x A/AA rules) on every page', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`all pages, ${theme} theme`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      for (const [name, path] of Object.entries(PAGES)) {
        await page.goto(path);
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
        expect(summary, `${name}\n${summary.join('\n')}`).toEqual([]);
      }
    });
  }

  test('calculator result and error states and the open dialog are accessible', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'احسب المكافأة' }).click();
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toBeVisible();
    let results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
    await page.getByRole('radio', { name: 'إدخال المدة يدوياً' }).check();
    await page.getByRole('textbox', { name: 'سنوات' }).fill('8');
    await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).fill('7000');
    await page.getByRole('textbox', { name: /البدلات الثابتة الشهرية/ }).fill('1000');
    await page.getByRole('button', { name: 'احسب المكافأة' }).click();
    await expect(page.getByTestId('eos-result')).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    await page.getByRole('button', { name: 'إعدادات ملفات الارتباط' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
