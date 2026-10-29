export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function formatSize(bytes: number, locale: string): string {
  const mb = bytes / (1024 * 1024);
  const fmt = (unit: 'megabyte' | 'kilobyte', value: number, digits: number) =>
    new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: digits,
    }).format(value);
  return mb >= 1
    ? fmt('megabyte', mb, mb >= 100 ? 0 : 1)
    : fmt('kilobyte', Math.max(1, bytes / 1024), 0);
}

export function formatTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}
