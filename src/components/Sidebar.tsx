"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Desktop navigation — the same five destinations as the mobile tab bar, but as a
 * persistent left sidebar. This is the "extend the mobile design to desktop"
 * decision: same information architecture, layout adapted.
 */
export function Sidebar({ authSlot }: { authSlot?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2"
      >
        {/* The CoolSpot mark stays a single swappable asset (see README). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marker.png"
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 object-contain"
        />
        <span className="font-heading text-[22px] leading-none text-text">CoolSpot</span>
      </Link>

      <nav aria-label="Main" className="flex-1">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[15px] transition-colors",
                    active
                      ? "bg-accent-tint font-semibold text-accent"
                      : "text-text hover:bg-surface-2",
                  ].join(" ")}
                >
                  <Icon size={21} strokeWidth={2.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
        <ThemeToggle />
        {authSlot}
      </div>
    </aside>
  );
}
