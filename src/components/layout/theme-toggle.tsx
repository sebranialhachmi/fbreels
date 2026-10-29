'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable: preference simply isn't persisted */
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t('toggle')}
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      title={t('toggle')}
    >
      <Sun aria-hidden className="size-5 hidden dark:block" />
      <Moon aria-hidden className="size-5 dark:hidden" />
    </Button>
  );
}
