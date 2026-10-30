import { brand } from '@/config/brand';

/** Original mark: rounded square with a calculator-style grid. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="eos-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#eos-bg)" />
      <rect x="17" y="10" width="30" height="44" rx="6" fill="#fff" />
      <rect x="21.5" y="15" width="21" height="9" rx="2.5" fill="#1E3A8A" />
      <g fill="#2563EB">
        <rect x="21.5" y="28" width="6" height="6" rx="1.8" />
        <rect x="29" y="28" width="6" height="6" rx="1.8" />
        <rect x="36.5" y="28" width="6" height="6" rx="1.8" />
        <rect x="21.5" y="36.5" width="6" height="6" rx="1.8" />
        <rect x="29" y="36.5" width="6" height="6" rx="1.8" />
      </g>
      <rect x="36.5" y="36.5" width="6" height="14.5" rx="1.8" fill="#7C3AED" />
      <circle cx="47" cy="46" r="10.5" fill="#F59E0B" stroke="#fff" strokeWidth="3" />
      <path d="M42.6 46.2l3 3 5.2-6" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
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
