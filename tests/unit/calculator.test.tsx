// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalculatorFor } from '@/components/calculator/calculator-for';

afterEach(cleanup);

const field = (name: string | RegExp) => screen.getByRole('textbox', { name });
const calcButton = () => screen.getByRole('button', { name: 'احسب المكافأة' });

async function fillManual(
  user: ReturnType<typeof userEvent.setup>,
  years: string,
  basic: string,
  allowances = '',
) {
  await user.click(screen.getByRole('radio', { name: 'إدخال المدة يدوياً' }));
  await user.type(field('سنوات'), years);
  await user.type(field(/الأجر الأساسي الشهري/), basic);
  if (allowances) await user.type(field(/البدلات الثابتة الشهرية/), allowances);
}

describe('EosCalculator', () => {
  it('shows the result only after pressing calculate, and matches the hand calculation', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    expect(screen.queryByTestId('eos-result')).not.toBeInTheDocument();
    await fillManual(user, '8', '7000');
    expect(screen.queryByTestId('eos-result')).not.toBeInTheDocument();
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('38,500.00 ريال');
    const result = screen.getByTestId('eos-result');
    expect(within(result).getByText('17,500.00 ريال')).toBeInTheDocument();
    expect(within(result).getByText('21,000.00 ريال')).toBeInTheDocument();
    expect(within(result).getByText('8 سنوات')).toBeInTheDocument();
    expect(result).toHaveTextContent('تقديرية وليست استشارة قانونية');
  });

  it('accepts Arabic-Indic digits and thousands separators', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await fillManual(user, '٣', '٥٬٠٠٠');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('7,500.00 ريال');
  });

  it('computes from dates', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.type(screen.getByLabelText('تاريخ بداية الخدمة'), '2018-01-01');
    await user.type(screen.getByLabelText('تاريخ نهاية الخدمة'), '2024-01-01');
    await user.type(field(/الأجر الأساسي الشهري/), '6000');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('21,000.00 ريال');
  });

  it('shows both results when allowances are entered, and honours the checkbox', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await fillManual(user, '6', '5000', '1500');
    await user.click(calcButton());
    // 6,500 incl. allowances: 16,250 + 6,500 = 22,750 ; basic only: 12,500 + 5,000 = 17,500
    expect(screen.getByTestId('eos-total')).toHaveTextContent('22,750.00 ريال');
    expect(screen.getByTestId('eos-result')).toHaveTextContent('17,500.00 ريال');
    await user.click(screen.getByRole('checkbox', { name: /احتساب البدلات/ }));
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('17,500.00 ريال');
    expect(screen.getByTestId('eos-result')).toHaveTextContent('22,750.00 ريال');
  });

  it('applies resignation fractions on the resignation preset', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="resignation" />);
    expect(screen.getByRole('combobox')).toHaveValue('resignation');
    await fillManual(user, '3', '5000');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('2,500.00 ريال');
    expect(screen.getByTestId('eos-result')).toHaveTextContent('ثلث');
  });

  it('gives zero for Art. 80 dismissal and for resignation under two years', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="termination" />);
    await user.selectOptions(screen.getByRole('combobox'), 'dismissal_art80');
    await fillManual(user, '10', '9000');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('0.00 ريال');
    cleanup();
    const user2 = userEvent.setup();
    render(<CalculatorFor preset="resignation" />);
    await fillManual(user2, '1', '9000');
    await user2.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('0.00 ريال');
  });

  it('limits the reason list per preset', () => {
    render(<CalculatorFor preset="resignation" />);
    const options = within(screen.getByRole('combobox'))
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['resignation', 'marriage_childbirth_art87', 'worker_leave_art81']);
    cleanup();
    render(<CalculatorFor preset="general" />);
    expect(within(screen.getByRole('combobox')).getAllByRole('option')).toHaveLength(7);
  });

  it.each([
    ['', '', 'أدخل الأجر الأساسي'],
    ['0', '', 'أدخل الأجر الأساسي'],
    ['abc', '', 'أدخل الأجر الأساسي'],
    ['5000', '', 'مدة الخدمة'],
  ])('validates input wage=%j years=%j with a clear Arabic error', async (wage, years, message) => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.click(screen.getByRole('radio', { name: 'إدخال المدة يدوياً' }));
    if (wage) await user.type(field(/الأجر الأساسي الشهري/), wage);
    if (years) await user.type(field('سنوات'), years);
    await user.click(calcButton());
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByTestId('eos-result')).not.toBeInTheDocument();
  });

  it('rejects reversed dates and missing dates', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.type(field(/الأجر الأساسي الشهري/), '5000');
    await user.click(calcButton());
    expect(screen.getByRole('alert')).toHaveTextContent('أدخل تاريخ بداية الخدمة');
    await user.type(screen.getByLabelText('تاريخ بداية الخدمة'), '2024-01-01');
    await user.type(screen.getByLabelText('تاريخ نهاية الخدمة'), '2020-01-01');
    await user.click(calcButton());
    expect(screen.getByRole('alert')).toHaveTextContent('بعد تاريخ بدايتها');
  });

  it('clears everything on reset', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await fillManual(user, '4', '5000');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-result')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إعادة تعيين' }));
    expect(screen.queryByTestId('eos-result')).not.toBeInTheDocument();
    expect(field(/الأجر الأساسي الشهري/)).toHaveValue('');
  });

  it('never sends any data over the network', async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...a: unknown[]) => {
      calls.push(a);
      return Promise.reject(new Error('no network expected'));
    }) as typeof fetch;
    render(<CalculatorFor preset="general" />);
    await fillManual(user, '5', '8000');
    await user.click(calcButton());
    globalThis.fetch = original;
    expect(calls).toHaveLength(0);
  });
});

describe('EosCalculator — accessible, field-level errors', () => {
  it('marks only the offending fields invalid, links each message and moves focus to the first one', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.click(calcButton());
    const start = screen.getByLabelText('تاريخ بداية الخدمة');
    const end = screen.getByLabelText('تاريخ نهاية الخدمة');
    const basic = field(/الأجر الأساسي الشهري/);
    for (const el of [start, end, basic]) {
      expect(el).toHaveAttribute('aria-invalid', 'true');
      const msg = document.getElementById(el.getAttribute('aria-describedby')!);
      expect(msg).toHaveTextContent(/أدخل/);
    }
    expect(field(/البدلات الثابتة الشهرية/)).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('تحقق من الحقول المحدّدة أدناه.');
    await vi.waitFor(() => expect(start).toHaveFocus());
  });

  it('clears the invalid state once the input is valid and the form is resubmitted', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.click(calcButton());
    expect(field(/الأجر الأساسي الشهري/)).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('radio', { name: 'إدخال المدة يدوياً' }));
    await user.type(field('سنوات'), '3');
    await user.type(field(/الأجر الأساسي الشهري/), '5000');
    await user.click(calcButton());
    expect(field(/الأجر الأساسي الشهري/)).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('eos-total')).toBeInTheDocument();
  });

  it('attributes a bad allowance and an out-of-range date to the right fields with clear messages', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="general" />);
    await user.type(screen.getByLabelText('تاريخ بداية الخدمة'), '1900-01-01');
    await user.type(screen.getByLabelText('تاريخ نهاية الخدمة'), '2024-01-01');
    await user.type(field(/الأجر الأساسي الشهري/), '5000');
    await user.type(field(/البدلات الثابتة الشهرية/), 'abc');
    await user.click(calcButton());
    expect(
      document.getElementById(
        screen.getByLabelText('تاريخ نهاية الخدمة').getAttribute('aria-describedby')!,
      ),
    ).toHaveTextContent('بين سنتي 1950 و2100');
    expect(
      document.getElementById(field(/البدلات الثابتة الشهرية/).getAttribute('aria-describedby')!),
    ).toHaveTextContent('قيمة البدلات غير صحيحة');
  });
});

describe('EosCalculator — inclusive end date option', () => {
  it('is unchecked by default, changes the band when ticked, and is reported in the result', async () => {
    const user = userEvent.setup();
    render(<CalculatorFor preset="resignation" />);
    const box = screen.getByRole('checkbox', { name: /احتساب يوم النهاية/ });
    expect(box).not.toBeChecked();
    await user.type(screen.getByLabelText('تاريخ بداية الخدمة'), '2020-01-01');
    await user.type(screen.getByLabelText('تاريخ نهاية الخدمة'), '2021-12-31');
    await user.type(field(/الأجر الأساسي الشهري/), '5000');
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('0.00 ريال');
    await user.click(box);
    await user.click(calcButton());
    expect(screen.getByTestId('eos-total')).toHaveTextContent('1,666.67 ريال');
    expect(screen.getByTestId('eos-result')).toHaveTextContent('شاملة يوم النهاية');
  });
});
