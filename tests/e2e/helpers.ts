import { expect, type Page } from '@playwright/test';

export const LOCALES = ['en', 'fr', 'es', 'ar'] as const;
export type Loc = (typeof LOCALES)[number];

export const PATHS: Record<string, Record<Loc, string>> = {
  home: { en: '/en', fr: '/fr', es: '/es', ar: '/ar' },
  tool: {
    en: '/en/facebook-reels-downloader',
    fr: '/fr/telecharger-reels-facebook',
    es: '/es/descargar-reels-facebook',
    ar: '/ar/تحميل-ريلز-فيسبوك',
  },
  howTo: {
    en: '/en/how-to-download',
    fr: '/fr/comment-telecharger',
    es: '/es/como-descargar',
    ar: '/ar/كيفية-التحميل',
  },
  faq: { en: '/en/faq', fr: '/fr/faq', es: '/es/preguntas-frecuentes', ar: '/ar/الأسئلة-الشائعة' },
  about: { en: '/en/about', fr: '/fr/a-propos', es: '/es/acerca-de', ar: '/ar/من-نحن' },
  contact: { en: '/en/contact', fr: '/fr/contact', es: '/es/contacto', ar: '/ar/اتصل-بنا' },
  blog: { en: '/en/blog', fr: '/fr/blog', es: '/es/blog', ar: '/ar/المدونة' },
  privacy: {
    en: '/en/privacy-policy',
    fr: '/fr/politique-de-confidentialite',
    es: '/es/politica-de-privacidad',
    ar: '/ar/سياسة-الخصوصية',
  },
  terms: {
    en: '/en/terms-of-service',
    fr: '/fr/conditions-d-utilisation',
    es: '/es/terminos-de-servicio',
    ar: '/ar/شروط-الخدمة',
  },
  copyright: {
    en: '/en/copyright-and-takedown',
    fr: '/fr/droits-d-auteur-et-retrait',
    es: '/es/derechos-de-autor-y-retirada',
    ar: '/ar/حقوق-النشر-والإزالة',
  },
  disclaimer: {
    en: '/en/disclaimer',
    fr: '/fr/avertissement',
    es: '/es/aviso-legal',
    ar: '/ar/إخلاء-المسؤولية',
  },
  cookies: {
    en: '/en/cookie-policy',
    fr: '/fr/politique-de-cookies',
    es: '/es/politica-de-cookies',
    ar: '/ar/سياسة-ملفات-الارتباط',
  },
  accessibility: {
    en: '/en/accessibility',
    fr: '/fr/accessibilite',
    es: '/es/accesibilidad',
    ar: '/ar/إمكانية-الوصول',
  },
  editorial: {
    en: '/en/editorial-policy',
    fr: '/fr/politique-editoriale',
    es: '/es/politica-editorial',
    ar: '/ar/السياسة-التحريرية',
  },
  sitemap: {
    en: '/en/sitemap',
    fr: '/fr/plan-du-site',
    es: '/es/mapa-del-sitio',
    ar: '/ar/خريطة-الموقع',
  },
};

export const ARTICLES: Record<Loc, string[]> = {
  en: [
    'how-to-save-facebook-reels-on-iphone',
    'download-facebook-videos-in-hd',
    'why-facebook-reel-download-fails',
    'save-audio-from-facebook-video',
    'facebook-videos-copyright-privacy-responsible-use',
  ],
  fr: [
    'comment-enregistrer-reels-facebook-iphone',
    'telecharger-videos-facebook-en-hd',
    'pourquoi-telechargement-reel-facebook-echoue',
    'enregistrer-audio-video-facebook',
    'droit-auteur-vie-privee-usage-responsable-videos-facebook',
  ],
  es: [
    'como-guardar-reels-de-facebook-en-iphone',
    'descargar-videos-de-facebook-en-hd',
    'por-que-falla-la-descarga-de-un-reel-de-facebook',
    'guardar-audio-de-un-video-de-facebook',
    'derechos-de-autor-privacidad-uso-responsable-videos-facebook',
  ],
  ar: [
    'كيفية-حفظ-ريلز-فيسبوك-على-آيفون',
    'تحميل-فيديوهات-فيسبوك-بجودة-عالية',
    'لماذا-يفشل-تحميل-ريلز-فيسبوك',
    'حفظ-الصوت-من-فيديو-فيسبوك',
    'حقوق-النشر-والخصوصية-والاستخدام-المسؤول-لفيديوهات-فيسبوك',
  ],
};

export const blogPath = (l: Loc, slug: string) => `${PATHS.blog![l]}/${slug}`;

/** Collects console errors / uncaught exceptions for the duration of a test. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return {
    errors,
    expectNone: () => expect(errors, errors.join('\n')).toEqual([]),
  };
}

/** Heuristics for untranslated keys / leaked tokens in visible text. */
export const LEAK_PATTERN =
  /MISSING_MESSAGE|__BRAND__|\{\{|\b(?:nav|downloader|home|footer|common|consent|contact|meta|blog)\.[a-zA-Z]+(?:\.[a-zA-Z]+)*\b(?=\s|$)|undefined|\[object Object\]/;

/** App alerts only: excludes Next.js's own route announcer, which also has role=alert. */
export const alertBox = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)');
