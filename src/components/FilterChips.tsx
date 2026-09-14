import Link from "next/link";
import type { ReactNode } from "react";

/** A pill filter link (category chip / "All"), tinted with the category colour. */
export function FilterChip({
  href,
  active,
  color,
  children,
}: {
  href: string;
  active: boolean;
  color?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      className="shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
      style={
        active
          ? color
            ? { backgroundColor: color, borderColor: color, color: "#fff" }
            : { backgroundColor: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-fg)" }
          : undefined
      }
    >
      {children}
    </Link>
  );
}

/** A small sort toggle link (Recent / Highest rated). */
export function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-pressed={active}
      className={[
        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
