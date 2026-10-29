import { cn } from '@/lib/cn';

export function Section({ title, intro, children, className, id }: { title: string; intro?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className={cn('container-page py-12 sm:py-16', className)}>
      <div className="mx-auto max-w-[var(--container-prose)] text-center">
        <h2 id={id ? `${id}-h` : undefined} className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {intro && <p className="mt-3 text-muted">{intro}</p>}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}
