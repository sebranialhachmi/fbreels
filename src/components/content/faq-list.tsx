import { ChevronDown } from 'lucide-react';

export type FaqItem = { q: string; a: string };

/** Native <details> accordion: keyboard and screen-reader accessible without JavaScript. */
export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-start font-semibold marker:content-none hover:bg-subtle [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
