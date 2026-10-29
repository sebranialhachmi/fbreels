# ReelSave — multilingual Facebook Reels & video downloader

> **Status in one line:** the application, UI, localization, content, SEO, consent, security controls
> and a provider-ready download pipeline are implemented and tested. **No real extraction provider is
> connected, so real downloading has not been verified.** Until one is configured the site answers
> every valid link with an honest "not configured" state. See [Known limitations](#19-known-limitations).

"ReelSave" is a placeholder brand name (change it in one place, see [Brand](#brand)). This project is
independent and not affiliated with Facebook or Meta Platforms, Inc.

## Contents

1. [Project overview](#1-project-overview)
2. [Requirements](#2-requirements)
3. [Installation](#3-installation)
4. [Local development](#4-local-development)
5. [Environment variables](#5-environment-variables)
6. [Localization setup](#6-localization-setup)
7. [How to add a language](#7-how-to-add-a-language)
8. [How the extraction provider works](#8-how-the-extraction-provider-works)
9. [How to configure the approved provider](#9-how-to-configure-the-approved-provider)
10. [How to configure contact form delivery](#10-how-to-configure-contact-form-delivery)
11. [How to add AdSense](#11-how-to-add-adsense)
12. [How to configure consent management](#12-how-to-configure-consent-management)
13. [How to run tests](#13-how-to-run-tests)
14. [How to build for production](#14-how-to-build-for-production)
15. [Vercel deployment](#15-vercel-deployment)
16. [VPS or Docker deployment](#16-vps-or-docker-deployment)
17. [Security considerations](#17-security-considerations)
18. [Troubleshooting](#18-troubleshooting)
19. [Known limitations](#19-known-limitations)
20. [Replacement of the previous site and rollback](#20-replacement-of-the-previous-site-and-rollback)

## 1. Project overview

- **Stack:** Next.js 15 (App Router, Server Components by default), TypeScript (strict), React 19,
  Tailwind CSS 4, `next-intl` 4, Zod 4, Framer Motion (subtle, reduced-motion aware), Lucide icons.
  UI primitives in `src/components/ui` follow the shadcn/ui pattern (copy-in components built with
  Tailwind, `clsx` and `tailwind-merge`); the shadcn CLI itself was not used.
- **Languages:** English (default), French, Spanish, Arabic with real RTL. Every page exists in all four.
- **Pages (×4 languages):** home/downloader, Reels downloader landing page, how-to, FAQ, about, contact,
  blog index + 5 articles, privacy, terms, copyright & takedown, disclaimer, cookie policy,
  accessibility, editorial policy, HTML sitemap, localized 404 and a "temporarily unavailable" error page.
- **API:** `POST /api/extract`, `GET /api/download`, `POST /api/contact`, `GET /api/health`.
- **Content:** Markdown in `content/<locale>/pages` and `content/<locale>/blog`; UI strings in `messages/<locale>.json`.

### Brand

The product name is configured centrally: `src/config/brand.ts`, driven by `NEXT_PUBLIC_BRAND_NAME`.
UI strings and Markdown use a `__BRAND__` token that is replaced at load time, so renaming never
requires editing components or content. After renaming, regenerate the icons/social image with
`node scripts/generate-assets.mjs` (set `NEXT_PUBLIC_BRAND_NAME` first for the social image text).

### Repository layout

```
src/app/[locale]/…        pages (each folder name is the *internal* route key, see src/i18n/routing.ts)
src/app/api/…             route handlers
src/components/           ui, layout, downloader, forms, ads, consent, content, seo
src/config/               brand, site, ad placements
src/i18n/                 routing (locales + localized pathnames), request config, navigation helpers
src/lib/validation/       Facebook URL allowlist + normalisation (shared by browser and server)
src/lib/security/         SSRF guard (ip.ts, safe-fetch.ts), download tokens, filenames
src/lib/providers/        MediaExtractor interface, mock (test-only), generic HTTP adapter
src/lib/extract-service.ts   orchestration: validate → cache/dedupe → limit → provider → tokens
src/lib/rate-limit/       in-memory + REST (Upstash-compatible) limiters
content/<locale>/…        long-form Markdown
messages/<locale>.json    UI strings
tests/{unit,integration,e2e}
docs/                     provider contract, ads.txt template
```

## 2. Requirements

- Node.js ≥ 20.9 (developed and tested on Node 22) and npm.
- For end-to-end tests: Chromium (Playwright). In this repository's CI-less environment a preinstalled
  Chromium at `/opt/pw-browsers/chromium` is picked up automatically; otherwise run `npx playwright install chromium`.
- A long-running Node runtime for the download proxy (see [Vercel](#15-vercel-deployment) caveats).

## 3. Installation

```bash
npm ci
cp .env.example .env.local   # then edit; never commit .env.local
```

## 4. Local development

```bash
npm run dev          # http://localhost:3000, redirects / to a language based on Accept-Language
```

To exercise the UI end to end without a real provider, use the **test-only mock**:

```bash
MEDIA_EXTRACTOR_PROVIDER=mock npm run dev
```

The mock never contacts Facebook. It returns fixture data labelled "Test data" and serves a tiny
generated text file on download. Paste e.g. `https://www.facebook.com/reel/1234567890`.
Special ids trigger error states: `9990001` private, `9990002` unavailable, `9990003` no formats,
`9990004` provider unavailable, `9990005` timeout, `9990006` HD + SD + audio.
The mock is **refused when `NODE_ENV=production`**.

Other scripts: `npm run lint`, `npm run typecheck`, `npm run format`, `npm run check:i18n`.

## 5. Environment variables

See [`.env.example`](.env.example) for the authoritative list. Only variables the code reads are included.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | build | Canonical origin for canonical/hreflang/sitemap/robots. **Set it in production.** |
| `NEXT_PUBLIC_BRAND_NAME` | build | Product name (default `ReelSave`). |
| `NEXT_PUBLIC_CONTACT_EMAIL` | build | Optional address *displayed* on the contact page. Never invented. |
| `MEDIA_EXTRACTOR_PROVIDER` | server | `none` (default), `mock` (dev/test only), `http-json`. |
| `MEDIA_EXTRACTOR_BASE_URL`, `MEDIA_EXTRACTOR_API_KEY` | server | Endpoint and bearer key for `http-json`. |
| `MEDIA_EXTRACTOR_TIMEOUT_MS`, `MEDIA_EXTRACTOR_EXPAND_LINKS` | server | Provider tuning; expand short/share links first. |
| `MEDIA_DOWNLOAD_HOST_ALLOWLIST` | server | Optional host suffix allowlist for the download proxy. |
| `DOWNLOAD_TOKEN_SECRET` | server | **Required in production**, ≥ 32 random chars (`openssl rand -hex 32`). |
| `EXTRACT_RATE_LIMIT`, `EXTRACT_RATE_WINDOW_SECONDS`, `DOWNLOAD_RATE_LIMIT`, `DOWNLOAD_RATE_WINDOW_SECONDS` | server | Per-client limits. |
| `EXTRACT_MAX_CONCURRENCY`, `DOWNLOAD_MAX_MB` | server | Provider concurrency; per-file size cap. |
| `RATE_LIMIT_REST_URL`, `RATE_LIMIT_REST_TOKEN` | server | Shared limiter (Upstash-compatible Redis REST). |
| `TRUST_PROXY_HEADERS` | server | `false` if not behind a trusted proxy (ignores `X-Forwarded-For`). |
| `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL`, `CONTACT_PROVIDER_API_KEY` | server | Contact delivery through the Resend REST API. |
| `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID`, `NEXT_PUBLIC_ADSENSE_SLOT_*` | build | AdSense (off when blank). |
| `NEXT_PUBLIC_CONSENT_MODE` | build | `builtin` (default) or `google-cmp`. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | build | Enables Plausible analytics (after consent). |

`NEXT_PUBLIC_*` values are inlined into browser JavaScript at **build** time. No secret ever uses that prefix.

## 6. Localization setup

- Routing and localized slugs: `src/i18n/routing.ts` (`pathnames` maps each internal route to one
  slug per language, including Arabic: `/ar/تحميل-ريلز-فيسبوك`). `localePrefix: 'always'`.
- `/` negotiates a language from `Accept-Language`, or from an explicitly stored `NEXT_LOCALE` cookie
  (which next-intl writes only when the visited language differs from the browser default). IP address
  is never used. The language selector is always visible and uses real links.
- `<html lang dir>` is set per locale (`dir="rtl"` for Arabic). Styles use logical properties
  (`ps-*`, `end-*`, `text-start`, …) and a small `.rtl-flip` helper for directional icons. Arabic uses
  Cairo (self-hosted via `@fontsource-variable/cairo`, no request to Google Fonts).
- Metadata, canonical URLs, `hreflang` (+ `x-default` → English) and the sitemap are generated from
  the same route table, so alternates only exist for pages that genuinely exist.
- `npm run check:i18n` verifies identical key structure across languages and flags untranslated strings.
  The unit tests additionally check placeholders, Arabic script, content completeness and link integrity.

## 7. How to add a language

1. Add the code to `locales` (and `rtlLocales` if right-to-left) and a native name to `localeNames` in `src/i18n/routing.ts`.
2. Add a slug for the new language to **every** entry of `pathnames`.
3. Create `messages/<code>.json` (copy `en.json`, translate everything; keep `__BRAND__` and `{placeholders}`).
4. Create `content/<code>/pages/*.md` (9 files) and `content/<code>/blog/*.md` (one per article id; same `id`, new `slug`).
5. Add the OG locale in `src/lib/seo/metadata.ts` and a font if the script needs one (`src/styles/globals.css`).
6. Run `npm run check:i18n && npm test`. The suites fail until every page and article exists in the new language.

Adding an **article**: add `content/<locale>/blog/<file>.md` in every language with front-matter
`id`, `slug`, `title`, `description`, `published` (ISO date). Internal links use `](page:howTo)` /
`](blog:<article-id>)` tokens which are resolved to localized URLs at load time. Do not add an
`updated` date unless you really re-reviewed the article.

## 8. How the extraction provider works

```
browser ──POST /api/extract {url}──▶ origin check → rate limit → size/JSON limits → Zod
                                     → strict URL allowlist + normalisation  (client does the same, server never trusts it)
                                     → short-lived cache / in-flight de-duplication → concurrency limit
                                     → (optional, SSRF-guarded expansion of fb.watch/share links)
                                     → MediaExtractor.resolve()            ← the only provider-specific code
                                     → keep verified formats only (allowlisted MIME, https, not expired)
                                     → seal each upstream URL into an AES-256-GCM, 15-minute download token
browser ──GET /api/download?t=…────▶ rate limit → open token → SSRF-guarded fetch of the sealed URL
                                     → content-type allowlist, size cap → streamed attachment (nothing stored)
```

- `MediaExtractor` (`src/lib/providers/media-extractor.ts`) is the single integration point.
- The destination of a download comes **only** from the sealed token, never from a request parameter,
  so `/api/download` is not an open proxy. Tokens are tamper-evident and expire; failures are `TOKEN_EXPIRED`.
- Error codes: `INVALID_URL`, `UNSUPPORTED_URL`, `CONTENT_UNAVAILABLE`, `PRIVATE_OR_INACCESSIBLE_CONTENT`,
  `NO_SUPPORTED_FORMATS`, `PROVIDER_UNAVAILABLE`, `RATE_LIMITED`, `REQUEST_TIMEOUT`, `TOKEN_EXPIRED`,
  `SERVER_CONFIGURATION_ERROR`, `INTERNAL_ERROR`. The client translates by code; internals never reach responses.
- Without a provider, `/api/extract` returns `503 SERVER_CONFIGURATION_ERROR` for valid links. The UI says
  so. There is no fallback that fabricates a result.

## 9. How to configure the approved provider

No provider has been approved, selected or purchased. Options and trade-offs (decision pending with the owner):

| Option | Pros | Cons / risks |
| --- | --- | --- |
| Paid third-party extraction API | Fastest to launch; vendor maintains extraction | Per-request cost; vendor trust boundary and data handling; verify its terms allow your use; vendor may break or change |
| Self-hosted extraction worker | Full control over data and cost | You maintain it against Facebook changes; needs a long-running host with controlled egress; legal/ToS review is yours |
| Official / authorized integration | Cleanest compliance | Meta does not offer a general public-video download API; usually limited to content you own (e.g. your own Page's uploads) |

Whatever you pick, confirm that it only serves content you are entitled to deliver and never bypasses
privacy settings. To connect it:

1. Make the service speak the [contract](docs/provider-contract.md), or add a vendor class implementing `MediaExtractor`.
2. Set `MEDIA_EXTRACTOR_PROVIDER=http-json`, `MEDIA_EXTRACTOR_BASE_URL`, `MEDIA_EXTRACTOR_API_KEY`
   (and optionally `MEDIA_EXTRACTOR_EXPAND_LINKS=true`, `MEDIA_DOWNLOAD_HOST_ALLOWLIST=<cdn suffixes>`).
3. Set `DOWNLOAD_TOKEN_SECRET`, `NEXT_PUBLIC_SITE_URL`, and a shared rate limiter if you run more than one instance.
4. Test with several **public** videos you are entitled to use, from phone and desktop, including expiry
   and error cases. Only then describe the downloader as working.
5. Review `content/*/pages/privacy-policy.md` and name the provider as a processor.

## 10. How to configure contact form delivery

Delivery uses the Resend REST API (`src/lib/contact.ts`). Set `CONTACT_EMAIL` (where messages go),
`CONTACT_FROM_EMAIL` (a sender verified with Resend) and `CONTACT_PROVIDER_API_KEY`. Optionally set
`NEXT_PUBLIC_CONTACT_EMAIL` to *display* an address on the contact page. Until all three server variables are set the
form answers "not available right now" (`SERVER_CONFIGURATION_ERROR`) and sends nothing. **Delivery has
been tested against a mocked HTTP client only, not against the live Resend service**: send a real test message before launch.
Spam controls: honeypot field, minimum fill time, per-IP rate limit (5/hour), strict validation with
header-injection rejection, same-origin check. For stronger protection add a CAPTCHA/Turnstile
(not implemented).

## 11. How to add AdSense

AdSense is **off** until you set `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` (format `ca-pub-0000000000000000`,
validated; a placeholder is ignored). Approval cannot be guaranteed.

1. Apply for AdSense with the live, HTTPS domain and complete **site verification** (AdSense gives you a snippet or ads.txt method; this app loads the official script only when configured and consented).
2. Set the publisher id and create ad units; put each unit's slot id in `NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL`,
   `_BETWEEN_SECTIONS`, `_IN_ARTICLE`, `_SIDEBAR`, `_ABOVE_FOOTER`. Toggle placements in `src/config/ads.ts`
   (`aboveFooter` is off by default; `sidebar` has no layout using it yet).
3. `/ads.txt` is generated automatically from the publisher id, and returns 404 when none is set. See `docs/ads.txt.template`.
4. Without a configured slot, development shows a clearly labelled "DEV ONLY" placeholder; production renders **nothing**.
5. Placement rules built in: always labelled "Advertisement"; never inside the downloader card; ≥ 4 rem gap from it
   (the e2e suite checks ≥ 150 px); lazy-loaded with reserved height; no overlays, redirects or interstitials.
6. Before applying, walk through the checklist in the delivery report, read the current AdSense program
   policies, and replace every sentence in the legal pages that no longer matches your real setup.

## 12. How to configure consent management

`src/lib/consent/config.ts` derives, from configuration, which optional categories are really active:
Analytics (if `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) and Advertising (if AdSense is configured and consent mode is `builtin`).

- **No optional tracking configured (default):** no banner is shown; the footer's *Cookie settings* dialog
  states that only essential storage is used. Essential storage: `NEXT_LOCALE` cookie, `theme` and `consent.v1` in local storage.
- **Optional tracking configured:** a banner with equal-weight *Reject optional* / *Manage preferences* / *Accept all*;
  scripts load only after consent; preferences are re-openable from the footer.
- **AdSense in the EEA, UK and Switzerland:** Google requires a **Google-certified CMP**. The built-in
  banner is *not* certified. For those audiences set `NEXT_PUBLIC_CONSENT_MODE=google-cmp` and configure
  Google's *Privacy & messaging* (Funding Choices) tool in your AdSense account; the built-in advertising
  toggle is then hidden and the AdSense script is loaded so Google's message can run. This mode has not been tested against Google's CMP.
- Google Consent Mode signals are not implemented (AdSense only, no gtag). If you add Google Analytics or
  other Google tags, implement Consent Mode v2 in `ThirdPartyScripts`.

## 13. How to run tests

```bash
npm run lint
npm run typecheck
npm run check:i18n
npm test                 # Vitest: unit + integration + component tests (≈ 285 tests)
npm run test:e2e         # builds a production bundle, starts it plus a dev server with the mock provider,
                         # runs Playwright on desktop and mobile (Chromium) incl. axe accessibility scans
```

The e2e suite runs the production build **without a provider** (the real default) and a separate dev
server **with the test-only mock** for result-state flows. Mock flows verify UI and download mechanics,
not real downloading.

## 14. How to build for production

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example npm run build
npm start                # next start (binds 0.0.0.0 by default)
```

Standalone alternative (what the Docker image runs): copy `.next/static` to `.next/standalone/.next/static`, `public` to
`.next/standalone/public` and `scripts/start-standalone.mjs` next to `server.js`, then `PORT=3000 node start-standalone.mjs`.
**Do not run `server.js` with `HOSTNAME=127.0.0.1` and do not use `next start -H 127.0.0.1`:** with Next.js 15.5 the
locale middleware's rewrites then become redirects to another origin and every localized route breaks (reproduced
here; `localhost` and `0.0.0.0` work). `start-standalone.mjs` maps `127.0.0.1` to `localhost` for you.

Health check: `GET /api/health` → `{"status":"ok"}` (liveness only; exposes no configuration).

## 15. Vercel deployment

Works for everything except long downloads, with caveats you must verify on your plan:

- `/api/download` streams the file through a serverless function. Function duration, response size and
  bandwidth limits differ by plan; large videos may be cut off. `maxDuration` is set to 300 s in the route and
  is capped by your plan. If this is a problem, use the VPS/Docker route, or return the provider's
  signed URL to the browser instead (not implemented; it would expose upstream URLs).
- The in-memory cache, concurrency limiter and rate limiter are **per instance**. Configure
  `RATE_LIMIT_REST_URL`/`RATE_LIMIT_REST_TOKEN` (Upstash Redis) for an effective global rate limit.
- A heavy extraction worker (headless browser, yt-dlp-style tooling) cannot run in a serverless function;
  host it separately and use `http-json`.
- Set all environment variables in the project settings; `NEXT_PUBLIC_*` changes require a rebuild.

## 16. VPS or Docker deployment

```bash
docker build -t reelsave \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.example .
docker run -d --name reelsave -p 3000:3000 --env-file .env.production reelsave
curl -fsS http://127.0.0.1:3000/api/health
```

Put it behind a TLS-terminating reverse proxy (Caddy, nginx, Traefik) that sets `X-Forwarded-For`/`-Host` and
forwards only to the container. If the proxy is **not** trusted/present set `TRUST_PROXY_HEADERS=false`.
The image runs as a non-root user and ships a `HEALTHCHECK`. The Dockerfile has not been built in this
environment (no Docker daemon available here); the standalone server it runs was tested directly, see the delivery report.

Restrict the container's **egress** to what it needs (Facebook hosts if you expand links, your provider, the
provider's media CDN, Resend) with firewall/proxy rules; this is the strongest SSRF backstop.

## 17. Security considerations

- **URL handling:** exact-host allowlist (`facebook.com`, `www.`, `m.`, `web.`, `fb.watch`), `https` only
  (`http` upgraded), no credentials/ports, no whitespace/control/bidi characters, path patterns per content kind,
  tracking parameters dropped, 2048-character cap. Look-alike, userinfo (`@`), homoglyph and IP/localhost hosts are rejected.
- **SSRF:** `src/lib/security/safe-fetch.ts` allows only https/443, validates the host policy and DNS answers
  before connecting, **re-validates the address actually connected to** (defeats DNS rebinding), follows
  redirects manually with every hop re-checked and a cap, enforces timeouts, and caps response size. Blocks
  loopback, private, CGNAT, link-local/metadata, multicast, reserved, IPv4-mapped/NAT64/6to4/Teredo IPv6.
- **No open proxy:** the download destination is sealed in an AES-256-GCM token; content types are allowlisted;
  filenames are sanitized; `Content-Disposition: attachment`, `nosniff`, `no-store`, restrictive CSP on downloads.
- **Abuse:** per-client rate limits (client IPs are hashed), provider concurrency limit with bounded queue,
  request-body limits, in-flight de-duplication, short result cache, same-origin check + JSON-only content type
  on POST routes (CSRF), honeypot/min-time on the contact form.
- **Headers:** CSP built from the actual config (ad/analytics hosts only when enabled), HSTS and `upgrade-insecure-requests` (only when `NEXT_PUBLIC_SITE_URL` is `https://…`, so plain-HTTP staging keeps working),
  `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP.
  `script-src` needs `'unsafe-inline'` for Next.js bootstrap and the theme script; a per-request nonce would force all
  pages to render dynamically (documented trade-off).
- **Privacy:** no Facebook credentials requested; logs never contain full URLs or raw IPs (host + path hash only);
  no videos stored; errors never expose stack traces.
- **Secrets:** server secrets are only read in server code. `DOWNLOAD_TOKEN_SECRET` is mandatory in production.
  `.env*` is git-ignored except `.env.example`.
- **Dependencies:** `npm audit` reports 0 vulnerabilities at the time of writing (an `overrides` entry pins a patched `postcss`
  under Next.js). Re-run `npm audit` regularly.
- Not implemented: CAPTCHA, WAF, authentication/admin area, abuse dashboards, egress firewalling (infrastructure-level).

## 18. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Downloading is not available on this site right now" | No provider configured (`MEDIA_EXTRACTOR_PROVIDER`). Expected until step 9 is done. |
| 503 with `SERVER_CONFIGURATION_ERROR` in production | Missing/short `DOWNLOAD_TOKEN_SECRET`, mock requested in production, or bad `http-json` URL/key. |
| Canonical/sitemap show `localhost:3000` | `NEXT_PUBLIC_SITE_URL` was not set at **build** time. |
| Everyone shares one rate limit / nobody is limited | Behind a proxy without forwarding IPs, or `TRUST_PROXY_HEADERS` misconfigured; or multiple instances without the REST store. |
| `Error: Page changed from static to dynamic` | Don't call request-scoped next-intl APIs (e.g. `getTranslations()` without a locale) from `generateMetadata` of a not-found boundary. |
| Every page except `/` redirects (307) to `http://localhost:…` | Server started with `HOSTNAME=127.0.0.1` / `next start -H 127.0.0.1`. Use `HOSTNAME=0.0.0.0` or `localhost`, or `start-standalone.mjs`. |
| E2E: port 3100/3101 in use | Another server is running; `reuseExistingServer` would reuse a stale build. Stop it first. |
| Contact form always "not available" | `CONTACT_EMAIL`, `CONTACT_FROM_EMAIL`, `CONTACT_PROVIDER_API_KEY` not all set. |
| Ads never show | Publisher id or slot id missing, consent not given (builtin mode), or an ad blocker. |

## 19. Known limitations

- **Intermittent React hydration warning (#418)** was observed in roughly 1 of 300 page loads under parallel e2e load (3 of 257 tests in two full runs; never in 336+420+144 extra stress loads). It could not be reproduced in dev or isolated, the page works normally (React recovers), and its cause is unidentified. Investigate with a non-minified build if it appears in production logs.
- **No real extraction provider is connected; real downloads are unverified.** The `http-json` adapter is
  only tested against fakes. The mock is test-only.
- Contact delivery (Resend), the REST rate limiter (Upstash-compatible) and the Google CMP mode are
  implemented but untested against the live services.
- No Docker build or Vercel deployment was performed in the authoring environment.
- Lighthouse scores in [`docs/lighthouse-results.md`](docs/lighthouse-results.md) were measured on a local production build without ads/analytics; re-measure on your real domain.
- The 20 articles and legal pages were drafted with AI assistance; they must be read and edited by the
  owner (and legal pages reviewed by a qualified professional) before launch. Arabic/French/Spanish
  were written natively rather than translated word for word, but have **not** been reviewed by native-speaker editors.
- The `sidebar` ad placement has no layout that uses it yet. No analytics events beyond those listed in `src/lib/analytics/track.ts`.
- Provider thumbnails are shown with a plain `<img>` (host unknown at build time) rather than `next/image`.
- Legal pages carry the drafting date (29 October 2026); update them when you launch and whenever your setup changes.

## 20. Replacement of the previous site and rollback

The repository this was built in was **empty** (no commits, no files), so there was no previous
website, database, credentials or infrastructure to remove, migrate or back up, and nothing legacy remains reachable.
For your own production cut-over:

1. Before DNS/traffic switches, keep the old site's deployment and a backup of its configuration and data.
2. Deploy the new app to a staging URL; run the checklist in the delivery report.
3. Switch traffic; keep the previous deployment available. Vercel: "Instant Rollback"; Docker: keep the previous
   image tag (`docker run … reelsave:<previous>`); tag releases in git.
4. Add redirects from any old URLs you want to keep ranking (the app does not ship any, as none were known).
