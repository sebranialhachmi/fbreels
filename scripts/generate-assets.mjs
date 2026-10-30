// Renders brand icons and the social preview image from the logo SVG using Playwright.
// Run: node scripts/generate-assets.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const svg = fs.readFileSync('public/logo.svg', 'utf8');
const cairo = (f) => fs.readFileSync(`public/fonts/${f}`).toString('base64');
const fontCss = `
@font-face{font-family:'CairoE';src:url(data:font/woff2;base64,${cairo('cairo-arabic-wght-normal.woff2')}) format('woff2-variations');font-weight:200 1000;unicode-range:U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFC,U+200C-200E}
@font-face{font-family:'CairoE';src:url(data:font/woff2;base64,${cairo('cairo-latin-wght-normal.woff2')}) format('woff2-variations');font-weight:200 1000;unicode-range:U+0000-00FF,U+2000-206F}`;

const sized = (n) => svg.replace(/width="\d+" height="\d+"/, `width="${n}" height="${n}"`);
const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage();

async function png(html, w, h, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head><style>${fontCss}</style></head><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: transparent });
}

await png(sized(192), 192, 192, 'public/icons/icon-192.png', true);
await png(sized(512), 512, 512, 'public/icons/icon-512.png', true);
// Maskable: full-bleed background with the mark inside the safe zone.
await png(`<div style="width:512px;height:512px;background:linear-gradient(135deg,#2563EB,#7C3AED);display:flex;align-items:center;justify-content:center"><div style="width:300px;height:300px">${sized(300)}</div></div>`, 512, 512, 'public/icons/icon-maskable-512.png');
await png(sized(180), 180, 180, 'src/app/apple-icon.png', true);

await png(
  `<div dir="rtl" style="width:1200px;height:630px;display:flex;align-items:center;justify-content:center;gap:56px;font-family:CairoE,sans-serif;background:linear-gradient(135deg,#0b1020 0%,#1e1b4b 60%,#312e81 100%);color:#fff;box-sizing:border-box;padding:0 90px">
    ${sized(240)}
    <div style="text-align:right">
      <div style="font-size:62px;font-weight:800;line-height:1.3;white-space:nowrap">حاسبة مكافأة نهاية الخدمة</div>
      <div style="margin-top:20px;font-size:34px;font-weight:600;color:#c7d2fe;white-space:nowrap">وفق نظام العمل السعودي — القطاع الخاص</div>
    </div>
  </div>`,
  1200,
  630,
  'public/og.png',
);
await browser.close();
console.log('assets generated');
