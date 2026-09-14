"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";

/**
 * Mobile: a fixed bottom tab bar with the create action raised in the centre.
 * Desktop: a left sidebar (see AppShell) — this component hides itself at `md`.
 *
 * Safe-area padding keeps it clear of the iOS home indicator.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item, pathname);
          const Icon = item.icon;

          if (item.action) {
            return (
              <li key={item.href} className="flex flex-1 items-center justify-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="mb-3 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-accent-fg shadow-md transition-colors hover:bg-accent-hover active:bg-accent-active"
                >
                  <Icon size={24} strokeWidth={2.75} aria-hidden="true" />
                </Link>
              </li>
            );
          }

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex h-14 flex-col items-center justify-center gap-0.5 transition-colors",
                  active ? "text-accent" : "text-muted hover:text-text",
                ].join(" ")}
              >
                <Icon size={21} strokeWidth={2.75} aria-hidden="true" />
                <span className="text-[10.5px] leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
