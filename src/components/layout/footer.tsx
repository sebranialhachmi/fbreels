import Link from 'next/link';
import { CookieSettingsButton } from '@/components/consent/cookie-settings-button';
import { Logo } from '@/components/ui/logo';
import { brand } from '@/config/brand';
import { footerGroups } from './nav';

export function Footer() {
  const groups = footerGroups();
  return (
    <footer className="mt-24 border-t border-border bg-card">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted">
              {brand.tagline}. نتائج تقديرية وليست استشارة قانونية.
            </p>
          </div>
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="text-sm font-semibold">{g.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-fg hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {g.title === 'قانوني' && (
                  <li>
                    <CookieSettingsButton />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 space-y-2 border-t border-border pt-6 text-xs leading-relaxed text-muted">
          <p>
            هذا موقع مستقل وغير تابع لأي جهة حكومية، ولا يمثل وزارة الموارد البشرية والتنمية
            الاجتماعية أو منصة قوى أو المؤسسة العامة للتقاعد أو التأمينات الاجتماعية.
          </p>
          <p>
            © {new Date().getFullYear()} {brand.name}. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>
  );
}
