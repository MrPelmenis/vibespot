"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

function subscribe(onChange: () => void) {
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

function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

/** The *effective* dark state — from the stored choice, falling back to the OS. */
function readIsDark(): boolean {
  const choice = readChoice();
  if (choice === "dark") return true;
  if (choice === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(choice: ThemeChoice): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = choice === "dark" || (choice === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * A plain light/dark toggle. The stored value may still be "system" from before, but
 * the toggle always lands on an explicit light/dark.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);

  // Defensive: re-apply the stored theme on mount. The pre-paint boot script normally
  // does this already (so no flash); this just covers any page that skipped it.
  useEffect(() => {
    applyTheme(readChoice());
  }, []);

  const toggle = useCallback(() => {
    const next: ThemeChoice = isDark ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
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
