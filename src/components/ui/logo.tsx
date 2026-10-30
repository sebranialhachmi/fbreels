import { brand } from '@/config/brand';

/** Original mark: rounded square with a calculator-style grid. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="eos-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#eos-g)" />
      <rect x="8" y="6.5" width="16" height="6" rx="1.8" fill="#fff" />
      <g fill="#fff">
        <rect x="8" y="15" width="4.4" height="4.4" rx="1.2" />
        <rect x="13.8" y="15" width="4.4" height="4.4" rx="1.2" />
        <rect x="19.6" y="15" width="4.4" height="4.4" rx="1.2" />
        <rect x="8" y="21" width="4.4" height="4.4" rx="1.2" />
        <rect x="13.8" y="21" width="4.4" height="4.4" rx="1.2" />
        <rect x="19.6" y="21" width="4.4" height="4.4" rx="1.2" opacity=".7" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark />
      <span className="text-base font-extrabold leading-tight tracking-tight sm:text-lg">
        {brand.name}
      </span>
    </span>
  );
}
