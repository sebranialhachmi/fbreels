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

describe('inclusive end date option', () => {
  it('is off by default and shifts the end by one day when on', () => {
    expect(periodBetween('2020-01-01', '2021-12-31')).toEqual({ years: 1, months: 11, days: 30 });
    expect(periodBetween('2020-01-01', '2021-12-31', { inclusiveEnd: true })).toEqual({
      years: 2,
      months: 0,
      days: 0,
    });
    expect(periodBetween('2020-01-01', '2021-12-31', { inclusiveEnd: false })).toEqual({
      years: 1,
      months: 11,
      days: 30,
    });
  });
  it('turns a one-day-short resignation into the next band (the case found by the audit)', () => {
    const wage = 5000;
    const excl = calculateEos({
      wage,
      service: periodBetween('2020-01-01', '2021-12-31'),
      reason: 'resignation',
    });
    const incl = calculateEos({
      wage,
      service: periodBetween('2020-01-01', '2021-12-31', { inclusiveEnd: true }),
      reason: 'resignation',
    });
    expect(excl.total).toBe(0);
    expect(incl.total).toBe(1666.67);
  });
  it('a single worked day counts as one day when inclusive, and still rejects reversed dates', () => {
    expect(periodBetween('2024-05-05', '2024-05-05', { inclusiveEnd: true })).toEqual({
      years: 0,
      months: 0,
      days: 1,
    });
    expect(() => periodBetween('2024-05-05', '2024-05-04', { inclusiveEnd: true })).toThrow(
      EosInputError,
    );
  });
});

describe('exact money arithmetic (property tests against rational arithmetic)', () => {
  // Deterministic LCG so failures are reproducible.
  let seed = 987654321;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  /** Reference: BigInt rational arithmetic with half-up rounding to halalas. */
  function reference(cents: bigint, y: number, m: number, d: number, reason: Reason): number {
    const T = BigInt(y * 4380 + m * 365 + d * 12);
    const five = 5n * 4380n;
    const first = T < five ? T : five;
    const after = T > five ? T - five : 0n;
    const num = cents * (first + 2n * after);
    const den = 2n * 4380n;
    let fnum = 1n;
    let fden = 1n;
    if (reason === 'resignation') {
      if (T < 2n * 4380n) fnum = 0n;
      else if (T < 5n * 4380n) fden = 3n;
      else if (T < 10n * 4380n) {
        fnum = 2n;
        fden = 3n;
      }
    }
    const a = num * fnum;
    const b = den * fden;
    return Number((2n * a + b) / (2n * b));
  }

  it('matches the exact result to the halala on 40,000 random cases', () => {
    const mismatches: string[] = [];
    for (let i = 0; i < 40_000; i++) {
      const cents = 1000 + Math.floor(rnd() * 2_000_000);
      const y = Math.floor(rnd() * 30);
      const m = Math.floor(rnd() * 12);
      const d = Math.floor(rnd() * 31);
      const reason: Reason = rnd() < 0.5 ? 'employer_termination' : 'resignation';
      if (y === 0 && m === 0 && d === 0) continue;
      const got = Math.round(
        calculateEos({ wage: cents / 100, service: { years: y, months: m, days: d }, reason })
          .total * 100,
      );
      const want = reference(BigInt(cents), y, m, d, reason);
      if (got !== want && mismatches.length < 5)
        mismatches.push(`${cents / 100} ${y}y${m}m${d}d ${reason}: ${got} != ${want}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('displayed parts always add up to the displayed full amount', () => {
    for (let i = 0; i < 20_000; i++) {
      const wage = (1000 + Math.floor(rnd() * 2_000_000)) / 100;
      const service = {
        years: Math.floor(rnd() * 30),
        months: Math.floor(rnd() * 12),
        days: Math.floor(rnd() * 31),
      };
      if (!service.years && !service.months && !service.days) continue;
      const r = calculateEos({ wage, service, reason: 'employer_termination' });
      expect(Math.round((r.firstFiveAmount + r.afterFiveAmount) * 100)).toBe(
        Math.round(r.fullAmount * 100),
      );
      expect(r.total).toBe(r.fullAmount); // full reward reasons: nothing is deducted
    }
  });

  it('the total never decreases as the end date moves later (monotonic, no discontinuities)', () => {
    for (let i = 0; i < 120; i++) {
      const start = new Date(
        Date.UTC(1998 + Math.floor(rnd() * 28), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 28)),
      );
      let prev = -1;
      for (let k = 0; k <= 4200; k += 7) {
        const end = new Date(start.getTime() + k * 86_400_000);
        const p = periodBetween(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
        expect(p.days).toBeGreaterThanOrEqual(0);
        expect(p.days).toBeLessThanOrEqual(30);
        if (!p.years && !p.months && !p.days) continue;
        const total = calculateEos({
          wage: 6000,
          service: p,
          reason: 'employer_termination',
        }).total;
        expect(total).toBeGreaterThanOrEqual(prev);
        prev = total;
      }
    }
  });

  it('known rounding regressions found by the audit are fixed', () => {
    const t = (wage: number, y: number, m: number, d: number, reason: Reason) =>
      calculateEos({ wage, service: { years: y, months: m, days: d }, reason }).total;
    expect(t(2529.45, 16, 0, 21, 'resignation')).toBe(34293.11);
    expect(t(11605.62, 15, 5, 0, 'employer_termination')).toBe(149905.93);
    expect(t(902.81, 13, 0, 0, 'resignation')).toBe(9479.51);
    expect(t(299.61, 3, 8, 0, 'resignation')).toBe(183.1);
  });
});

describe('boundaries and leap years', () => {
  const t = (wage: number, p: { years: number; months: number; days: number }, reason: Reason) =>
    calculateEos({ wage, service: p, reason }).total;
  it('Art. 85 bands change exactly at 2, 5 and 10 years and not a day earlier', () => {
    expect(t(6000, { years: 1, months: 11, days: 30 }, 'resignation')).toBe(0);
    expect(t(6000, { years: 2, months: 0, days: 0 }, 'resignation')).toBe(2000);
    expect(
      calculateEos({
        wage: 6000,
        service: { years: 4, months: 11, days: 30 },
        reason: 'resignation',
      }).fraction,
    ).toBeCloseTo(1 / 3);
    expect(
      calculateEos({ wage: 6000, service: { years: 5, months: 0, days: 0 }, reason: 'resignation' })
        .fraction,
    ).toBeCloseTo(2 / 3);
    expect(
      calculateEos({
        wage: 6000,
        service: { years: 9, months: 11, days: 30 },
        reason: 'resignation',
      }).fraction,
    ).toBeCloseTo(2 / 3);
    expect(
      calculateEos({
        wage: 6000,
        service: { years: 10, months: 0, days: 0 },
        reason: 'resignation',
      }).fraction,
    ).toBe(1);
  });
  it('leap days and month ends', () => {
    expect(periodBetween('2020-02-29', '2021-02-28')).toEqual({ years: 1, months: 0, days: 0 });
    expect(periodBetween('2020-02-29', '2024-02-29')).toEqual({ years: 4, months: 0, days: 0 });
    expect(periodBetween('2019-01-31', '2019-02-28')).toEqual({ years: 0, months: 1, days: 0 });
    expect(periodBetween('2021-01-31', '2021-03-01')).toEqual({ years: 0, months: 1, days: 1 });
  });
  it('very small and very large wages stay exact', () => {
    expect(t(0.01, { years: 3, months: 0, days: 0 }, 'employer_termination')).toBe(0.02);
    expect(t(9_999_999.99, { years: 3, months: 0, days: 0 }, 'employer_termination')).toBe(
      14_999_999.99,
    );
    expect(
      t(10_000_000, { years: 70, months: 11, days: 30 }, 'employer_termination'),
    ).toBeGreaterThan(600_000_000);
  });
});
