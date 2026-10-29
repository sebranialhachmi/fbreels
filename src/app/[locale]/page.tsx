import {
  Check,
  Languages,
  ListChecks,
  MessageCircleQuestion,
  Moon,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdSlot } from '@/components/ads/ad-slot';
import { FaqList, type FaqItem } from '@/components/content/faq-list';
import { Section } from '@/components/content/section';
import { Downloader } from '@/components/downloader/downloader';
import { JsonLd } from '@/components/seo/json-ld';
import { ArticleCard } from '@/components/content/article-card';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { brand } from '@/config/brand';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { getArticleSlugMap, getArticles } from '@/lib/content';
import { buildMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/seo/urls';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta.home' });
  return buildMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    href: { pathname: '/' },
  });
}

const FEATURE_ICONS = [ShieldCheck, ListChecks, Smartphone, Languages, Moon, MessageCircleQuestion];

type Step = { title: string; text: string };
type Device = { title: string; steps: string[] };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tf = await getTranslations('faq');
  const badges = t.raw('hero.badges') as string[];
  const steps = t.raw('steps.items') as Step[];
  const features = t.raw('features.items') as Step[];
  const supported = t.raw('support.supported') as string[];
  const unsupported = t.raw('support.unsupported') as string[];
  const troubleshooting = t.raw('troubleshooting.items') as Step[];
  const responsible = t.raw('responsible.paragraphs') as string[];
  const faqItems = (tf.raw('items') as FaqItem[]).slice(0, 10);
  const devices: Device[] = [
    t.raw('devices.android'),
    t.raw('devices.iphone'),
    t.raw('devices.desktop'),
  ];
  const articles = getArticles(locale).slice(0, 3);
  const meta = await getTranslations('meta.home');

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: brand.name,
            url: absoluteUrl(locale, { pathname: '/' }),
            inLanguage: locale,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: brand.name,
            url: absoluteUrl(locale, { pathname: '/' }),
            description: meta('description'),
            applicationCategory: 'MultimediaApplication',
            operatingSystem: 'Any (web browser)',
            inLanguage: locale,
          },
        ]}
      />
      <section className="hero-gradient border-b border-border">
        <div className="container-page pb-12 pt-10 sm:pb-16 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-5xl">
              <span className="text-gradient">{t('hero.h1')}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-muted sm:text-lg">
              {t('hero.subtitle')}
            </p>
          </div>
          <div className="mx-auto mt-8 max-w-[var(--container-tool)]">
            <Downloader />
            <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted">
              {badges.map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <Check aria-hidden className="size-4 text-success" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Generous distance from the tool so ads cannot be mistaken for download controls */}
      <AdSlot placement="belowTool" className="mt-16" />

      <Section title={t('steps.title')} id="steps">
        <ol className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full p-6">
                <span
                  className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t('features.title')} id="features">
        <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
            return (
              <li key={f.title}>
                <Card className="h-full p-6">
                  <Icon aria-hidden className="size-6 text-primary-text" />
                  <h3 className="mt-3 font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{f.text}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      </Section>

      <AdSlot placement="betweenSections" />

      <Section title={t('support.title')} intro={t('support.intro')} id="supported">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-bold text-success">{t('support.supportedTitle')}</h3>
            <ul className="mt-3 space-y-2">
              {supported.map((s) => (
                <li key={s} className="flex gap-2 text-sm">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold text-danger-text">{t('support.unsupportedTitle')}</h3>
            <ul className="mt-3 space-y-2">
              {unsupported.map((s) => (
                <li key={s} className="flex gap-2 text-sm">
                  <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <p className="mx-auto mt-4 max-w-5xl text-center text-sm text-muted">{t('support.note')}</p>
      </Section>

      <Section title={t('devices.title')} intro={t('devices.intro')} id="devices">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {devices.map((d) => (
            <Card key={d.title} className="p-6">
              <h3 className="text-lg font-bold">{d.title}</h3>
              <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-muted">
                {d.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center">
          <Link href="/how-to-download" className={buttonClasses('outline')}>
            {t('devices.more')}
          </Link>
        </p>
      </Section>

      <Section title={t('troubleshooting.title')} id="troubleshooting">
        <div className="mx-auto max-w-3xl space-y-3">
          {troubleshooting.map((x) => (
            <Card key={x.title} className="p-5">
              <h3 className="font-bold">{x.title}</h3>
              <p className="mt-1 text-sm text-muted">{x.text}</p>
            </Card>
          ))}
          <p className="pt-2 text-center">
            <Link
              href={{
                pathname: '/blog/[slug]',
                params: { slug: articleSlug(locale, 'why-download-fails') },
              }}
              className="text-primary-text underline"
            >
              {t('troubleshooting.more')}
            </Link>
          </p>
        </div>
      </Section>

      <Section title={t('responsible.title')} id="responsible">
        <div className="mx-auto max-w-3xl space-y-4 text-center text-muted">
          {responsible.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/privacy-policy" className="text-primary-text underline">
              {t('responsible.link')}
            </Link>
            <Link href="/copyright" className="text-primary-text underline">
              {t('responsible.copyrightLink')}
            </Link>
          </p>
        </div>
      </Section>

      <Section title={t('faq.title')} id="faq">
        <div className="mx-auto max-w-3xl">
          <FaqList items={faqItems} />
          <p className="mt-5 text-center">
            <Link href="/faq" className="text-primary-text underline">
              {t('faq.more')}
            </Link>
          </p>
        </div>
      </Section>

      <Section title={t('articles.title')} id="articles">
        <ul className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {articles.map((a) => (
            <li key={a.id}>
              <ArticleCard article={a} />
            </li>
          ))}
        </ul>
        <p className="mt-6 text-center">
          <Link href="/blog" className={buttonClasses('outline')}>
            {t('articles.all')}
          </Link>
        </p>
      </Section>
    </>
  );
}

function articleSlug(locale: Locale, id: string): string {
  const slug = getArticleSlugMap()[id]?.[locale];
  if (!slug) throw new Error(`Missing article ${id} for ${locale}`);
  return slug;
}
