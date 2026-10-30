const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EASTERN = '۰۱۲۳۴۵۶۷۸۹';

/** Parses user-typed numbers, accepting Arabic-Indic digits, Arabic separators and thousands commas. */
export function parseNumber(input: string): number {
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(EASTERN.indexOf(d)))
    .replace(/[,،٬\s]/g, '')
    .replace(/٫/g, '.');
  if (normalized === '' || !/^\d*\.?\d+$/.test(normalized)) return NaN;
  return Number(normalized);
}

export function parseIntStrict(input: string): number {
  const n = parseNumber(input === '' ? '0' : input);
  return Number.isInteger(n) ? n : NaN;
}

export function formatSar(n: number): string {
  return `${new Intl.NumberFormat('ar-SA-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ريال`;
}

export function formatPeriod(p: { years: number; months: number; days: number }): string {
  const parts: string[] = [];
  if (p.years) parts.push(p.years === 1 ? 'سنة' : p.years === 2 ? 'سنتان' : `${p.years} ${p.years <= 10 ? 'سنوات' : 'سنة'}`);
  if (p.months) parts.push(p.months === 1 ? 'شهر' : p.months === 2 ? 'شهران' : `${p.months} ${p.months <= 10 ? 'أشهر' : 'شهراً'}`);
  if (p.days) parts.push(p.days === 1 ? 'يوم' : p.days === 2 ? 'يومان' : `${p.days} ${p.days <= 10 ? 'أيام' : 'يوماً'}`);
  return parts.length ? parts.join(' و') : 'أقل من يوم';
}
