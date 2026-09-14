import { Star } from "lucide-react";
import type { ReviewDistribution } from "@/lib/types";

/** The 1–5 star distribution bar on the spot page. */
export function DistributionBar({
  distribution,
  total,
}: {
  distribution: ReviewDistribution;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      {([5, 4, 3, 2, 1] as const).map((star) => (
        <div key={star} className="flex items-center gap-2 text-[12px] text-muted">
          <span className="w-3 text-right">{star}</span>
          <Star size={11} strokeWidth={2.75} aria-hidden="true" className="fill-star text-star" />
          <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-star"
              style={{ width: total > 0 ? `${(distribution[star] / total) * 100}%` : "0%" }}
            />
          </div>
          <span className="w-5 tabular-nums">{distribution[star]}</span>
        </div>
      ))}
    </div>
  );
}
