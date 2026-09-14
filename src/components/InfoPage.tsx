import type { ReactNode } from "react";

/** Shared page scaffold for About / Terms / Privacy. */
export function InfoPage({
  title,
  subtitle,
  updated,
  children,
}: {
  title: string;
  subtitle?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[680px]">
      <header className="border-b border-line pb-4">
        <h1 className="font-heading text-[24px] text-text">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-muted">{subtitle}</p> : null}
        {updated ? <p className="mt-2 text-[12px] text-faint">Last updated {updated}</p> : null}
      </header>
      <div className="mt-6 flex flex-col gap-7">{children}</div>
    </div>
  );
}

/** A titled block inside a legal/info page. */
export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-heading text-[16px] text-text">{title}</h2>
      <div className="mt-2 flex flex-col gap-2.5 text-[14px] leading-relaxed text-text">{children}</div>
    </section>
  );
}

/** A simple bulleted list; each item is a React node. */
export function InfoList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-text">
          <span aria-hidden="true" className="mt-px shrink-0 text-accent">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
