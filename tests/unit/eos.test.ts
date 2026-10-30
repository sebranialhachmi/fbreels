import { describe, expect, it } from 'vitest';
import {
  EosInputError,
  calculateEos,
  periodBetween,
  serviceToYears,
  type Reason,
} from '@/lib/calc/eos';

const calc = (wage: number, years: number, reason: Reason, months = 0, days = 0) =>
  calculateEos({ wage, service: { years, months, days }, reason });

describe('Art. 84 amount (hand-computed)', () => {
  it('3 years at 5,000 = half a month per year = 7,500', () => {
    const r = calc(5000, 3, 'employer_termination');
    expect(r.fullAmount).toBe(7500);
    expect(r.total).toBe(7500);
  });
  it('exactly 5 years at 8,000 = 20,000', () =>
    expect(calc(8000, 5, 'contract_end').total).toBe(20000));
  it('7 years at 6,000 = 5 × 3,000 + 2 × 6,000 = 27,000', () => {
    const r = calc(6000, 7, 'employer_termination');
    expect(r.firstFiveAmount).toBe(15000);
    expect(r.afterFiveAmount).toBe(12000);
    expect(r.total).toBe(27000);
  });
  it('12 years at 10,000 = 25,000 + 70,000 = 95,000', () =>
    expect(calc(10000, 12, 'retirement').total).toBe(95000));
  it('fractions of a year are proportional: 2 years 6 months at 4,000 = 5,000', () => {
    expect(calc(4000, 2, 'employer_termination', 6).total).toBe(5000);
  });
  it('6 months at 6,000 = 1,500 (when the full reward applies)', () =>
    expect(calc(6000, 0, 'contract_end', 6).total).toBe(1500));
  it('rounds to 2 decimals', () => {
    const r = calc(3333, 1, 'employer_termination', 1, 1);
    expect(Number.isInteger(r.total * 100)).toBe(true);
  });
});

describe('Art. 85 resignation fractions', () => {
  it('under 2 years: nothing', () => {
    expect(calc(5000, 1, 'resignation', 11, 30).total).toBe(0);
    expect(calc(5000, 1, 'resignation', 11, 30).fraction).toBe(0);
  });
  it('2 to <5 years: one third (3 years at 5,000: 7,500 / 3 = 2,500)', () => {
    const r = calc(5000, 3, 'resignation');
    expect(r.fraction).toBeCloseTo(1 / 3);
    expect(r.total).toBe(2500);
  });
  it('exactly 2 years is included in the one-third band', () =>
    expect(calc(6000, 2, 'resignation').fraction).toBeCloseTo(1 / 3));
  it('5 to <10 years: two thirds (6 years at 6,000: 18,000 + ... = 21,000 × 2/3 = 14,000)', () => {
    const r = calc(6000, 6, 'resignation');
    expect(r.fullAmount).toBe(21000);
    expect(r.total).toBe(14000);
  });
  it('exactly 5 years is in the two-thirds band, and 4y11m is still one third', () => {
    expect(calc(6000, 5, 'resignation').fraction).toBeCloseTo(2 / 3);
    expect(calc(6000, 4, 'resignation', 11, 29).fraction).toBeCloseTo(1 / 3);
  });
  it('10+ years: full (10 years at 6,000 = 15,000 + 30,000 = 45,000)', () => {
    const r = calc(6000, 10, 'resignation');
    expect(r.fraction).toBe(1);
    expect(r.total).toBe(45000);
  });
  it('the fraction does not apply to employer termination or other full-reward reasons', () => {
    for (const reason of [
      'employer_termination',
      'contract_end',
      'retirement',
      'worker_leave_art81',
      'marriage_childbirth_art87',
    ] as Reason[]) {
      expect(calc(5000, 1, reason).fraction).toBe(1);
    }
  });
});

describe('Art. 80 dismissal', () => {
  it('no reward regardless of service', () => {
    expect(calc(9000, 20, 'dismissal_art80').total).toBe(0);
    expect(calc(9000, 20, 'dismissal_art80').fullAmount).toBeGreaterThan(0);
  });
});

describe('input validation', () => {
  it.each([
    [{ wage: 0, service: { years: 1, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: -5, service: { years: 1, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: NaN, service: { years: 1, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: 0, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: -1, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: 1.5, months: 0, days: 0 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: 1, months: 12, days: 0 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: 1, months: 0, days: 31 }, reason: 'resignation' }],
    [{ wage: 5000, service: { years: 1, months: 0, days: 0 }, reason: 'nope' }],
  ])('rejects %j', (input) => {
    expect(() => calculateEos(input as never)).toThrow(EosInputError);
  });
});

describe('periodBetween', () => {
  it('computes whole years, months and days', () => {
    expect(periodBetween('2020-01-15', '2023-04-20')).toEqual({ years: 3, months: 3, days: 5 });
    expect(periodBetween('2020-01-31', '2020-03-01')).toEqual({ years: 0, months: 1, days: 1 });
    expect(periodBetween('2019-06-10', '2024-06-10')).toEqual({ years: 5, months: 0, days: 0 });
    expect(periodBetween('2020-03-31', '2020-04-30')).toEqual({ years: 0, months: 1, days: 0 }); // month-end clamped
  });
  it('handles borrowing across a year boundary', () => {
    expect(periodBetween('2021-11-20', '2023-02-10')).toEqual({ years: 1, months: 2, days: 21 });
  });
  it('rejects reversed, malformed and impossible dates', () => {
    expect(() => periodBetween('2023-01-01', '2022-01-01')).toThrow(EosInputError);
    expect(() => periodBetween('01/01/2020', '2022-01-01')).toThrow(EosInputError);
    expect(() => periodBetween('2020-02-30', '2022-01-01')).toThrow(EosInputError);
  });
  it('feeds the calculator end to end', () => {
    const p = periodBetween('2018-01-01', '2024-01-01'); // 6 years
    expect(serviceToYears(p)).toBe(6);
    expect(calculateEos({ wage: 6000, service: p, reason: 'employer_termination' }).total).toBe(
      21000,
    );
  });
});
