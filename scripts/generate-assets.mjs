// Renders brand icons and the social preview image from inline SVG/HTML using Playwright.
import { chromium } from 'playwright';
import fs from 'node:fs';

const mark = (size, pad = 0, radius = 9) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#7C3AED"/></linearGradient></defs>
  <rect width="32" height="32" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${16 - 16 * (1 - pad)} ${16 - 16 * (1 - pad)}) scale(${1 - pad})">
    <path d="M11 7v10.2c0 .8.9 1.3 1.6.9l7.6-5.1c.6-.4.6-1.3 0-1.7l-7.6-5.1C11.9 5.7 11 6.2 11 7Z" fill="#fff"/>
    <path d="M10 24h12" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
  </g>
</svg>`;

const browser = await chromium.launch(
  fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {},
);
const page = await browser.newPage();

async function png(html, w, h, out, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<html><body style="margin:0;background:${transparent ? 'transparent' : '#fff'}">${html}</body></html>`,
  );
  await page.screenshot({ path: out, omitBackground: transparent });
}

await png(mark(192), 192, 192, 'public/icons/icon-192.png', true);
await png(mark(512), 512, 512, 'public/icons/icon-512.png', true);
// Maskable: full-bleed square background with the glyph inside the safe zone.
await png(mark(512, 0.22, 0), 512, 512, 'public/icons/icon-maskable-512.png');
await png(mark(180, 0.0, 0), 180, 180, 'src/app/apple-icon.png');

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || 'ReelSave';
await png(
  `<div style="width:1200px;height:630px;display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;font-family:Inter,system-ui,sans-serif;background:linear-gradient(135deg,#0b1020 0%,#1e1b4b 60%,#312e81 100%);color:#fff">
    <div style="display:flex;align-items:center;gap:28px">${mark(120)}<div style="font-size:84px;font-weight:800;letter-spacing:-2px">${brand}</div></div>
    <div style="margin-top:40px;font-size:46px;font-weight:600;line-height:1.25;max-width:900px">Facebook Reels &amp; video downloader</div>
    <div style="margin-top:18px;font-size:30px;color:#c7d2fe">EN · FR · ES · AR</div>
  </div>`,
  1200,
  630,
  'public/og.png',
);
await browser.close();
console.log('assets generated');
