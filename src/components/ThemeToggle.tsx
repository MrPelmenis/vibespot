"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

const LABELS: Record<ThemeChoice, string> = {
  system: "Theme: follow system",
  light: "Theme: light",
  dark: "Theme: dark",
};

function subscribe(onChange: () => void) {
  // Re-read when the stored preference changes from this or another tab.
  window.addEventListener("storage", onChange);
  window.addEventListener("coolspot-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("coolspot-theme-change", onChange);
  };
}

function readStored(): ThemeChoice {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function apply(choice: ThemeChoice) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = choice === "dark" || (choice === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Cycles system → light → dark.
 *
 * The stored choice is read through `useSyncExternalStore` rather than copied into
 * state from an effect: it is already an external store, and this reads it without a
 * cascading render or a hydration mismatch. The pre-paint script in `lib/theme.ts` has
 * already applied the theme by the time this runs, so there is no flash either way.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const choice = useSyncExternalStore(
    subscribe,
    readStored,
    () => "system" as ThemeChoice, // server snapshot: must match the first client render
  );

  // Always flip to the opposite of what is *currently visible*. "system" is only the
  // first-visit default — once clicked, the choice becomes an explicit light/dark, so
  // every click visibly changes the theme. (The old three-way cycle's first step,
  // system → light, looked like a no-op when the OS was already light.)
  const cycle = useCallback(() => {
    const current = readStored();
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const currentlyDark = current === "dark" || (current === "system" && prefersDark);
    const next: ThemeChoice = currentlyDark ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    apply(next);
    window.dispatchEvent(new Event("coolspot-theme-change"));
  }, []);

  const Icon = choice === "light" ? Sun : choice === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABELS[choice]}. Activate to change.`}
      title={LABELS[choice]}
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
