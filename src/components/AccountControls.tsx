"use client";

import { LogIn, LogOut } from "lucide-react";

/**
 * Sign in / sign out control. Sign-out is a real form POST to a server route —
 * never a GET link — so it cannot be triggered by a prefetch or a stray image tag.
 */
export function AccountControls({
  isSignedIn,
  nickname,
  compact = false,
}: {
  isSignedIn: boolean;
  nickname?: string | null;
  compact?: boolean;
}) {
  if (!isSignedIn) {
    return (
      <a
        href="/api/auth/google"
        className={[
          "inline-flex items-center gap-1.5 rounded-full bg-accent font-heading text-accent-fg",
          "transition-colors hover:bg-accent-hover active:bg-accent-active",
          compact ? "h-9 px-3 text-[13px]" : "h-10 px-4 text-sm",
        ].join(" ")}
      >
        <LogIn size={16} strokeWidth={2.75} aria-hidden="true" />
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {!compact && nickname ? (
        <span className="max-w-[10rem] truncate text-[13px] text-muted">{nickname}</span>
      ) : null}
      <form action="/api/auth/signout" method="post">
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <LogOut size={16} strokeWidth={2.75} aria-hidden="true" />
          {compact ? null : <span>Sign out</span>}
        </button>
      </form>
    </div>
  );
}
