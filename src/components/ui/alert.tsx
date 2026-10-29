import * as React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'error' | 'success' | 'info' | 'warning';
const tones: Record<Tone, string> = {
  error: 'border-danger/40 bg-danger-bg text-danger-text',
  success: 'border-success/40 bg-success-bg text-success',
  info: 'border-border bg-subtle text-fg',
  warning: 'border-warning-text/30 bg-warning-bg text-warning-text',
};
const icons = { error: AlertCircle, success: CheckCircle2, info: Info, warning: AlertCircle };

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: Tone; title?: string }) {
  const Icon = icons[tone];
  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      className={cn('flex gap-3 rounded-control border p-4 text-sm', tones[tone], className)}
      {...props}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
