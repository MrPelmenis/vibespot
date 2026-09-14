"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AccountControls } from "@/components/AccountControls";

/**
 * One shell for both layouts.
 *
 * Mobile  — sticky top bar, scrolling content, fixed bottom tab bar.
 * Desktop — persistent left sidebar, centred content column.
 *
 * The map page is full-bleed: its content must fill the viewport edge-to-edge rather
 * than the centred, padded column the other pages use.
 */
export function AppShell({
  nickname,
  isSignedIn,
  children,
}: {
  nickname?: string | null;
  isSignedIn: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const fullBleed = pathname === "/map";

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar
        authSlot={<AccountControls isSignedIn={isSignedIn} nickname={nickname} compact />}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar nickname={nickname} />

        <main
          className={
            fullBleed
              ? "flex-1"
              : "mx-auto w-full max-w-[720px] flex-1 px-4 pt-4"
          }
          style={
            fullBleed
              ? undefined
              : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }
          }
        >
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
