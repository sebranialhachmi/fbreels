// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ children, ...p }: { children: React.ReactNode; href: string }) => (
    <a {...p}>{children}</a>
  ),
}));
vi.mock('next/script', () => ({
  default: (p: { src: string }) => <script data-testid="ext-script" data-src={p.src} />,
}));

async function mount(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { ConsentProvider } = await import('@/components/consent/consent-provider');
  const { ConsentBanner, PreferencesDialog } = await import('@/components/consent/consent-ui');
  const { ThirdPartyScripts } = await import('@/components/consent/third-party-scripts');
  const { CookieSettingsButton } = await import('@/components/consent/cookie-settings-button');
  return render(
    <>
      <ConsentProvider>
        <CookieSettingsButton />
        <ConsentBanner />
        <PreferencesDialog />
        <ThirdPartyScripts />
      </ConsentProvider>
    </>,
  );
}

beforeEach(() => {
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('consent with no optional tracking configured', () => {
  it('shows no banner, loads no third-party script and says only essential storage is used', async () => {
    await mount({});
    expect(
      screen.queryByRole('region', { name: 'تفضيلات ملفات الارتباط' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-script')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'إعدادات ملفات الارتباط' }));
    expect(await screen.findByText(/التخزين الأساسي في المتصفح فقط/)).toBeInTheDocument();
  });
});

describe('consent with analytics and built-in ad consent configured', () => {
  const env = {
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: 'example.com',
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890123456',
  };

  it('loads nothing before a decision, and Reject is as prominent as Accept', async () => {
    await mount(env);
    expect(screen.getByRole('region', { name: 'تفضيلات ملفات الارتباط' })).toBeInTheDocument();
    expect(screen.queryByTestId('ext-script')).not.toBeInTheDocument();
    const reject = screen.getByRole('button', { name: 'رفض الاختياري' });
    const accept = screen.getByRole('button', { name: 'قبول الكل' });
    expect(reject.className).toBe(accept.className); // identical styling: no dark pattern
  });

  it('rejecting keeps scripts off, hides the banner and persists the choice', async () => {
    await mount(env);
    await userEvent.click(screen.getByRole('button', { name: 'رفض الاختياري' }));
    expect(
      screen.queryByRole('region', { name: 'تفضيلات ملفات الارتباط' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-script')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('consent.v1')!)).toMatchObject({
      analytics: false,
      advertising: false,
    });
  });

  it('accepting loads exactly the consented scripts', async () => {
    await mount(env);
    await userEvent.click(screen.getByRole('button', { name: 'قبول الكل' }));
    const srcs = screen.getAllByTestId('ext-script').map((s) => s.getAttribute('data-src'));
    expect(srcs.some((s) => s?.startsWith('https://plausible.io'))).toBe(true);
    expect(
      srcs.some(
        (s) =>
          s?.includes('pagead2.googlesyndication.com') && s.includes('ca-pub-1234567890123456'),
      ),
    ).toBe(true);
  });

  it('manage preferences allows analytics without advertising, and can be reopened from the footer control', async () => {
    await mount(env);
    await userEvent.click(screen.getByRole('button', { name: 'إدارة التفضيلات' }));
    await userEvent.click(await screen.findByRole('switch', { name: 'التحليلات' }));
    await userEvent.click(screen.getByRole('button', { name: 'حفظ التفضيلات' }));
    const srcs = screen.getAllByTestId('ext-script').map((s) => s.getAttribute('data-src'));
    expect(srcs).toHaveLength(1);
    expect(srcs[0]).toContain('plausible.io');
    await userEvent.click(screen.getByRole('button', { name: 'إعدادات ملفات الارتباط' }));
    expect(await screen.findByRole('switch', { name: 'التحليلات' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'الإعلانات' })).not.toBeChecked();
  });

  it('ignores an invalid publisher id (nothing loads, no banner for ads)', async () => {
    await mount({ NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-REPLACE_ME' });
    expect(
      screen.queryByRole('region', { name: 'تفضيلات ملفات الارتباط' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('ext-script')).not.toBeInTheDocument();
  });
});

describe('google-cmp mode', () => {
  it('does not show the built-in advertising banner (a Google-certified CMP owns consent)', async () => {
    await mount({
      NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890123456',
      NEXT_PUBLIC_CONSENT_MODE: 'google-cmp',
    });
    expect(
      screen.queryByRole('region', { name: 'تفضيلات ملفات الارتباط' }),
    ).not.toBeInTheDocument();
  });
});
