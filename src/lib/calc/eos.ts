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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function fractionFor(reason: Reason, serviceYears: number): { fraction: number; note: string } {
  if (reason === 'dismissal_art80') {
    return {
      fraction: 0,
      note: 'لا يستحق العامل مكافأة نهاية الخدمة عند فصله لأحد أسباب المادة 80.',
    };
  }
  if (FULL_REWARD.has(reason)) {
    return { fraction: 1, note: 'يستحق العامل المكافأة كاملة في هذه الحالة.' };
  }
  // Resignation: Art. 85.
  if (serviceYears < 2)
    return {
      fraction: 0,
      note: 'لا يستحق العامل مكافأة عند الاستقالة إذا قلّت مدة خدمته عن سنتين.',
    };
  if (serviceYears < 5)
    return {
      fraction: 1 / 3,
      note: 'عند الاستقالة بعد سنتين وقبل خمس سنوات يستحق العامل ثلث المكافأة.',
    };
  if (serviceYears < 10)
    return {
      fraction: 2 / 3,
      note: 'عند الاستقالة بعد خمس سنوات وقبل عشر سنوات يستحق العامل ثلثي المكافأة.',
    };
  return { fraction: 1, note: 'عند الاستقالة بعد عشر سنوات فأكثر يستحق العامل المكافأة كاملة.' };
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
    if (!Number.isInteger(v) || v < 0 || v > max) throw new EosInputError(`قيمة ${k} غير صحيحة.`);
  }
  if (!REASONS.includes(reason)) throw new EosInputError('سبب انتهاء العلاقة غير معروف.');

  const serviceYears = serviceToYears(service);
  if (serviceYears <= 0) throw new EosInputError('مدة الخدمة يجب أن تكون أكبر من صفر.');

  const firstFiveYears = Math.min(serviceYears, 5);
  const afterFiveYears = Math.max(serviceYears - 5, 0);
  const firstFiveAmount = wage * 0.5 * firstFiveYears;
  const afterFiveAmount = wage * 1 * afterFiveYears;
  const fullAmount = firstFiveAmount + afterFiveAmount;
  const { fraction, note } = fractionFor(reason, serviceYears);

  return {
    serviceYears,
    firstFiveAmount: round2(firstFiveAmount),
    afterFiveAmount: round2(afterFiveAmount),
    fullAmount: round2(fullAmount),
    fraction,
    total: round2(fullAmount * fraction),
    note,
  };
}

/** Calendar difference between two ISO dates (YYYY-MM-DD), end exclusive. */
export function periodBetween(startIso: string, endIso: string): ServicePeriod {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) throw new EosInputError('تاريخ غير صحيح.');
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
  const end = parse(endIso);
  if (end < start) throw new EosInputError('تاريخ انتهاء الخدمة يجب أن يكون بعد تاريخ بدايتها.');

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
