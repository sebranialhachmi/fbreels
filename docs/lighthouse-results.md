# Lighthouse results (measured, not guaranteed)

Measured on 2026-10-29 with Lighthouse 12.8.2 (headless Chromium, default simulated throttling for the
mobile preset, `--preset=desktop` for desktop) against the **standalone production build** served from
`127.0.0.1` in the authoring sandbox, with `NEXT_PUBLIC_SITE_URL` set to that origin so canonical URLs match.
No ads, analytics or consent banner were active (the default configuration). Real-world scores depend on hosting,
CDN, network, third-party scripts (AdSense will lower them) and device. Re-run on your production domain:

```bash
npx lighthouse https://your-domain.example/en --preset=desktop --view
```

| Page / form factor | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ar-article-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| ar-article-mobile | 95 | 100 | 100 | 100 | 2.8 s | 0 | 150 ms |
| ar-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| ar-mobile | 94 | 100 | 100 | 100 | 3.0 s | 0 | 80 ms |
| en-article-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| en-article-mobile | 96 | 100 | 100 | 100 | 2.6 s | 0 | 90 ms |
| en-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| en-mobile | 97 | 100 | 100 | 100 | 2.6 s | 0 | 70 ms |
| es-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| es-mobile | 96 | 100 | 100 | 100 | 2.6 s | 0 | 80 ms |
| fr-faq-desktop | 100 | 100 | 100 | 100 | 0.6 s | 0 | 0 ms |
| fr-faq-mobile | 97 | 100 | 100 | 100 | 2.6 s | 0 | 70 ms |

Pages: `/en` (home), `/es` (home), `/ar` (home, RTL), `/fr/faq`, `/en/blog/<article>`, `/ar/المدونة/<article>`.

## Issues found by these audits and fixed during development

- Arabic pages had CLS ≈ 0.16–0.2 caused by the Cairo web-font swap. Fixed by self-hosting the font in
  `public/fonts`, preloading it on Arabic pages only and using `font-display: optional` (CLS now 0).
- `upgrade-insecure-requests` / HSTS broke plain-HTTP deployments (blocked client-side navigation requests). They are now
  only emitted when `NEXT_PUBLIC_SITE_URL` is an `https://` URL.
- A Next.js 15.5 quirk with `HOSTNAME=127.0.0.1` redirecting localized routes; see `scripts/start-standalone.mjs` and the README.
