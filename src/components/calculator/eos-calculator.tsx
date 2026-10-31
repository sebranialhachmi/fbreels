'use client';

import { Calculator, RotateCcw } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { track } from '@/lib/analytics/track';
import {
  EosInputError,
  REASON_LABELS,
  calculateEos,
  periodBetween,
  type EosResult,
  type Reason,
  type ServicePeriod,
} from '@/lib/calc/eos';
import { formatPeriod, formatSar, parseIntStrict, parseNumber } from '@/lib/calc/parse';

type Mode = 'dates' | 'manual';
type FieldKey = 'basic' | 'allowances' | 'start' | 'end' | 'years' | 'months' | 'days';
type FieldErrors = Partial<Record<FieldKey, string>>;

type Computed = {
  period: ServicePeriod;
  reason: Reason;
  withAllowances: EosResult;
  basicOnly: EosResult;
  includeAllowances: boolean;
  inclusiveEnd: boolean;
  basic: number;
  allowances: number;
};

const FRACTION_TEXT = (f: number) =>
  f === 0 ? 'لا شيء' : f === 1 ? 'كاملة' : f > 0.6 ? 'ثلثان' : 'ثلث';

const inputClass =
  'mt-1.5 h-12 w-full rounded-control border border-border bg-bg px-3 text-base aria-[invalid=true]:border-danger';

/** Default for the "count the end date as a service day" option. Change only after checking the official calculator. */
const DEFAULT_INCLUSIVE_END = false;

export function EosCalculator({
  reasons,
  defaultReason,
}: {
  reasons: readonly Reason[];
  defaultReason: Reason;
}) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [reason, setReason] = useState<Reason>(defaultReason);
  const [mode, setMode] = useState<Mode>('dates');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [years, setYears] = useState('');
  const [months, setMonths] = useState('');
  const [days, setDays] = useState('');
  const [basic, setBasic] = useState('');
  const [allowances, setAllowances] = useState('');
  const [includeAllowances, setIncludeAllowances] = useState(true);
  const [inclusiveEnd, setInclusiveEnd] = useState(DEFAULT_INCLUSIVE_END);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<Computed | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function fail(next: FieldErrors, general?: string) {
    setResult(null);
    setErrors(next);
    setFormError(general ?? null);
    const first = (
      ['start', 'end', 'years', 'months', 'days', 'basic', 'allowances'] as FieldKey[]
    ).find((k) => next[k]);
    if (first) requestAnimationFrame(() => document.getElementById(id(first))?.focus());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: FieldErrors = {};
    const basicN = parseNumber(basic);
    const allowN = allowances.trim() === '' ? 0 : parseNumber(allowances);
    if (!Number.isFinite(basicN) || basicN <= 0)
      found.basic = 'أدخل الأجر الأساسي كرقم أكبر من صفر.';
    if (!Number.isFinite(allowN) || allowN < 0)
      found.allowances = 'قيمة البدلات غير صحيحة. اتركها فارغة إن لم توجد بدلات.';

    let period: ServicePeriod | null = null;
    if (mode === 'dates') {
      if (!start) found.start = 'أدخل تاريخ بداية الخدمة.';
      if (!end) found.end = 'أدخل تاريخ نهاية الخدمة.';
      if (start && end) {
        try {
          period = periodBetween(start, end, { inclusiveEnd });
        } catch (err) {
          found.end = err instanceof EosInputError ? err.message : 'تعذّر قراءة التواريخ.';
        }
      }
    } else {
      const y = parseIntStrict(years);
      const m = parseIntStrict(months);
      const d = parseIntStrict(days);
      if (Number.isNaN(y)) found.years = 'أدخل السنوات كرقم صحيح.';
      if (Number.isNaN(m)) found.months = 'أدخل الأشهر كرقم صحيح.';
      if (Number.isNaN(d)) found.days = 'أدخل الأيام كرقم صحيح.';
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d))
        period = { years: y, months: m, days: d };
    }

    if (Object.keys(found).length === 0 && period) {
      try {
        const withAllowances = calculateEos({ wage: basicN + allowN, service: period, reason });
        const basicOnly = calculateEos({ wage: basicN, service: period, reason });
        setResult({
          period,
          reason,
          withAllowances,
          basicOnly,
          includeAllowances,
          inclusiveEnd: mode === 'dates' && inclusiveEnd,
          basic: basicN,
          allowances: allowN,
        });
        setErrors({});
        setFormError(null);
        track('calculation_done', { reason });
        requestAnimationFrame(() => resultRef.current?.focus());
        return;
      } catch (err) {
        const message = err instanceof EosInputError ? err.message : 'تعذّر إجراء الحساب.';
        // Attribute service-period problems to the period fields, wage problems to the wage field.
        if (/الأجر/.test(message)) found.basic = message;
        else if (mode === 'dates') found.end = message;
        else found.years = message;
      }
    }
    fail(found, 'تحقق من الحقول المحدّدة أدناه.');
  }

  function reset() {
    setStart('');
    setEnd('');
    setYears('');
    setMonths('');
    setDays('');
    setBasic('');
    setAllowances('');
    setInclusiveEnd(DEFAULT_INCLUSIVE_END);
    setResult(null);
    setErrors({});
    setFormError(null);
  }

  /** Accessibility wiring for a field: invalid flag + the id of its inline message. */
  const a11y = (k: FieldKey) => ({
    id: id(k),
    'aria-invalid': errors[k] ? (true as const) : undefined,
    'aria-describedby': errors[k] ? id(`${k}-err`) : undefined,
  });
  const fieldError = (k: FieldKey) =>
    errors[k] ? (
      <p id={id(`${k}-err`)} className="mt-1 text-sm text-danger-text">
        {errors[k]}
      </p>
    ) : null;

  const shown = result
    ? result.includeAllowances
      ? result.withAllowances
      : result.basicOnly
    : null;
  const other = result
    ? result.includeAllowances
      ? result.basicOnly
      : result.withAllowances
    : null;
  const errorKeys = Object.keys(errors) as FieldKey[];

  return (
    <Card className="p-4 sm:p-6">
      <form
        onSubmit={submit}
        noValidate
        aria-label="حاسبة مكافأة نهاية الخدمة"
        className="space-y-5"
      >
        <div>
          <label htmlFor={id('reason')} className="block text-sm font-semibold">
            سبب انتهاء علاقة العمل
          </label>
          <select
            id={id('reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
            className={inputClass}
          >
            {reasons.map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">مدة الخدمة</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={id('mode')}
                checked={mode === 'dates'}
                onChange={() => setMode('dates')}
                className="size-4 accent-[var(--primary)]"
              />
              من تاريخ إلى تاريخ
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={id('mode')}
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
                className="size-4 accent-[var(--primary)]"
              />
              إدخال المدة يدوياً
            </label>
          </div>
          {mode === 'dates' ? (
            <>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={id('start')} className="block text-sm">
                    تاريخ بداية الخدمة
                  </label>
                  <input
                    {...a11y('start')}
                    type="date"
                    dir="ltr"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className={`${inputClass} text-start`}
                  />
                  {fieldError('start')}
                </div>
                <div>
                  <label htmlFor={id('end')} className="block text-sm">
                    تاريخ نهاية الخدمة
                  </label>
                  <input
                    {...a11y('end')}
                    type="date"
                    dir="ltr"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className={`${inputClass} text-start`}
                  />
                  {fieldError('end')}
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={inclusiveEnd}
                  onChange={(e) => setInclusiveEnd(e.target.checked)}
                  className="mt-1 size-4 accent-[var(--primary)]"
                />
                <span>
                  احتساب يوم النهاية ضمن مدة الخدمة (آخر يوم عمل فعلي). قد يغيّر هذا النتيجة عند
                  حدود السنتين والخمس والعشر سنوات، فقارن بالحاسبة الرسمية.
                </span>
              </label>
            </>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(
                [
                  ['سنوات', 'years', years, setYears],
                  ['أشهر', 'months', months, setMonths],
                  ['أيام', 'days', days, setDays],
                ] as const
              ).map(([label, key, value, set]) => (
                <div key={key}>
                  <label htmlFor={id(key)} className="block text-sm">
                    {label}
                  </label>
                  <input
                    {...a11y(key)}
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} text-start`}
                  />
                  {fieldError(key)}
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={id('basic')} className="block text-sm font-semibold">
              الأجر الأساسي الشهري (ريال)
            </label>
            <input
              {...a11y('basic')}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={basic}
              onChange={(e) => setBasic(e.target.value)}
              placeholder="مثال: 6000"
              className={`${inputClass} text-start`}
            />
            {fieldError('basic')}
          </div>
          <div>
            <label htmlFor={id('allowances')} className="block text-sm font-semibold">
              البدلات الثابتة الشهرية (ريال) — اختياري
            </label>
            <input
              {...a11y('allowances')}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={allowances}
              onChange={(e) => setAllowances(e.target.value)}
              placeholder="سكن، مواصلات…"
              className={`${inputClass} text-start`}
            />
            {fieldError('allowances')}
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAllowances}
            onChange={(e) => setIncludeAllowances(e.target.checked)}
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span>
            احتساب البدلات الثابتة ضمن الأجر (الأصل أن يُحسب على آخر أجر، لكن راجع عقدك لأن بعض
            المصادر تقتصر على الأساسي).
          </span>
        </label>

        {errorKeys.length > 0 && (
          <Alert tone="error" title={formError ?? 'تحقق من الحقول'}>
            <ul className="list-disc space-y-1 ps-5">
              {errorKeys.map((k) => (
                <li key={k}>
                  <a
                    href={`#${id(k)}`}
                    className="underline"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id(k))?.focus();
                    }}
                  >
                    {errors[k]}
                  </a>
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg">
            <Calculator aria-hidden className="size-5" />
            احسب المكافأة
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={reset}>
            <RotateCcw aria-hidden className="size-4" />
            إعادة تعيين
          </Button>
        </div>
      </form>

      <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {result && shown && other && (
          <section
            data-testid="eos-result"
            aria-label="نتيجة الحساب"
            className="mt-6 space-y-4 border-t border-border pt-6"
          >
            <div className="rounded-card bg-subtle p-5 text-center">
              <p className="text-sm text-muted">مكافأة نهاية الخدمة المستحقة (تقديرية)</p>
              <p
                className="mt-1 text-3xl font-extrabold tracking-tight text-primary-text"
                data-testid="eos-total"
              >
                {formatSar(shown.total)}
              </p>
              <p className="mt-2 text-sm">{shown.note}</p>
            </div>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="سبب الإنهاء" value={REASON_LABELS[result.reason]} />
              <Row
                label="مدة الخدمة"
                value={
                  formatPeriod(result.period) + (result.inclusiveEnd ? ' (شاملة يوم النهاية)' : '')
                }
              />
              <Row
                label="الأجر المعتمد للحساب"
                value={formatSar(
                  result.includeAllowances ? result.basic + result.allowances : result.basic,
                )}
              />
              <Row
                label="مكافأة أول 5 سنوات (نصف شهر عن كل سنة)"
                value={formatSar(shown.firstFiveAmount)}
              />
              <Row
                label="مكافأة ما زاد على 5 سنوات (شهر عن كل سنة)"
                value={formatSar(shown.afterFiveAmount)}
              />
              <Row label="المكافأة الكاملة قبل النسبة" value={formatSar(shown.fullAmount)} />
              <Row label="النسبة المستحقة" value={FRACTION_TEXT(shown.fraction)} />
            </dl>
            {result.allowances > 0 && (
              <p className="text-sm text-muted">
                {result.includeAllowances
                  ? 'لو اقتصر الحساب على الأجر الأساسي فقط'
                  : 'لو شُملت البدلات الثابتة في الحساب'}
                : <strong className="text-fg">{formatSar(other.total)}</strong>
              </p>
            )}
            <Alert tone="warning">
              هذه النتيجة تقديرية وليست استشارة قانونية. قد يختلف المبلغ الفعلي بحسب عقدك وبنود
              الأجر وسبب الإنهاء. للتحقق الرسمي استخدم حاسبة وزارة الموارد البشرية أو منصة قوى.
            </Alert>
          </section>
        )}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
