import { createElement, type CSSProperties } from "react";
import { MapPin } from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/categories";

/**
 * A stable component that renders the Lucide icon for a category *name* (the string
 * stored in `categories.icon`). The lookup happens here, inside a stable component,
 * so callers never create a component during render — which keeps the React compiler's
 * static-component lint happy and the icon rendering consistent.
 */
export function CategoryIcon({
  name,
  size = 16,
  strokeWidth = 2.75,
  color,
  className,
  style,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const icon = CATEGORY_ICONS[name] ?? MapPin;
  return createElement(icon, {
    size,
    strokeWidth,
    color,
    className,
    style,
    "aria-hidden": true,
  });
}
