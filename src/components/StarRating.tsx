import { Star } from "lucide-react";

/**
 * Read-only star rating. Whole stars only (rounded) — the spec's average display
 * rounds to a single star value, and no rating is ever shown for zero reviews.
 */
export function StarRating({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.round(value);
  return (
    <span
      className={["inline-flex items-center gap-0.5", className].filter(Boolean).join(" ")}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={2.75}
          aria-hidden="true"
          className={i <= filled ? "fill-star text-star" : "text-faint"}
        />
      ))}
    </span>
  );
}
