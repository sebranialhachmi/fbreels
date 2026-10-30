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

type Computed = {
  period: ServicePeriod;
  reason: Reason;
  withAllowances: EosResult;
  basicOnly: EosResult;
  includeAllowances: boolean;
  basic: number;
  allowances: number;
};

const FRACTION_TEXT = (f: number) =>
  f === 0 ? 'لا شيء' : f === 1 ? 'كاملة' : f > 0.6 ? 'ثلثان' : 'ثلث';

const inputClass =
  'mt-1.5 h-12 w-full rounded-control border border-border bg-bg px-3 text-base aria-[invalid=true]:border-danger';

export function EosCalculator({
  reasons,
  defaultReason,
}: {
  reasons: readonly Reason[];
  defaultReason: Reason;
}) {
  const uid = useId();
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
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<Computed | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    const basicN = parseNumber(basic);
    const allowN = allowances.trim() === '' ? 0 : parseNumber(allowances);
    if (!Number.isFinite(basicN) || basicN <= 0)
      problems.push('أدخل الأجر الأساسي كرقم أكبر من صفر.');
    if (!Number.isFinite(allowN) || allowN < 0) problems.push('قيمة البدلات غير صحيحة.');

    let period: ServicePeriod | null = null;
    try {
      if (mode === 'dates') {
        if (!start || !end) throw new EosInputError('أدخل تاريخ بداية الخدمة وتاريخ نهايتها.');
        period = periodBetween(start, end);
      } else {
        const y = parseIntStrict(years);
        const m = parseIntStrict(months);
        const d = parseIntStrict(days);
        if ([y, m, d].some((n) => Number.isNaN(n)))
          throw new EosInputError('أدخل السنوات والأشهر والأيام كأرقام صحيحة.');
        period = { years: y, months: m, days: d };
      }
    } catch (err) {
      problems.push(err instanceof EosInputError ? err.message : 'تعذّر قراءة مدة الخدمة.');
    }

    if (problems.length === 0 && period) {
      try {
        const withAllowances = calculateEos({ wage: basicN + allowN, service: period, reason });
        const basicOnly = calculateEos({ wage: basicN, service: period, reason });
        setResult({
          period,
          reason,
          withAllowances,
          basicOnly,
          includeAllowances,
          basic: basicN,
          allowances: allowN,
        });
        setErrors([]);
        track('calculation_done', { reason });
        requestAnimationFrame(() => resultRef.current?.focus());
        return;
      } catch (err) {
        problems.push(err instanceof EosInputError ? err.message : 'تعذّر إجراء الحساب.');
      }
    }
    setResult(null);
    setErrors(problems);
  }

  function reset() {
    setStart('');
    setEnd('');
    setYears('');
    setMonths('');
    setDays('');
    setBasic('');
    setAllowances('');
    setResult(null);
    setErrors([]);
  }

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

  return (
    <Card className="p-4 sm:p-6">
      <form
        onSubmit={submit}
        noValidate
        aria-label="حاسبة مكافأة نهاية الخدمة"
        className="space-y-5"
      >
        <div>
          <label htmlFor={`${uid}-reason`} className="block text-sm font-semibold">
            سبب انتهاء علاقة العمل
          </label>
          <select
            id={`${uid}-reason`}
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
                name={`${uid}-mode`}
                checked={mode === 'dates'}
                onChange={() => setMode('dates')}
                className="size-4 accent-[var(--primary)]"
              />
              من تاريخ إلى تاريخ
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name={`${uid}-mode`}
                checked={mode === 'manual'}
                onChange={() => setMode('manual')}
                className="size-4 accent-[var(--primary)]"
              />
              إدخال المدة يدوياً
            </label>
          </div>
          {mode === 'dates' ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-start`} className="block text-sm">
                  تاريخ بداية الخدمة
                </label>
                <input
                  id={`${uid}-start`}
                  type="date"
                  dir="ltr"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={`${inputClass} text-start`}
                />
              </div>
              <div>
                <label htmlFor={`${uid}-end`} className="block text-sm">
                  تاريخ نهاية الخدمة
                </label>
                <input
                  id={`${uid}-end`}
                  type="date"
                  dir="ltr"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={`${inputClass} text-start`}
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-3">
              {(
                [
                  ['سنوات', years, setYears],
                  ['أشهر', months, setMonths],
                  ['أيام', days, setDays],
                ] as const
              ).map(([label, value, set]) => (
                <div key={label}>
                  <label htmlFor={`${uid}-${label}`} className="block text-sm">
                    {label}
                  </label>
                  <input
                    id={`${uid}-${label}`}
                    inputMode="numeric"
                    dir="ltr"
                    autoComplete="off"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="0"
                    className={`${inputClass} text-start`}
                  />
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-basic`} className="block text-sm font-semibold">
              الأجر الأساسي الشهري (ريال)
            </label>
            <input
              id={`${uid}-basic`}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={basic}
              onChange={(e) => setBasic(e.target.value)}
              placeholder="مثال: 6000"
              className={`${inputClass} text-start`}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-allow`} className="block text-sm font-semibold">
              البدلات الثابتة الشهرية (ريال) — اختياري
            </label>
            <input
              id={`${uid}-allow`}
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              value={allowances}
              onChange={(e) => setAllowances(e.target.value)}
              placeholder="سكن، مواصلات…"
              className={`${inputClass} text-start`}
            />
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

        {errors.length > 0 && (
          <Alert tone="error" title="تحقق من البيانات">
            <ul className="list-disc space-y-1 ps-5">
              {errors.map((m) => (
                <li key={m}>{m}</li>
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
              <Row label="مدة الخدمة" value={formatPeriod(result.period)} />
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
