import { describe, expect, it, vi } from 'vitest';
import { calculateEos, periodBetween } from '@/lib/calc/eos';
import { allPages, getPage, hrefOf, pageById, pagesOfKind, wordCount } from '@/lib/pages';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

vi.mock('server-only', () => ({}));

const pages = allPages();

describe('page registry', () => {
  it('has unique ids/slugs, a home page and every page linked from the navigation', () => {
    expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length);
    expect(pages.filter((p) => p.slug === '')).toHaveLength(1);
    for (const id of [
      'home',
      'resignation',
      'termination',
      'teachers',
      'government',
      'military',
      'domestic',
      'qiwa',
      'articles',
      'about',
      'contact',
      'editorial',
      'privacy',
      'terms',
      'disclaimer',
      'cookies',
      'accessibility',
      'sitemap',
    ]) {
      expect(() => pageById(id), id).not.toThrow();
    }
  });

  it('uses URL-safe Arabic slugs (letters, digits, hyphens only)', () => {
    for (const p of pages.filter((x) => x.slug)) expect(p.slug, p.id).toMatch(/^[\p{L}\p{N}-]+$/u);
  });

  it.each(pages.map((p) => [p.id]))('%s has complete metadata, one H1 and Arabic content', (id) => {
    const meta = pageById(id);
    const page = getPage(meta.slug)!;
    expect(page.title.length).toBeGreaterThan(20);
    expect(page.title.length).toBeLessThanOrEqual(60); // longer Arabic titles risk truncation in results
    expect(page.description.length).toBeGreaterThan(60);
    expect(page.description.length).toBeLessThanOrEqual(230);
    expect((page.before.match(/<h1/g) ?? []).length + (page.after.match(/<h1/g) ?? []).length).toBe(
      1,
    );
    expect(page.before + page.after).not.toMatch(/__BRAND__|page:|\[\[calculator\]\]|TODO|lorem/i);
    expect(page.before + page.after).toMatch(/[؀-ۿ]/);
  });

  it('has unique titles and descriptions', () => {
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  });

  it('puts the calculator only where intended', () => {
    const withCalc = pages
      .filter((p) => getPage(p.slug)!.hasCalculator)
      .map((p) => p.id)
      .sort();
    expect(withCalc).toEqual(['home', 'resignation', 'teachers', 'termination']);
    for (const p of pagesOfKind('calculator'))
      expect(getPage(p.slug)!.hasCalculator, p.id).toBe(true);
    for (const p of pagesOfKind('sector')) expect(getPage(p.slug)!.hasCalculator, p.id).toBe(false);
  });

  it('resolves every internal link to an existing page and never links to localhost', () => {
    const slugs = new Set(pages.map((p) => hrefOf(p)));
    for (const p of pages) {
      const page = getPage(p.slug)!;
      const html = page.before + page.after;
      for (const [, href] of html.matchAll(/href="(\/[^"]*)"/g)) {
        expect(slugs.has(decodeURIComponent(href!)), `${p.id} -> ${href}`).toBe(true);
      }
      expect(html).not.toMatch(/localhost/);
    }
  });

  it('only links externally to documented official/policy URLs', () => {
    const allowed = new Set([
      'https://www.hrsd.gov.sa/ministry-services/services/end-service-benefit-calculator',
      'https://policies.google.com/technologies/ads',
    ]);
    for (const p of pages) {
      const html = getPage(p.slug)!.before + getPage(p.slug)!.after;
      for (const [, href] of html.matchAll(/href="(https?:[^"]*)"/g))
        expect(allowed.has(href!), `${p.id}: ${href}`).toBe(true);
    }
  });

  it('has substantial articles and a FAQ on the main calculator pages', () => {
    for (const a of pagesOfKind('article'))
      expect(wordCount(a.slug), a.id).toBeGreaterThanOrEqual(420);
    for (const c of pagesOfKind('calculator'))
      expect(wordCount(c.slug), c.id).toBeGreaterThanOrEqual(260);
    for (const id of ['home', 'resignation', 'termination'])
      expect(pageById(id).faq.length, id).toBeGreaterThanOrEqual(4);
  });

  it('does not claim human review or dates it cannot back up', () => {
    for (const p of pages) expect(p.reviewed, p.id).toBeUndefined();
  });

  it('does not assert fabricated statistics, sources or credentials', () => {
    for (const p of pages) {
      const text = (getPage(p.slug)!.before + getPage(p.slug)!.after).replace(/href="[^"]*"/g, '');
      expect(text, p.id).not.toMatch(
        /(دراسة|استطلاع|إحصائية)\s+(أجرتها|تظهر|تُظهر)|خبراء\s+معتمدون|محامون\s+معتمدون/,
      );
    }
  });
});

describe('worked examples in the articles match the calculator', () => {
  const total = (
    wage: number,
    years: number,
    reason: Parameters<typeof calculateEos>[0]['reason'],
    months = 0,
  ) => calculateEos({ wage, service: { years, months, days: 0 }, reason }).total;

  it('how-to-calculate examples', () => {
    expect(total(5000, 3, 'employer_termination')).toBe(7500);
    expect(total(7000, 8, 'employer_termination')).toBe(38500);
    expect(total(7000, 8, 'resignation')).toBe(25666.67);
    expect(total(9000, 6, 'employer_termination', 6)).toBe(36000);
    expect(total(6000, 4, 'resignation')).toBe(4000);
    expect(total(8000, 10, 'resignation')).toBe(60000);
    const text = getPage(pageById('how-to-calculate').slug)!.before;
    for (const n of ['7,500', '38,500', '25,666.67', '36,000', '4,000', '60,000'])
      expect(text).toContain(n);
  });

  it('resignation page examples', () => {
    expect(total(5000, 3, 'resignation')).toBe(2500);
    expect(total(6000, 6, 'resignation')).toBe(14000);
    expect(total(8000, 10, 'resignation')).toBe(60000);
    const text = getPage(pageById('resignation').slug)!.after;
    for (const n of ['2,500', '14,000', '60,000']) expect(text).toContain(n);
  });

  it('termination, teachers and allowances examples', () => {
    expect(total(9000, 6, 'employer_termination', 6)).toBe(36000);
    expect(total(6500, 4, 'contract_end')).toBe(13000);
    expect(total(5000, 4, 'contract_end')).toBe(10000);
    expect(total(6500, 6, 'employer_termination')).toBe(22750);
    expect(total(5000, 6, 'employer_termination')).toBe(17500);
    expect(getPage(pageById('teachers').slug)!.after).toContain('13,000');
    expect(getPage(pageById('allowances').slug)!.before).toContain('22,750');
    expect(getPage(pageById('allowances').slug)!.before).toContain('17,500');
    expect(getPage(pageById('home').slug)!.after).toContain('38,500');
  });
});

describe('extra worked examples added to the pages', () => {
  const calc = (
    wage: number,
    years: number,
    months: number,
    reason: Parameters<typeof calculateEos>[0]['reason'],
    days = 0,
  ) => calculateEos({ wage, service: { years, months, days }, reason });

  it('resignation threshold table (4y11m vs 5y)', () => {
    const a = calc(6000, 4, 11, 'resignation');
    expect(a.fullAmount).toBe(14750);
    expect(a.total).toBe(4916.67);
    const b = calc(6000, 5, 0, 'resignation');
    expect(b.fullAmount).toBe(15000);
    expect(b.total).toBe(10000);
    const text = getPage(pageById('resignation').slug)!.after;
    for (const n of ['14,750.00', '4,916.67', '15,000.00', '10,000.00']) expect(text).toContain(n);
  });

  it('eligibility examples', () => {
    expect(calc(4000, 1, 0, 'employer_termination').total).toBe(2000);
    expect(calc(4000, 1, 11, 'resignation', 0).total).toBe(0);
    expect(calc(4000, 2, 0, 'resignation').total).toBe(1333.33);
    const text = getPage(pageById('eligibility').slug)!.before;
    for (const n of ['2,000', '1,333.33']) expect(text).toContain(n);
  });

  it('termination and teachers examples', () => {
    expect(calc(4500, 3, 0, 'contract_end').total).toBe(6750);
    expect(calc(7000, 3, 0, 'contract_end').total).toBe(10500);
    expect(getPage(pageById('termination').slug)!.after).toContain('6,750');
    expect(getPage(pageById('teachers').slug)!.after).toContain('10,500');
  });

  it('how-to date example and the per-1,000 reference table', () => {
    const p = periodBetween('2020-01-15', '2023-04-20');
    expect(p).toEqual({ years: 3, months: 3, days: 5 });
    expect(calculateEos({ wage: 6000, service: p, reason: 'employer_termination' }).total).toBe(
      9791.1,
    );
    const text = getPage(pageById('how-to-calculate').slug)!.before;
    expect(text).toContain('9,791.10');
    const table: [number, number][] = [
      [1, 500],
      [3, 1500],
      [5, 2500],
      [6, 3500],
      [8, 5500],
      [10, 7500],
    ];
    for (const [years, expected] of table) {
      expect(calc(1000, years, 0, 'employer_termination').total, `${years}y`).toBe(expected);
      expect(text).toContain(expected.toLocaleString('en-US'));
    }
    expect(calc(6000, 6, 0, 'employer_termination').total).toBe(21000);
  });
});

describe('sector pages do not invent formulas', () => {
  it('government, military and domestic pages contain no calculation figures or percentages', () => {
    for (const id of ['government', 'military', 'domestic']) {
      const p = getPage(pageById(id).slug)!;
      const text = (p.before + p.after).replace(/href="[^"]*"/g, '') + JSON.stringify(p.faq);
      expect(text, id).not.toMatch(/\d+\s?%|٪|\d+\s*(أشهر|شهر)|نصف شهر عن كل/);
    }
  });
});

describe('sitemap and robots', () => {
  it('lists every page once with absolute URLs and no API paths', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls).toHaveLength(pages.length);
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) {
      expect(u).toMatch(/^https?:\/\//);
      expect(u).not.toContain('/api/');
    }
  });
  it('robots allows content and blocks only the API', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rules.allow).toBe('/');
    expect(rules.disallow).toEqual(['/api/']);
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe('ads.txt route', () => {
  it('returns 404 without a valid publisher id and a correct line with one', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', '');
    expect((await (await import('@/app/ads.txt/route')).GET()).status).toBe(404);
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', 'ca-pub-REPLACE_ME');
    expect((await (await import('@/app/ads.txt/route')).GET()).status).toBe(404);
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_PUBLISHER_ID', 'ca-pub-1234567890123456');
    const res = await (await import('@/app/ads.txt/route')).GET();
    expect(await res.text()).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
    vi.unstubAllEnvs();
  });
});
