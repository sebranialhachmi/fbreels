import { getRequestConfig } from 'next-intl/server';
import { brand } from '@/config/brand';
import { routing, isLocale } from './routing';

const BRAND_TOKEN = /__BRAND__/g;

function injectBrand<T>(value: T): T {
  if (typeof value === 'string') return value.replace(BRAND_TOKEN, brand.name) as T;
  if (Array.isArray(value)) return value.map(injectBrand) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, injectBrand(v)]),
    ) as T;
  }
  return value;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: injectBrand(messages) };
});
