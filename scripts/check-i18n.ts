import fs from 'node:fs';
import path from 'node:path';

const locales = ['en', 'fr', 'es', 'ar'];
const root = process.cwd();
const messages = Object.fromEntries(
  locales.map((l) => [
    l,
    JSON.parse(fs.readFileSync(path.join(root, 'messages', `${l}.json`), 'utf8')),
  ]),
);

function keys(obj: unknown, prefix = ''): string[] {
  if (Array.isArray(obj))
    return [`${prefix}[${obj.length}]`, ...obj.flatMap((v, i) => keys(v, `${prefix}[${i}]`))];
  if (obj && typeof obj === 'object')
    return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  return [prefix];
}

let failed = false;
const base = new Set(keys(messages.en));
for (const l of locales.slice(1)) {
  const set = new Set(keys(messages[l]));
  const missing = [...base].filter((k) => !set.has(k));
  const extra = [...set].filter((k) => !base.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(
      `[${l}] missing: ${missing.join(', ') || '-'} | extra: ${extra.join(', ') || '-'}`,
    );
  }
}

// Identical-to-English strings (excluding brand/code-like values) hint at untranslated text.
function flat(obj: unknown, prefix = '', out: Record<string, string> = {}) {
  if (typeof obj === 'string') out[prefix] = obj;
  else if (Array.isArray(obj)) obj.forEach((v, i) => flat(v, `${prefix}[${i}]`, out));
  else if (obj && typeof obj === 'object')
    for (const [k, v] of Object.entries(obj)) flat(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const en = flat(messages.en);
for (const l of locales.slice(1)) {
  const t = flat(messages[l]);
  const same = Object.keys(en).filter(
    (k) =>
      t[k] === en[k] &&
      /[A-Za-z]{4,}/.test(en[k]!) &&
      !/^(https?:|facebook\.com|fb\.watch|[\w./?=-]+$)/.test(en[k]!) &&
      !/\.example$|\.label$/.test(k),
  );
  if (same.length) {
    failed = true;
    console.error(`[${l}] identical to English: ${same.join(', ')}`);
  }
}
if (failed) process.exit(1);
console.log('i18n: all locales share the same key structure and no English strings remain.');
