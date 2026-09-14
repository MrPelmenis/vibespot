import { CategoryIcon } from "@/components/CategoryIcon";
import type { CategorySummary } from "@/lib/types";

/**
 * A category chip tinted with the category's own colour — used on spot cards, the
 * detail page and map popups. The colour is data (from the DB), so it is applied as
 * an inline style rather than a theme token.
 */
export function CategoryChip({ category }: { category: CategorySummary }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color: category.color, backgroundColor: `${category.color}1f` }}
    >
      <CategoryIcon name={category.icon} size={12} />
      {category.name}
    </span>
  );
}
