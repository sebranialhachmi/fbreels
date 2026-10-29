import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Article } from '@/lib/content';
import { Card } from '@/components/ui/card';

export async function ArticleCard({ article }: { article: Article }) {
  const t = await getTranslations('common');
  const format = await getFormatter({ locale: article.locale });
  return (
    <Card className="relative flex h-full flex-col p-6 transition-shadow hover:shadow-pop">
      <p className="text-xs text-muted">
        {format.dateTime(new Date(article.published), { dateStyle: 'medium', timeZone: 'UTC' })} · {t('minRead', { minutes: article.readingMinutes })}
      </p>
      <h3 className="mt-2 text-lg font-bold leading-snug">
        <Link href={{ pathname: '/blog/[slug]', params: { slug: article.slug } }} className="after:absolute after:inset-0 hover:underline">
          {article.title}
        </Link>
      </h3>
      <p className="mt-2 flex-1 text-sm text-muted">{article.description}</p>
      <span className="mt-4 text-sm font-semibold text-primary-text">{t('readArticle')} →</span>
    </Card>
  );
}
