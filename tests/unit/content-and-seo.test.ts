import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { locales, pathnames } from '@/i18n/routing';
import {
  PAGE_FILES,
  getArticle,
  getArticleSlugMap,
  getArticles,
  getPage,
  type PageName,
} from '@/lib/content';
import { absoluteUrl, languageAlternates } from '@/lib/seo/urls';
import sitemap from '@/app/sitemap';
import robots from '@/app/robots';

const root = process.cwd();
const messages = Object.fromEntries(
  locales.map((l) => [
    l,
    JSON.parse(fs.readFileSync(path.join(root, 'messages', `${l}.json`), 'utf8')),
  ]),
);

function flat(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (typeof obj === 'string') out[prefix] = obj;
  else if (Array.isArray(obj)) obj.forEach((v, i) => flat(v, `${prefix}[${i}]`, out));
  else if (obj && typeof obj === 'object')
    for (const [k, v] of Object.entries(obj)) flat(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

describe('message catalogs', () => {
  it('have an identical key structure in every language', () => {
    const base = Object.keys(flat(messages.en)).sort();
    for (const l of locales) expect(Object.keys(flat(messages[l])).sort(), l).toEqual(base);
  });

  it('contain no empty strings, no TODO/lorem placeholders and balanced ICU placeholders', () => {
    const en = flat(messages.en);
    for (const l of locales) {
      for (const [k, v] of Object.entries(flat(messages[l]))) {
        expect(v.trim(), `${l}:${k}`).not.toBe('');
        expect(v, `${l}:${k}`).not.toMatch(/\bTODO\b|XXX|\[\[/);
        expect(v, `${l}:${k}`).not.toMatch(/lorem ipsum|translate me/i);
        const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
        expect(placeholders(v), `${l}:${k} placeholders`).toBe(placeholders(en[k]!));
      }
    }
  });

  it('translate every downloader error code and the FAQ has 10+ items per language', () => {
    for (const l of locales) {
      expect(Object.keys(messages[l].downloader.errors).sort()).toEqual(
        Object.keys(messages.en.downloader.errors).sort(),
      );
      expect(messages[l].faq.items.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('use Arabic script for Arabic UI strings (no English left over)', () => {
    for (const [k, v] of Object.entries(flat(messages.ar))) {
      if (/^(downloader\.placeholder|reels\.patterns\[\d\]\.example)$/.test(k)) continue;
      expect(v, k).toMatch(/[؀-ۿ]|^\d|^https?:|^[A-Za-z]{1,6}$|^Ctrl/);
    }
  });
});

describe('long-form pages', () => {
  const pages = Object.keys(PAGE_FILES) as PageName[];
  it.each(locales.flatMap((l) => pages.map((p) => [l, p] as const)))(
    '%s/%s exists, has metadata and a single H1',
    (l, p) => {
      const page = getPage(l, p);
      expect(page.title.length).toBeGreaterThan(10);
      expect(page.description.length).toBeGreaterThan(40);
      expect(page.description.length).toBeLessThanOrEqual(220);
      expect((page.html.match(/<h1/g) ?? []).length).toBe(1);
      expect(page.text.split(/\s+/).length).toBeGreaterThan(150);
      expect(page.html).not.toMatch(/__BRAND__|\{\{|page:|blog:/);
    },
  );

  it('has unique titles and descriptions across pages within a language', () => {
    for (const l of locales) {
      const titles = pages.map((p) => getPage(l, p).title);
      const descriptions = pages.map((p) => getPage(l, p).description);
      expect(new Set(titles).size).toBe(titles.length);
      expect(new Set(descriptions).size).toBe(descriptions.length);
    }
  });

  it('link internally with locale-prefixed URLs only', () => {
    for (const l of locales) {
      for (const p of pages) {
        const links = [...getPage(l, p).html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]!);
        for (const href of links)
          expect(decodeURI(href).startsWith(`/${l}`), `${l}/${p}: ${href}`).toBe(true);
      }
    }
  });
});

describe('blog', () => {
  it('has the five required topics in all four languages (20 articles)', () => {
    const ids = getArticles('en')
      .map((a) => a.id)
      .sort();
    expect(ids).toEqual([
      'copyright-privacy-responsible-use',
      'download-facebook-videos-hd',
      'extract-audio-authorized',
      'save-facebook-reels-iphone',
      'why-download-fails',
    ]);
    let total = 0;
    for (const l of locales) {
      expect(
        getArticles(l)
          .map((a) => a.id)
          .sort(),
      ).toEqual(ids);
      total += getArticles(l).length;
    }
    expect(total).toBeGreaterThanOrEqual(20);
  });

  it('has substantial, structured, non-duplicated articles', () => {
    const seen = new Set<string>();
    for (const l of locales) {
      for (const a of getArticles(l)) {
        const text = a.html.replace(/<[^>]+>/g, ' ');
        const words = text.split(/\s+/).filter(Boolean).length;
        expect(words, `${l}/${a.id}`).toBeGreaterThanOrEqual(800);
        expect(words, `${l}/${a.id}`).toBeLessThanOrEqual(1500);
        expect((a.html.match(/<h2/g) ?? []).length, `${l}/${a.id} h2`).toBeGreaterThanOrEqual(5);
        expect((a.html.match(/<h1/g) ?? []).length).toBe(1);
        expect(a.description.length).toBeGreaterThan(60);
        expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(a.html).not.toMatch(/__BRAND__|\{\{|\]\((page|blog):/);
        expect(seen.has(a.title), `duplicate title ${a.title}`).toBe(false);
        seen.add(a.title);
        expect(getArticle(l, a.slug)?.id).toBe(a.id);
      }
    }
  });

  it('uses unique, URL-safe slugs per language and does not publish an "updated" date it cannot back up', () => {
    for (const l of locales) {
      const slugs = getArticles(l).map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const s of slugs) expect(s).toMatch(/^[\p{L}\p{N}-]+$/u);
      for (const a of getArticles(l)) expect(a.updated).toBeUndefined();
    }
  });

  it('does not contain fabricated statistics or credentials', () => {
    for (const l of locales) {
      for (const a of getArticles(l)) {
        const prose = a.html.replace(/href="[^"]*"/g, '');
        expect(prose, `${l}/${a.id}`).not.toMatch(/\d\s?%|٪/);
        expect(prose, `${l}/${a.id}`).not.toMatch(
          /according to (a )?(study|survey|research)|selon (une|des) (étude|enquête)|según (un|una) (estudio|encuesta)|وفقًا لدراسة/i,
        );
      }
    }
  });
});

describe('hreflang and sitemap', () => {
  it('produce correct, encoded, canonical URLs for every language including Arabic', () => {
    const alt = languageAlternates(() => ({ pathname: '/how-to-download' }));
    expect(Object.keys(alt).sort()).toEqual(['ar', 'en', 'es', 'fr', 'x-default']);
    expect(alt.en).toMatch(/\/en\/how-to-download$/);
    expect(alt.fr).toMatch(/\/fr\/comment-telecharger$/);
    expect(alt.es).toMatch(/\/es\/como-descargar$/);
    expect(alt.ar).toMatch(/^http.*\/ar\/%D9%83/);
    expect(alt['x-default']).toBe(alt.en);
    expect(new Set(Object.values(alt).filter((v) => v !== alt.en)).size).toBe(3); // no language collapses onto another canonical
  });

  it('omits alternates that do not exist', () => {
    const alt = languageAlternates((l) => (l === 'fr' ? null : { pathname: '/faq' }));
    expect(alt.fr).toBeUndefined();
    expect(Object.keys(alt)).toContain('x-default');
    const noDefault = languageAlternates((l) => (l === 'en' ? null : { pathname: '/faq' }));
    expect(noDefault['x-default']).toBeUndefined();
  });

  it('sitemap lists every localized route and article exactly once with reciprocal alternates', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    const staticRoutes = Object.keys(pathnames).filter((p) => p !== '/blog/[slug]').length;
    expect(urls.length).toBe(staticRoutes * locales.length + 5 * locales.length);
    for (const e of entries) {
      const langs = e.alternates!.languages as Record<string, string>;
      expect(Object.values(langs)).toContain(e.url); // self-referencing
      for (const target of Object.values(langs))
        expect(urls, `alternate ${target} must be a sitemap URL`).toContain(target);
    }
    expect(urls.join('\n')).not.toMatch(/\/api\//);
  });

  it('keeps article alternates pointing at the sibling-language slug', () => {
    const map = getArticleSlugMap();
    const id = 'save-facebook-reels-iphone';
    for (const l of locales) expect(map[id]![l]).toBe(getArticle(l, map[id]![l]!)!.slug);
    expect(
      absoluteUrl('fr', { pathname: '/blog/[slug]', params: { slug: map[id]!.fr! } }),
    ).toContain('/fr/blog/');
  });

  it('robots allows content, blocks only the API and references the sitemap', () => {
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
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n');
    vi.unstubAllEnvs();
  });
});
