const MIME_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
  // Test-only provider output. Never produced by a real provider.
  'text/plain': 'txt',
};

export const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

export function extensionForMime(mime: string): string | null {
  return MIME_EXTENSIONS[mime.toLowerCase().split(';')[0]!.trim()] ?? null;
}

/**
 * Builds an ASCII-safe filename from untrusted text: strips path separators, control
 * characters, quotes and anything that could break a header. Always returns something usable.
 */
export function safeFilename(
  title: string | null | undefined,
  quality: string,
  mime: string,
  brand = 'video',
): string {
  const ext = extensionForMime(mime) ?? 'bin';
  const base = (title ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '') // drop non-ASCII (keeps header + filesystem portability)
    .replace(/[\\/:*?"<>|%;\r\n\t]+/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 60)
    .trim();
  const q = quality.replace(/[^A-Za-z0-9._-]+/g, '').slice(0, 12);
  const name = [base || brand, q].filter(Boolean).join('-').replace(/\s/g, '_');
  return `${name}.${ext}`;
}

/** Content-Disposition value with an ASCII fallback and RFC 5987 encoded name. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
