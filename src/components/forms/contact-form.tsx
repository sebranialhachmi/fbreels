'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { track } from '@/lib/analytics/track';
import { INQUIRY_TYPES, contactSchema, type InquiryType } from '@/lib/contact';

type Field = 'name' | 'email' | 'message';
type Status =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'success' } | { kind: 'error'; message: string };

const TYPE_LABELS: Record<InquiryType, string> = {
  general: 'سؤال عام',
  support: 'مساعدة في استخدام الحاسبة',
  copyright: 'حقوق النشر أو طلب إزالة',
  privacy: 'طلب يتعلق بالخصوصية',
  partnership: 'شراكة أو إعلانات',
  bug: 'الإبلاغ عن خطأ في الحساب أو الموقع',
};

const fieldClass =
  'mt-1.5 w-full rounded-control border border-border bg-bg px-3 py-2.5 text-base aria-[invalid=true]:border-danger';

export function ContactForm() {
  const uid = useId();
  const startedAt = useRef(0);
  const summary = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [errors, setErrors] = useState<Partial<Record<Field, true>>>({});

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === 'sending') return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      type: String(data.get('type') ?? 'general'),
      message: String(data.get('message') ?? ''),
      website: String(data.get('website') ?? ''),
      startedAt: startedAt.current,
    };
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Partial<Record<Field, true>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'name' || key === 'email' || key === 'message') next[key] = true;
      }
      setErrors(next);
      setStatus({ kind: 'error', message: 'يرجى تصحيح الحقول المحدّدة.' });
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setErrors({});
    setStatus({ kind: 'sending' });
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: { code?: string };
      } | null;
      if (res.ok && body?.success) {
        form.reset();
        startedAt.current = Date.now();
        setStatus({ kind: 'success' });
        track('contact_submitted');
        return;
      }
      const code = body?.error?.code;
      setStatus({
        kind: 'error',
        message:
          code === 'RATE_LIMITED'
            ? 'أرسلت عدة رسائل مؤخراً. يرجى المحاولة لاحقاً.'
            : code === 'SERVER_CONFIGURATION_ERROR' || code === 'PROVIDER_UNAVAILABLE'
              ? 'نموذج الاتصال غير متاح حالياً. يرجى المحاولة لاحقاً.'
              : 'تعذّر إرسال رسالتك. يرجى المحاولة مرة أخرى.',
      });
    } catch {
      setStatus({ kind: 'error', message: 'تعذّر إرسال رسالتك. يرجى المحاولة مرة أخرى.' });
    }
    requestAnimationFrame(() => summary.current?.focus());
  }

  const err = (f: Field) => (errors[f] ? `${uid}-${f}-err` : undefined);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      aria-busy={status.kind === 'sending'}
    >
      <div ref={summary} tabIndex={-1} className="outline-none">
        {status.kind === 'success' && <Alert tone="success">شكراً لك. تم إرسال رسالتك.</Alert>}
        {status.kind === 'error' && <Alert tone="error">{status.message}</Alert>}
      </div>

      <div>
        <label htmlFor={`${uid}-name`} className="block text-sm font-semibold">
          الاسم
        </label>
        <input
          id={`${uid}-name`}
          name="name"
          autoComplete="name"
          maxLength={100}
          aria-invalid={errors.name || undefined}
          aria-describedby={err('name')}
          className={fieldClass}
        />
        {errors.name && (
          <p id={err('name')} className="mt-1 text-sm text-danger-text">
            أدخل اسمك (حرفان على الأقل).
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${uid}-email`} className="block text-sm font-semibold">
          البريد الإلكتروني
        </label>
        <input
          id={`${uid}-email`}
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          maxLength={254}
          aria-invalid={errors.email || undefined}
          aria-describedby={err('email')}
          className={`${fieldClass} text-start`}
        />
        {errors.email && (
          <p id={err('email')} className="mt-1 text-sm text-danger-text">
            أدخل بريداً إلكترونياً صالحاً.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${uid}-type`} className="block text-sm font-semibold">
          موضوع الرسالة
        </label>
        <select id={`${uid}-type`} name="type" defaultValue="general" className={fieldClass}>
          {INQUIRY_TYPES.map((k) => (
            <option key={k} value={k}>
              {TYPE_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${uid}-message`} className="block text-sm font-semibold">
          الرسالة
        </label>
        <textarea
          id={`${uid}-message`}
          name="message"
          rows={6}
          maxLength={4000}
          aria-invalid={errors.message || undefined}
          aria-describedby={err('message')}
          className={fieldClass}
        />
        {errors.message && (
          <p id={err('message')} className="mt-1 text-sm text-danger-text">
            اكتب رسالة لا تقل عن 10 أحرف.
          </p>
        )}
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <p className="text-xs text-muted">
        لا ترسل كلمات مرور أو بيانات حساسة. نقرأ كل الرسائل لكننا لا نعد بموعد محدد للرد.
      </p>
      <Button type="submit" size="lg" disabled={status.kind === 'sending'}>
        {status.kind === 'sending' && <Spinner />}
        {status.kind === 'sending' ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
      </Button>
    </form>
  );
}
