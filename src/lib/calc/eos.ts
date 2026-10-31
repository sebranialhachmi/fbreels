/**
 * End-of-service reward under the Saudi Labor Law (private sector), as of the text this tool was written
 * against: Art. 84 (amount), Art. 85 (resignation fractions), Art. 80 (dismissal without reward),
 * Art. 81 and Art. 87 (leaving work while keeping the full reward).
 *
 * This is an ESTIMATE, not legal advice. The owner must verify these rules against the current official text
 * (Ministry of Human Resources and Social Development) before publishing, and whenever the law changes.
 */

export const REASONS = [
  'employer_termination',
  'contract_end',
  'retirement',
  'resignation',
  'worker_leave_art81',
  'marriage_childbirth_art87',
  'dismissal_art80',
] as const;

export type Reason = (typeof REASONS)[number];

export const REASON_LABELS: Record<Reason, string> = {
  employer_termination: 'إنهاء العقد من صاحب العمل',
  contract_end: 'انتهاء مدة العقد',
  retirement: 'بلوغ سن التقاعد',
  resignation: 'استقالة العامل',
  worker_leave_art81: 'ترك العامل العمل لأحد أسباب المادة 81',
  marriage_childbirth_art87: 'استقالة العاملة بسبب الزواج أو الولادة (المادة 87)',
  dismissal_art80: 'فصل العامل لأحد أسباب المادة 80',
};

/** Reasons that give the full Art. 84 amount. */
const FULL_REWARD: ReadonlySet<Reason> = new Set([
  'employer_termination',
  'contract_end',
  'retirement',
  'worker_leave_art81',
  'marriage_childbirth_art87',
]);

export type ServicePeriod = { years: number; months: number; days: number };

export type EosInput = {
  /** Last total monthly wage (basic + fixed allowances), in riyals. */
  wage: number;
  service: ServicePeriod;
  reason: Reason;
};

export type EosResult = {
  /** Service as a decimal number of years. */
  serviceYears: number;
  /** Reward for the first five years (half a month per year). */
  firstFiveAmount: number;
  /** Reward for years beyond five (a full month per year). */
  afterFiveAmount: number;
  /** Art. 84 amount before any Art. 85 fraction. */
  fullAmount: number;
  /** Fraction of the full amount that is due for the chosen reason (0, 1/3, 2/3 or 1). */
  fraction: number;
  /** Final amount due, rounded to 2 decimals. */
  total: number;
  /** Plain-language reason for the fraction applied. */
  note: string;
};

export class EosInputError extends Error {}

export function serviceToYears({ years, months, days }: ServicePeriod): number {
  return years + months / 12 + days / 365;
}

/**
 * Money is computed in integer halalas with exact integer arithmetic (no floating-point rounding):
 * service is measured in units of 1/4380 year (a year = 12 months of 365 units or 365 days of 12 units),
 * so every intermediate value is an integer well below Number.MAX_SAFE_INTEGER.
 */
const UNITS_PER_YEAR = 4380;
const UNITS_PER_MONTH = 365; // 1/12 year
const UNITS_PER_DAY = 12; // 1/365 year
const FIVE_YEARS = 5 * UNITS_PER_YEAR;
const AMOUNT_DENOMINATOR = 2 * UNITS_PER_YEAR; // half a month per year => /2

/** Integer division rounding half up (for non-negative integers). */
const divRound = (num: number, den: number) => Math.floor((2 * num + den) / (2 * den));

export function serviceUnits({ years, months, days }: ServicePeriod): number {
  return years * UNITS_PER_YEAR + months * UNITS_PER_MONTH + days * UNITS_PER_DAY;
}

type Fraction = { num: number; den: number; note: string };

function fractionFor(reason: Reason, units: number): Fraction {
  if (reason === 'dismissal_art80') {
    return {
      num: 0,
      den: 1,
      note: 'لا يستحق العامل مكافأة نهاية الخدمة عند فصله لأحد أسباب المادة 80.',
    };
  }
  if (FULL_REWARD.has(reason)) {
    return { num: 1, den: 1, note: 'يستحق العامل المكافأة كاملة في هذه الحالة.' };
  }
  // Resignation: Art. 85.
  if (units < 2 * UNITS_PER_YEAR) {
    return {
      num: 0,
      den: 1,
      note: 'لا يستحق العامل مكافأة عند الاستقالة إذا قلّت مدة خدمته عن سنتين.',
    };
  }
  if (units < 5 * UNITS_PER_YEAR) {
    return {
      num: 1,
      den: 3,
      note: 'عند الاستقالة بعد سنتين وقبل خمس سنوات يستحق العامل ثلث المكافأة.',
    };
  }
  if (units < 10 * UNITS_PER_YEAR) {
    return {
      num: 2,
      den: 3,
      note: 'عند الاستقالة بعد خمس سنوات وقبل عشر سنوات يستحق العامل ثلثي المكافأة.',
    };
  }
  return { num: 1, den: 1, note: 'عند الاستقالة بعد عشر سنوات فأكثر يستحق العامل المكافأة كاملة.' };
}

export function calculateEos(input: EosInput): EosResult {
  const { wage, service, reason } = input;
  if (!Number.isFinite(wage) || wage <= 0)
    throw new EosInputError('الأجر يجب أن يكون رقماً أكبر من صفر.');
  if (wage > 10_000_000) throw new EosInputError('قيمة الأجر غير معقولة.');
  for (const [k, v, max] of [
    ['السنوات', service.years, 70],
    ['الأشهر', service.months, 11],
    ['الأيام', service.days, 30],
  ] as const) {
    if (!Number.isInteger(v) || v < 0 || v > max) {
      throw new EosInputError(
        k === 'السنوات' && v > max
          ? 'مدة الخدمة تتجاوز الحد المعقول (70 سنة). تحقق من التواريخ.'
          : `قيمة ${k} غير صحيحة.`,
      );
    }
  }
  if (!REASONS.includes(reason)) throw new EosInputError('سبب انتهاء العلاقة غير معروف.');

  const units = serviceUnits(service);
  if (units <= 0) throw new EosInputError('مدة الخدمة يجب أن تكون أكبر من صفر.');

  // Wage in halalas (inputs with more than two decimals are rounded to the nearest halala).
  const wageH = Math.round(wage * 100);
  const first = Math.min(units, FIVE_YEARS);
  const after = Math.max(units - FIVE_YEARS, 0);
  const { num, den, note } = fractionFor(reason, units);
  // Everything is derived from the exact (unrounded) amounts so the totals are correct to the halala, and the
  // displayed parts always add up: the first part is rounded, the second is the remainder of the exact full amount.
  const fullH = divRound(wageH * (first + 2 * after), AMOUNT_DENOMINATOR);
  const firstH = Math.min(divRound(wageH * first, AMOUNT_DENOMINATOR), fullH);
  const afterH = fullH - firstH;
  const totalH = divRound(wageH * (first + 2 * after) * num, AMOUNT_DENOMINATOR * den);

  return {
    serviceYears: units / UNITS_PER_YEAR,
    firstFiveAmount: firstH / 100,
    afterFiveAmount: afterH / 100,
    fullAmount: fullH / 100,
    fraction: num / den,
    total: totalH / 100,
    note,
  };
}

export type PeriodOptions = {
  /**
   * Count the end date itself as a day of service (the last working day is worked). Default: false, i.e. the
   * period runs from the start date up to, but not including, the end date.
   */
  inclusiveEnd?: boolean;
};

/** Calendar difference between two ISO dates (YYYY-MM-DD). */
export function periodBetween(
  startIso: string,
  endIso: string,
  options: PeriodOptions = {},
): ServicePeriod {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new EosInputError('تاريخ غير صحيح.');
    if (Number(m[1]) < 1950 || Number(m[1]) > 2100)
      throw new EosInputError('أدخل تاريخاً بين سنتي 1950 و2100.');
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (
      d.getUTCFullYear() !== Number(m[1]) ||
      d.getUTCMonth() !== Number(m[2]) - 1 ||
      d.getUTCDate() !== Number(m[3])
    ) {
      throw new EosInputError('تاريخ غير صحيح.');
    }
    return d;
  };
  const start = parse(startIso);
  let end = parse(endIso);
  if (end < start) throw new EosInputError('تاريخ انتهاء الخدمة يجب أن يكون بعد تاريخ بدايتها.');
  if (options.inclusiveEnd) end = new Date(end.getTime() + 86_400_000);

  // Whole months from start (day clamped to month length), then the remaining days.
  const addMonths = (d: Date, n: number) => {
    const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + n) / 12);
    const m = (((d.getUTCMonth() + n) % 12) + 12) % 12;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
  };
  let totalMonths =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, totalMonths) > end) totalMonths -= 1;
  const anchor = addMonths(start, totalMonths);
  const days = Math.round((end.getTime() - anchor.getTime()) / 86_400_000);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days };
}
