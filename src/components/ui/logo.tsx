import { brand } from '@/config/brand';

/** Original mark: rounded square with a play triangle and a download arrow base line. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="rs-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rs-g)" />
      <path
        d="M12 8.5v10.2c0 .8.9 1.3 1.6.9l7.6-5.1c.6-.4.6-1.3 0-1.7l-7.6-5.1c-.7-.4-1.6.1-1.6.8Z"
        fill="#fff"
        transform="translate(-1 -1.5)"
      />
      <path d="M10 24h12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight">{brand.name}</span>
    </span>
  );
}
