"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { avatarUrl } from "@/lib/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Mobile top bar: the current destination's name plus theme and account controls.
 * The title comes from the nav config so it can never drift from the tab label.
 */
const TITLES: { prefix: string; title: string }[] = [
  { prefix: "/map", title: "Map" },
  { prefix: "/spots/new", title: "Add a spot" },
  { prefix: "/spots", title: "Spots" },
  { prefix: "/category", title: "Category" },
  { prefix: "/city", title: "City" },
  { prefix: "/leaderboard", title: "Leaderboard" },
  { prefix: "/profile", title: "My Profile" },
  { prefix: "/u", title: "Profile" },
];

export function TopBar({
  nickname,
  avatarPath,
  isSignedIn,
}: {
  nickname?: string | null;
  avatarPath?: string | null;
  isSignedIn?: boolean;
}) {
  const pathname = usePathname();
  const title = TITLES.find((t) => pathname.startsWith(t.prefix))?.title ?? "CoolSpot";
  const avatar = avatarUrl(avatarPath ?? null);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2" aria-label="CoolSpot home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/marker.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
        />
      </Link>

      <h1 className="font-heading text-[19px] text-text">{title}</h1>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/profile"
          aria-label="Profile"
          title={nickname ?? "Sign in"}
          className="inline-flex h-9 items-center rounded-full transition-colors hover:bg-surface-2 hover:text-text"
        >
          {isSignedIn ? (
            avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-tint font-heading text-[13px] text-accent">
                {(nickname ?? "?").charAt(0).toUpperCase()}
              </span>
            )
          ) : (
            <span className="px-3 text-[13px] font-medium text-muted">Sign in</span>
          )}
        </Link>
      </div>
    </header>
  );
}
