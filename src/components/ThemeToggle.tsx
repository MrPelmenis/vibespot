"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

function subscribe(onChange: () => void) {
  // Re-read when the stored preference changes, from this or another tab.
  window.addEventListener("storage", onChange);
  window.addEventListener("coolspot-theme-change", onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("coolspot-theme-change", onChange);
    mq.removeEventListener("change", onChange);
  };
}

/** The *visible* theme — reads the class the boot script already applied, so the icon
 *  always matches reality and there is no confusing "system" (PC) state to show. */
function readIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * A plain light/dark toggle. The stored value may still be "system" from before, but
 * the toggle always lands on an explicit light/dark — the icon simply reflects what is
 * currently on screen.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);

  const toggle = useCallback(() => {
    const next = isDark ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    const dark = next === "dark";
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    window.dispatchEvent(new Event("coolspot-theme-change"));
  }, [isDark]);

  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={[
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "text-muted transition-colors hover:bg-surface-2 hover:text-text",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Icon size={18} strokeWidth={2.75} aria-hidden="true" />
    </button>
  );
}
