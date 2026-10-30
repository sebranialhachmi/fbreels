import { hrefOf, pageById } from '@/lib/pages';

export type NavGroupLink = { label: string; href: string };

const link = (id: string, label: string): NavGroupLink => ({ label, href: hrefOf(pageById(id)) });

export const headerLinks = (): NavGroupLink[] => [
  link('home', 'الحاسبة'),
  link('resignation', 'عند الاستقالة'),
  link('termination', 'إنهاء العقد'),
  link('government', 'القطاع الحكومي'),
  link('articles', 'المقالات'),
];

export const footerGroups = (): { title: string; links: NavGroupLink[] }[] => [
  {
    title: 'الحاسبات',
    links: [
      link('home', 'حاسبة القطاع الخاص'),
      link('resignation', 'عند الاستقالة'),
      link('termination', 'إنهاء العقد وانتهاء مدته'),
      link('teachers', 'للمعلمين'),
    ],
  },
  {
    title: 'قطاعات أخرى',
    links: [
      link('government', 'الموظف الحكومي'),
      link('military', 'العسكريون'),
      link('domestic', 'العمالة المنزلية'),
      link('qiwa', 'حاسبة قوى الرسمية'),
    ],
  },
  {
    title: 'الموقع',
    links: [
      link('articles', 'المقالات'),
      link('about', 'من نحن'),
      link('contact', 'اتصل بنا'),
      link('editorial', 'السياسة التحريرية'),
      link('sitemap', 'خريطة الموقع'),
    ],
  },
  {
    title: 'قانوني',
    links: [
      link('privacy', 'سياسة الخصوصية'),
      link('terms', 'شروط الاستخدام'),
      link('disclaimer', 'إخلاء المسؤولية'),
      link('cookies', 'سياسة ملفات الارتباط'),
      link('accessibility', 'إمكانية الوصول'),
    ],
  },
];
