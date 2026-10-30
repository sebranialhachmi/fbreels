import { describe, expect, it } from 'vitest';
import { formatPeriod, formatSar, parseIntStrict, parseNumber } from '@/lib/calc/parse';

describe('parseNumber', () => {
  it.each([
    ['6000', 6000],
    ['6,000', 6000],
    ['6٬000', 6000],
    ['٦٠٠٠', 6000],
    ['۶۰۰۰', 6000],
    ['5000.50', 5000.5],
    ['٥٠٠٠٫٥٠', 5000.5],
    ['  7500  ', 7500],
    ['0.5', 0.5],
  ])('%j -> %d', (input, expected) => expect(parseNumber(input)).toBe(expected));

  it.each(['', 'abc', '12abc', '1.2.3', '-5', '1e5', '٥٠٠٠ ريال', '--', '.'])(
    'rejects %j',
    (input) => expect(parseNumber(input)).toBeNaN(),
  );

  it('parseIntStrict treats empty as 0 and rejects fractions', () => {
    expect(parseIntStrict('')).toBe(0);
    expect(parseIntStrict('٣')).toBe(3);
    expect(parseIntStrict('2.5')).toBeNaN();
    expect(parseIntStrict('x')).toBeNaN();
  });
});

describe('formatting', () => {
  it('formats riyals with two decimals and Latin digits', () => {
    expect(formatSar(38500)).toBe('38,500.00 ريال');
    expect(formatSar(25666.67)).toBe('25,666.67 ريال');
    expect(formatSar(0)).toBe('0.00 ريال');
  });
  it('formats periods with correct Arabic number agreement', () => {
    expect(formatPeriod({ years: 1, months: 0, days: 0 })).toBe('سنة');
    expect(formatPeriod({ years: 2, months: 0, days: 0 })).toBe('سنتان');
    expect(formatPeriod({ years: 8, months: 0, days: 0 })).toBe('8 سنوات');
    expect(formatPeriod({ years: 12, months: 0, days: 0 })).toBe('12 سنة');
    expect(formatPeriod({ years: 3, months: 3, days: 5 })).toBe('3 سنوات و3 أشهر و5 أيام');
    expect(formatPeriod({ years: 0, months: 0, days: 0 })).toBe('أقل من يوم');
  });
});
