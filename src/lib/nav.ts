import type { LucideIcon } from "lucide-react";
import { Home, Map, Plus, Trophy, User } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The centre action is rendered as an elevated accent button, not a tab. */
  action?: boolean;
  /** Highlight as active when the path starts with this prefix. */
  matchPrefixes?: string[];
};

/**
 * The five slots from the design decisions: Home · Map · [+] · Leaderboard · Profile.
 * There is no messaging in this product, so the middle slot is the create action —
 * the owners explicitly asked for an Instagram-style centre "+".
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, matchPrefixes: ["/spots"] },
  { href: "/map", label: "Map", icon: Map, matchPrefixes: ["/map"] },
  { href: "/spots/new", label: "Add a spot", icon: Plus, action: true },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy, matchPrefixes: ["/leaderboard"] },
  { href: "/profile", label: "Profile", icon: User, matchPrefixes: ["/profile", "/u"] },
];

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.action) return false;
  if (item.href === "/") return pathname === "/";
  return (item.matchPrefixes ?? [item.href]).some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}
