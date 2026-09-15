import Link from "next/link";
import { Star } from "lucide-react";
import { CategoryChip } from "@/components/CategoryChip";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SpotImage } from "@/components/SpotImage";
import type { SpotSummary } from "@/lib/types";

/**
 * A compact spot card for lists — thumbnail, name, city and category chips. The whole
 * card links to the permanent /spot/<slug> page.
 */
function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `/media/${path}`;
}

export function SpotCard({ spot }: { spot: SpotSummary }) {
  const primary = spot.primaryCategory;
  const cover = spot.cover;
  const creatorAvatar = avatarUrl(spot.creatorAvatar);
  const hasRating = spot.reviewCount > 0 && spot.ratingAvg != null;
  const rating = hasRating ? Number(spot.ratingAvg).toFixed(1) : null;

  return (
    <li>
      <Link
        href={`/spot/${spot.slug}`}
        className="flex gap-3 rounded-md border border-line bg-surface p-3 shadow-sm transition-colors hover:bg-surface-2"
      >
        {cover ? (
          <SpotImage
            url={cover.url}
            thumbUrl={cover.thumbUrl}
            width={cover.width}
            height={cover.height}
            alt={`${spot.name} — cover photo`}
            className="h-20 w-20 shrink-0 rounded-md object-cover washed"
          />
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `${primary?.color ?? "#7a7f87"}1f` }}
          >
            <CategoryIcon
              name={primary?.icon ?? "MapPin"}
              size={26}
              style={{ color: primary?.color }}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-heading text-[15px] text-text">{spot.name}</h3>
            {rating ? (
              <span className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-star">
                <Star size={12} strokeWidth={2.75} aria-hidden="true" className="fill-star" />
                {rating}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12px] text-muted">{spot.city ?? spot.address ?? "—"}</p>
          {spot.creatorNickname ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
              {creatorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatorAvatar} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-full object-cover" />
              ) : null}
              <span className="truncate">by {spot.creatorNickname}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-faint">Community spot</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {spot.categories.map((c) => (
              <CategoryChip key={c.id} category={c} />
            ))}
          </div>
        </div>
      </Link>
    </li>
  );
}
