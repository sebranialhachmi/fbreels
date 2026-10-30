import { expect, test, type Page } from '@playwright/test';
import { CALCULATOR_PAGES, PAGES, alertBox, trackErrors } from './helpers';

const calc = (page: Page) => page.getByRole('button', { name: 'احسب المكافأة' });

async function manual(page: Page, years: string, basic: string, allowances = '') {
  await page.getByRole('radio', { name: 'إدخال المدة يدوياً' }).check();
  await page.getByRole('textbox', { name: 'سنوات' }).fill(years);
  await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).fill(basic);
  if (allowances)
    await page.getByRole('textbox', { name: /البدلات الثابتة الشهرية/ }).fill(allowances);
}

test.describe('calculator on every calculator page', () => {
  for (const name of CALCULATOR_PAGES) {
    test(`${name}: computes a result and explains it`, async ({ page }) => {
      const t = trackErrors(page);
      await page.goto(PAGES[name]!);
      await manual(page, '8', '7000');
      await calc(page).click();
      const total = page.getByTestId('eos-total');
      await expect(total).toBeVisible();
      const text = await total.innerText();
      expect(text).toMatch(/ريال$/);
      expect(text).not.toMatch(/NaN|undefined/);
      await expect(page.getByTestId('eos-result')).toContainText('تقديرية وليست استشارة قانونية');
      t.expectNone();
    });
  }

  test('home: end-to-end with dates matches the hand calculation (38,500) and shows the basic-only alternative', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('تاريخ بداية الخدمة').fill('2018-01-01');
    await page.getByLabel('تاريخ نهاية الخدمة').fill('2026-01-01');
    await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).fill('5000');
    await page.getByRole('textbox', { name: /البدلات الثابتة الشهرية/ }).fill('2000');
    await calc(page).click();
    await expect(page.getByTestId('eos-total')).toHaveText('38,500.00 ريال');
    await expect(page.getByTestId('eos-result')).toContainText('27,500.00 ريال');
    await expect(page.getByTestId('eos-result')).toContainText('8 سنوات');
  });

  test('resignation page applies Art. 85 fractions', async ({ page }) => {
    await page.goto(PAGES.resignation!);
    await manual(page, '3', '5000');
    await calc(page).click();
    await expect(page.getByTestId('eos-total')).toHaveText('2,500.00 ريال');
    await page.getByRole('textbox', { name: 'سنوات' }).fill('1');
    await calc(page).click();
    await expect(page.getByTestId('eos-total')).toHaveText('0.00 ريال');
    await page.getByRole('textbox', { name: 'سنوات' }).fill('10');
    await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).fill('8000');
    await calc(page).click();
    await expect(page.getByTestId('eos-total')).toHaveText('60,000.00 ريال');
  });

  test('validation errors are announced and linked', async ({ page }) => {
    await page.goto('/');
    await calc(page).click();
    await expect(alertBox(page)).toContainText('أدخل الأجر الأساسي');
    await expect(page.getByTestId('eos-result')).toHaveCount(0);
    await page.getByLabel('تاريخ بداية الخدمة').fill('2024-01-01');
    await page.getByLabel('تاريخ نهاية الخدمة').fill('2020-01-01');
    await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).fill('5000');
    await calc(page).click();
    await expect(alertBox(page)).toContainText('بعد تاريخ بدايتها');
  });

  test('keyboard: the whole flow works without a mouse', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow is exercised on desktop');
    await page.goto('/');
    await page.getByRole('radio', { name: 'إدخال المدة يدوياً' }).focus();
    await page.keyboard.press('Space');
    await page.getByRole('textbox', { name: 'سنوات' }).focus();
    await page.keyboard.type('5');
    await page.getByRole('textbox', { name: /الأجر الأساسي الشهري/ }).focus();
    await page.keyboard.type('4000');
    await page.keyboard.press('Enter'); // submits the form
    await expect(page.getByTestId('eos-total')).toHaveText('10,000.00 ريال');
    await expect(page.getByTestId('eos-result').locator('..')).toBeFocused(); // focus moves to the announced result region
  });

  test('nothing is sent to the server while calculating', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/api/')) requests.push(r.url());
    });
    await page.goto('/');
    await manual(page, '4', '6000');
    await calc(page).click();
    await expect(page.getByTestId('eos-total')).toBeVisible();
    expect(requests).toEqual([]);
  });
});

test.describe('sector pages do not offer a calculator', () => {
  for (const name of ['government', 'military', 'domestic', 'qiwa']) {
    test(name, async ({ page }) => {
      await page.goto(PAGES[name]!);
      await expect(page.getByRole('button', { name: 'احسب المكافأة' })).toHaveCount(0);
      await expect(page.locator('form[aria-label="حاسبة مكافأة نهاية الخدمة"]')).toHaveCount(0);
      await expect(page.locator('main a[href="/"]').first()).toBeVisible(); // points the visitor to the private-sector calculator
    });
  }
});
