import {
  Baby,
  Coins,
  Coffee,
  Gem,
  Heart,
  Landmark,
  MapPin,
  Moon,
  Mountain,
  Palette,
  PawPrint,
  Trees,
  TriangleAlert,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * The category icon names stored in the database (`categories.icon`) map to Lucide
 * components here. The seed in `drizzle/0002_seed_categories.sql` must stay in sync
 * with these keys — a name missing here falls back to a plain map pin.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Coffee,
  Users,
  Mountain,
  TriangleAlert,
  Gem,
  Moon,
  UtensilsCrossed,
  Heart,
  Palette,
  Landmark,
  Baby,
  PawPrint,
  Trees,
  Coins,
  MapPin,
};

export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? MapPin;
}
