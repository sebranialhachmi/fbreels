import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';
import { ROUTE_FOR, type NavKey } from '@/components/layout/nav-items';
import { locales, type Locale } from '@/i18n/routing';
import { localizedPath } from '@/lib/seo/urls';

const ROOT = path.join(process.cwd(), 'content');

export type PageName = 'howTo' | 'about' | 'privacy' | 'terms' | 'copyright' | 'disclaimer' | 'cookies' | 'accessibility' | 'editorial';

export const PAGE_FILES: Record<PageName, string> = {
  howTo: 'how-to-download',
  about: 'about',
  privacy: 'privacy-policy',
  terms: 'terms',
  copyright: 'copyright',
  disclaimer: 'disclaimer',
  cookies: 'cookie-policy',
  accessibility: 'accessibility',
  editorial: 'editorial-policy',
};

export type PageContent = { title: string; description: string; updated?: string; html: string; text: string };

export type Article = {
  id: string;
  locale: Locale;
  slug: string;
  title: string;
  description: string;
  /** ISO date the article was first published. No "updated" date is shown unless genuinely reviewed. */
  published: string;
  updated?: string;
  readingMinutes: number;
  html: string;
};

function resolveLinks(md: string, locale: Locale): string {
  return md
    .replace(/__BRAND__|\{\{brand\}\}/g, brand.name)
    .replace(/\{\{siteUrl\}\}/g, siteUrl)
    .replace(/\]\(page:(\w+)\)/g, (_m, key: string) => {
      const route = ROUTE_FOR[key as NavKey];
      if (!route) throw new Error(`Unknown page link "${key}"`);
      return `](${localizedPath(locale, { pathname: route })})`;
    })
    .replace(/\]\(blog:([\w-]+)\)/g, (_m, id: string) => {
      const slug = articleSlugFor(id, locale);
      if (!slug) throw new Error(`Unknown article link "${id}" for ${locale}`);
      return `](${localizedPath(locale, { pathname: '/blog/[slug]', params: { slug } })})`;
    });
}

function render(md: string): string {
  return marked.parse(md, { async: false, gfm: true }) as string;
}

const pageCache = new Map<string, PageContent>();

export function getPage(locale: Locale, name: PageName): PageContent {
  const key = `${locale}/${name}`;
  const hit = pageCache.get(key);
  if (hit) return hit;
  const file = path.join(ROOT, locale, 'pages', `${PAGE_FILES[name]}.md`);
  const { data, content } = matter(fs.readFileSync(file, 'utf8'));
  const resolved = resolveLinks(content, locale);
  const result: PageContent = {
    title: String(data.title),
    description: String(data.description),
    updated: data.updated ? String(data.updated) : undefined,
    html: render(resolved),
    text: resolved,
  };
  pageCache.set(key, result);
  return result;
}

type RawArticle = { id: string; slug: string; title: string; description: string; published: string; updated?: string; body: string };
const rawCache = new Map<Locale, RawArticle[]>();

function loadRaw(locale: Locale): RawArticle[] {
  const hit = rawCache.get(locale);
  if (hit) return hit;
  const dir = path.join(ROOT, locale, 'blog');
  const list = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const k of ['id', 'slug', 'title', 'description', 'published']) {
        if (!data[k]) throw new Error(`Article ${locale}/${f} is missing front-matter "${k}"`);
      }
      return {
        id: String(data.id),
        slug: String(data.slug),
        title: String(data.title),
        description: String(data.description),
        published: data.published instanceof Date ? data.published.toISOString().slice(0, 10) : String(data.published),
        updated: data.updated ? (data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated)) : undefined,
        body: content,
      };
    })
    .sort((a, b) => b.published.localeCompare(a.published) || a.id.localeCompare(b.id));
  rawCache.set(locale, list);
  return list;
}

function articleSlugFor(id: string, locale: Locale): string | undefined {
  return loadRaw(locale).find((a) => a.id === id)?.slug;
}

function toArticle(locale: Locale, r: RawArticle): Article {
  const html = render(resolveLinks(r.body, locale));
  const words = r.body.split(/\s+/).filter(Boolean).length;
  return {
    id: r.id,
    locale,
    slug: r.slug,
    title: r.title,
    description: r.description,
    published: r.published,
    updated: r.updated,
    readingMinutes: Math.max(1, Math.round(words / 200)),
    html,
  };
}

export function getArticles(locale: Locale): Article[] {
  return loadRaw(locale).map((r) => toArticle(locale, r));
}

export function getArticle(locale: Locale, slug: string): Article | undefined {
  const r = loadRaw(locale).find((a) => a.slug === slug);
  return r ? toArticle(locale, r) : undefined;
}

export function getArticleIds(): string[] {
  return loadRaw('en').map((a) => a.id);
}

/** Article id -> slug per language (all four languages exist for every article). */
export function getArticleSlugMap(): Record<string, Partial<Record<Locale, string>>> {
  const out: Record<string, Partial<Record<Locale, string>>> = {};
  for (const l of locales) for (const a of loadRaw(l)) (out[a.id] ??= {})[l] = a.slug;
  return out;
}
