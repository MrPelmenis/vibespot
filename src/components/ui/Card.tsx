import type { ReactNode } from "react";

/**
 * Surface-filled content card — the base for spot cards, review rows and
 * profile blocks. Composed of kicker / title / body / meta parts.
 */
export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "article" | "li" | "section";
}) {
  return (
    <Tag
      className={[
        "rounded-md border border-line bg-surface shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

export function CardKicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
      {children}
    </p>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={["font-heading text-[17px] text-text", className].filter(Boolean).join(" ")}>
      {children}
    </h3>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="text-[13px] leading-relaxed text-muted">{children}</div>;
}

export function CardMeta({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
      {children}
    </div>
  );
}

/** Small tinted label — used for categories and statuses. */
export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "accent-2" | "outline";
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-tint text-accent",
    "accent-2": "bg-accent-2-tint text-accent-2",
    outline: "border border-line text-muted",
  } as const;

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
        tones[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
