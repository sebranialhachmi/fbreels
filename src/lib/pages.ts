import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { brand } from '@/config/brand';
import { siteUrl } from '@/config/site';

const DIR = path.join(process.cwd(), 'content');

export type PageKind =
  'calculator' | 'sector' | 'article' | 'legal' | 'static' | 'articles-index' | 'sitemap';
export type CalcPreset = 'general' | 'resignation' | 'termination';

export type FaqEntry = { q: string; a: string };

export type PageMeta = {
  id: string;
  slug: string; // '' for home
  title: string;
  description: string;
  heading: string;
  kind: PageKind;
  preset?: CalcPreset;
  published?: string;
  /** Only set when the page was genuinely re-reviewed. */
  reviewed?: string;
  faq: FaqEntry[];
  order: number;
};

export type Page = PageMeta & { before: string; after: string; hasCalculator: boolean };

const CALC_MARKER = /^\[\[calculator\]\]\s*$/m;

function str(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
}

let cache: { metas: PageMeta[]; raw: Map<string, string> } | undefined;

function load() {
  if (cache) return cache;
  const raw = new Map<string, string>();
  const metas: PageMeta[] = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data, content } = matter(fs.readFileSync(path.join(DIR, file), 'utf8'));
      for (const k of ['id', 'title', 'description', 'heading', 'kind']) {
        if (data[k] === undefined) throw new Error(`content/${file}: missing front-matter "${k}"`);
      }
      raw.set(String(data.id), content);
      return {
        id: String(data.id),
        slug: data.slug === undefined || data.slug === null ? '' : String(data.slug),
        title: String(data.title),
        description: String(data.description),
        heading: String(data.heading),
        kind: data.kind as PageKind,
        preset: data.preset as CalcPreset | undefined,
        published: str(data.published),
        reviewed: str(data.reviewed),
        faq: Array.isArray(data.faq) ? (data.faq as FaqEntry[]) : [],
        order: Number(data.order ?? 100),
      };
    })
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const m of metas) {
    if (ids.has(m.id)) throw new Error(`Duplicate page id ${m.id}`);
    if (slugs.has(m.slug)) throw new Error(`Duplicate slug ${m.slug}`);
    ids.add(m.id);
    slugs.add(m.slug);
  }
  cache = { metas, raw };
  return cache;
}

export function allPages(): PageMeta[] {
  return load().metas;
}

export function pageById(id: string): PageMeta {
  const m = load().metas.find((p) => p.id === id);
  if (!m) throw new Error(`Unknown page id "${id}"`);
  return m;
}

export function hrefOf(meta: Pick<PageMeta, 'slug'>): string {
  return meta.slug ? `/${meta.slug}` : '/';
}

export function absoluteUrl(href: string): string {
  const u = new URL(href === '/' ? '' : href, `${siteUrl}/`).href;
  return u.endsWith('/') && href === '/' ? u.slice(0, -1) : u;
}

function resolve(md: string): string {
  return md
    .replace(/__BRAND__/g, brand.name)
    .replace(/\]\(page:([\w-]+)\)/g, (_m, id: string) => `](${hrefOf(pageById(id))})`);
}

const render = (md: string) => marked.parse(resolve(md), { async: false, gfm: true }) as string;

export function getPage(slug: string): Page | undefined {
  const meta = load().metas.find((p) => p.slug === slug);
  if (!meta) return undefined;
  const body = load().raw.get(meta.id) ?? '';
  const parts = body.split(CALC_MARKER);
  return {
    ...meta,
    before: render(parts[0] ?? ''),
    after: parts.length > 1 ? render(parts.slice(1).join('\n')) : '',
    hasCalculator: parts.length > 1,
  };
}

export function pagesOfKind(...kinds: PageKind[]): PageMeta[] {
  return load().metas.filter((p) => kinds.includes(p.kind));
}

export function wordCount(slug: string): number {
  const p = getPage(slug);
  return p
    ? (p.before + p.after)
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length
    : 0;
}
