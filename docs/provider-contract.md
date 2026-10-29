# Extraction provider contract (`MEDIA_EXTRACTOR_PROVIDER=http-json`)

`http-json` is a **generic adapter**, not a specific vendor integration. It lets you plug in a
self-hosted service (for example a small worker you operate) or a vendor API behind a thin
translation layer. It is tested in this repository only against a fake endpoint (see
`tests/unit/providers.test.ts`). No real extraction service has been connected or verified.

## Request

`POST {MEDIA_EXTRACTOR_BASE_URL}` with headers `content-type: application/json`,
`accept: application/json` and, if `MEDIA_EXTRACTOR_API_KEY` is set, `authorization: Bearer <key>`.

```json
{ "url": "https://www.facebook.com/reel/1234567890" }
```

The URL has already been validated against the strict allowlist and normalized. With
`MEDIA_EXTRACTOR_EXPAND_LINKS=true`, `fb.watch` and `/share/` links are first expanded through the
SSRF-guarded fetcher so the provider receives a canonical URL.

## Success response (HTTP 200)

```json
{
  "title": "optional string",
  "thumbnail": "https://… (optional, https only)",
  "duration": 42,
  "formats": [
    {
      "id": "hd",
      "type": "video",
      "quality": "HD",
      "mimeType": "video/mp4",
      "size": 1048576,
      "url": "https://cdn.example.com/…",
      "expiresAt": "2030-01-01T00:00:00Z"
    }
  ]
}
```

- `title`, `thumbnail`, `duration`, `mimeType`, `size`, `expiresAt` are optional. **Omit what you
  do not know**: the UI shows nothing rather than inventing values.
- `type` is `video` or `audio`. Only return `audio` when you genuinely, and lawfully, offer it.
- `url` must be `https`. Formats with other schemes are dropped. The URL never reaches the browser:
  it is sealed inside an encrypted, expiring download token.
- Allowed MIME types: `video/mp4`, `video/webm`, `video/quicktime`, `audio/mpeg`, `audio/mp4`,
  `audio/aac`, `audio/webm`. Anything else is dropped.
- An empty `formats` array (or one that is empty after filtering) yields `NO_SUPPORTED_FORMATS`.

## Error responses (non-2xx)

```json
{ "error": { "code": "PRIVATE_OR_INACCESSIBLE_CONTENT" } }
```

Recognised codes: `PRIVATE_OR_INACCESSIBLE_CONTENT`, `CONTENT_UNAVAILABLE`, `NO_SUPPORTED_FORMATS`,
`UNSUPPORTED_URL`. HTTP 401/403 without a recognised code is treated as *our* credentials being
wrong (`SERVER_CONFIGURATION_ERROR`); 429 and everything else becomes `PROVIDER_UNAVAILABLE`.
Timeouts become `REQUEST_TIMEOUT`.

## Trust boundary

- The provider receives only the normalized Facebook URL. It must never be sent cookies or tokens.
- The provider is responsible for fetching from Facebook. Apply the controls described in the main
  README (egress restrictions, no credentials, timeouts) on that service.
- Media URLs returned by the provider are fetched by `/api/download` through the SSRF-guarded fetcher
  (https only, no private/loopback/link-local addresses, validated redirects, size cap). Restrict
  hosts further with `MEDIA_DOWNLOAD_HOST_ALLOWLIST`.

## Adding a vendor-specific provider

Implement `MediaExtractor` (`src/lib/providers/media-extractor.ts`), return a `ProviderMedia`, add a
`case` in `src/lib/providers/index.ts`, and add tests next to `tests/unit/providers.test.ts`.
Use `AppError` with a code from `src/lib/errors.ts` for every failure; never throw raw errors.
