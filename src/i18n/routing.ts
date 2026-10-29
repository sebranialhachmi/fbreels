import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'fr', 'es', 'ar'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const rtlLocales: readonly Locale[] = ['ar'];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  ar: 'العربية',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return rtlLocales.includes(locale) ? 'rtl' : 'ltr';
}

/**
 * Internal route keys -> localized public paths. Every page exists in every language,
 * so hreflang alternates are always genuine.
 */
export const pathnames = {
  '/': '/',
  '/facebook-reels-downloader': {
    en: '/facebook-reels-downloader',
    fr: '/telecharger-reels-facebook',
    es: '/descargar-reels-facebook',
    ar: '/تحميل-ريلز-فيسبوك',
  },
  '/how-to-download': {
    en: '/how-to-download',
    fr: '/comment-telecharger',
    es: '/como-descargar',
    ar: '/كيفية-التحميل',
  },
  '/faq': {
    en: '/faq',
    fr: '/faq',
    es: '/preguntas-frecuentes',
    ar: '/الأسئلة-الشائعة',
  },
  '/about': { en: '/about', fr: '/a-propos', es: '/acerca-de', ar: '/من-نحن' },
  '/contact': { en: '/contact', fr: '/contact', es: '/contacto', ar: '/اتصل-بنا' },
  '/blog': { en: '/blog', fr: '/blog', es: '/blog', ar: '/المدونة' },
  '/blog/[slug]': {
    en: '/blog/[slug]',
    fr: '/blog/[slug]',
    es: '/blog/[slug]',
    ar: '/المدونة/[slug]',
  },
  '/privacy-policy': {
    en: '/privacy-policy',
    fr: '/politique-de-confidentialite',
    es: '/politica-de-privacidad',
    ar: '/سياسة-الخصوصية',
  },
  '/terms': {
    en: '/terms-of-service',
    fr: '/conditions-d-utilisation',
    es: '/terminos-de-servicio',
    ar: '/شروط-الخدمة',
  },
  '/copyright': {
    en: '/copyright-and-takedown',
    fr: '/droits-d-auteur-et-retrait',
    es: '/derechos-de-autor-y-retirada',
    ar: '/حقوق-النشر-والإزالة',
  },
  '/disclaimer': {
    en: '/disclaimer',
    fr: '/avertissement',
    es: '/aviso-legal',
    ar: '/إخلاء-المسؤولية',
  },
  '/cookie-policy': {
    en: '/cookie-policy',
    fr: '/politique-de-cookies',
    es: '/politica-de-cookies',
    ar: '/سياسة-ملفات-الارتباط',
  },
  '/accessibility': {
    en: '/accessibility',
    fr: '/accessibilite',
    es: '/accesibilidad',
    ar: '/إمكانية-الوصول',
  },
  '/editorial-policy': {
    en: '/editorial-policy',
    fr: '/politique-editoriale',
    es: '/politica-editorial',
    ar: '/السياسة-التحريرية',
  },
  '/site-map': {
    en: '/sitemap',
    fr: '/plan-du-site',
    es: '/mapa-del-sitio',
    ar: '/خريطة-الموقع',
  },
} as const;

export type AppPathname = keyof typeof pathnames;

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  // Written only when the visited language differs from the browser's preferred one (i.e. an explicit choice).
  localeCookie: { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
  pathnames,
});
