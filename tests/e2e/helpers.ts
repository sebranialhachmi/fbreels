import { expect, type Page } from '@playwright/test';

export const PAGES: Record<string, string> = {
  home: '/',
  resignation: '/مكافأة-نهاية-الخدمة-عند-الاستقالة',
  termination: '/مكافأة-نهاية-الخدمة-عند-إنهاء-العقد',
  teachers: '/مكافأة-نهاية-الخدمة-للمعلمين',
  government: '/مكافأة-نهاية-الخدمة-للموظف-الحكومي',
  military: '/مكافأة-نهاية-الخدمة-للعسكريين',
  domestic: '/مكافأة-نهاية-الخدمة-للعمالة-المنزلية',
  qiwa: '/حاسبة-نهاية-الخدمة-قوى-ووزارة-الموارد-البشرية',
  articles: '/المقالات',
  howTo: '/كيف-تحسب-مكافأة-نهاية-الخدمة',
  eligibility: '/متى-تستحق-مكافأة-نهاية-الخدمة',
  allowances: '/هل-تدخل-البدلات-في-مكافأة-نهاية-الخدمة',
  about: '/من-نحن',
  contact: '/اتصل-بنا',
  editorial: '/السياسة-التحريرية',
  accessibility: '/إمكانية-الوصول',
  privacy: '/سياسة-الخصوصية',
  terms: '/شروط-الاستخدام',
  disclaimer: '/إخلاء-المسؤولية',
  cookies: '/سياسة-ملفات-الارتباط',
  sitemap: '/خريطة-الموقع',
};

export const CALCULATOR_PAGES = ['home', 'resignation', 'termination', 'teachers'];

export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return { errors, expectNone: () => expect(errors, errors.join('\n')).toEqual([]) };
}

/** App alerts only: excludes Next.js's own route announcer, which also has role=alert. */
export const alertBox = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');

export const LEAK =
  /MISSING_MESSAGE|__BRAND__|\{\{|\[\[calculator\]\]|undefined|\[object Object\]|NaN/;
