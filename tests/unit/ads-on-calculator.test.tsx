// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentPath = '/';
vi.mock('next/navigation', () => ({ usePathname: () => currentPath }));
vi.mock('next/script', () => ({
  default: (p: { src: string }) => <script data-testid="ext-script" data-src={p.src} />,
}));
vi.mock('next/link', () => ({
  default: ({ children, ...p }: { children: React.ReactNode; href: string }) => (
    <a {...p}>{children}</a>
  ),
}));

const ADS = { NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: 'ca-pub-1234567890123456' };
const CALC = '/مكافأة-نهاية-الخدمة-عند-الاستقالة';

async function mount(env: Record<string, string>, path: string) {
  vi.resetModules();
  localStorage.clear();
  currentPath = path;
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const { ConsentProvider } = await import('@/components/consent/consent-provider');
  const { ConsentBanner } = await import('@/components/consent/consent-ui');
  const { ThirdPartyScripts } = await import('@/components/consent/third-party-scripts');
  render(
    <ConsentProvider>
      <ConsentBanner policyHref="/cookies" />
      <ThirdPartyScripts calculatorPaths={['/', CALC]} />
    </ConsentProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'قبول الكل' }));
}

const adScripts = () =>
  screen
    .queryAllByTestId('ext-script')
    .filter((s) => s.getAttribute('data-src')?.includes('googlesyndication'));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('advertising script is kept off calculator pages by default', () => {
  it('does not load on the home page or an encoded calculator URL, even after consent', async () => {
    await mount(ADS, '/');
    expect(adScripts()).toHaveLength(0);
    cleanup();
    await mount(ADS, '/' + encodeURIComponent(CALC.slice(1)));
    expect(adScripts()).toHaveLength(0);
  });

  it('loads on non-calculator pages after consent', async () => {
    await mount(ADS, '/' + encodeURIComponent('كيف-تحسب-مكافأة-نهاية-الخدمة'));
    expect(adScripts()).toHaveLength(1);
  });

  it('can be enabled on calculator pages explicitly', async () => {
    await mount({ ...ADS, NEXT_PUBLIC_ADS_ON_CALCULATOR_PAGES: 'true' }, '/');
    expect(adScripts()).toHaveLength(1);
  });
});
