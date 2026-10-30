'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  advertisingNeedsBuiltinConsent,
  analyticsEnabled,
  hasOptionalTracking,
} from '@/lib/consent/config';
import { useConsent } from './consent-provider';

const POLICY_HREF = '/سياسة-ملفات-الارتباط';

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-control border border-border p-4">
      <div>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        <p id={`${id}-desc`} className="mt-1 text-sm text-muted">
          {description}
        </p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-describedby={`${id}-desc`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
      />
    </div>
  );
}

export function PreferencesDialog() {
  const { consent, save, preferencesOpen, closePreferences } = useConsent();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (preferencesOpen && !d.open) {
      setAnalytics(consent.analytics);
      setAdvertising(consent.advertising);
      d.showModal();
    } else if (!preferencesOpen && d.open) d.close();
  }, [preferencesOpen, consent.analytics, consent.advertising]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-title`}
      onClose={closePreferences}
      onCancel={closePreferences}
      className="m-auto w-[min(92vw,34rem)] rounded-card border border-border bg-card p-0 text-fg shadow-pop backdrop:bg-black/50"
    >
      <div className="space-y-4 p-6">
        <h2 id={`${uid}-title`} className="text-xl font-bold">
          تفضيلات ملفات الارتباط والتخزين
        </h2>
        <p className="text-sm text-muted">
          {hasOptionalTracking
            ? 'اختر الفئات الاختيارية التي تسمح بها. يمكنك تغيير ذلك في أي وقت من أسفل الصفحة.'
            : 'يستخدم هذا الموقع حالياً التخزين الأساسي في المتصفح فقط. لا توجد تقنيات تحليل أو إعلان مفعّلة.'}
        </p>
        <div className="rounded-control border border-border bg-subtle p-4">
          <p className="font-semibold">أساسي</p>
          <p className="mt-1 text-sm text-muted">
            يحفظ في متصفحك المظهر (فاتح/داكن) واختيارك بشأن ملفات الارتباط. يعمل دائماً ولا يتتبعك
            عبر المواقع.
          </p>
        </div>
        {analyticsEnabled && (
          <Toggle
            id={`${uid}-an`}
            label="التحليلات"
            description="إحصاءات استخدام مجهولة ومجمّعة تساعدنا على تحسين الموقع."
            checked={analytics}
            onChange={setAnalytics}
          />
        )}
        {advertisingNeedsBuiltinConsent && (
          <Toggle
            id={`${uid}-ad`}
            label="الإعلانات"
            description="تسمح لـ Google AdSense بالتحميل وعرض الإعلانات، وقد تستخدم ملفات ارتباط أو تقنيات مشابهة."
            checked={advertising}
            onChange={setAdvertising}
          />
        )}
        <p className="text-sm">
          <Link
            href={POLICY_HREF}
            className="text-primary-text underline"
            onClick={closePreferences}
          >
            سياسة ملفات الارتباط
          </Link>
        </p>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={closePreferences}>
            إغلاق
          </Button>
          {hasOptionalTracking && (
            <>
              <Button
                variant="outline"
                onClick={() => save({ analytics: false, advertising: false })}
              >
                رفض الاختياري
              </Button>
              <Button
                onClick={() =>
                  save({
                    analytics: analyticsEnabled && analytics,
                    advertising: advertisingNeedsBuiltinConsent && advertising,
                  })
                }
              >
                حفظ التفضيلات
              </Button>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}

export function ConsentBanner() {
  const { consent, save, openPreferences } = useConsent();
  if (!hasOptionalTracking || consent.decided) return null;
  return (
    <section
      aria-label="تفضيلات ملفات الارتباط"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-card border border-border bg-card p-4 shadow-pop sm:p-5"
    >
      <p className="text-sm leading-relaxed">
        لا نستخدم ملفات الارتباط والتقنيات المشابهة الاختيارية لأغراض التحليلات والإعلانات إلا إذا
        سمحت بذلك. التخزين الأساسي (المظهر واختيارك هنا) يعمل دائماً.{' '}
        <Link href={POLICY_HREF} className="text-primary-text underline">
          سياسة ملفات الارتباط
        </Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Accept and reject carry equal visual weight. */}
        <Button variant="outline" onClick={() => save({ analytics: false, advertising: false })}>
          رفض الاختياري
        </Button>
        <Button variant="outline" onClick={openPreferences}>
          إدارة التفضيلات
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            save({ analytics: analyticsEnabled, advertising: advertisingNeedsBuiltinConsent })
          }
        >
          قبول الكل
        </Button>
      </div>
    </section>
  );
}
