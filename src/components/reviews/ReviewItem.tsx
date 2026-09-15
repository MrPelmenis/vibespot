import Link from "next/link";
import { MediaGallery } from "@/components/MediaGallery";
import { ReportButton } from "@/components/ReportButton";
import { StarRating } from "@/components/StarRating";
import { AdminReviewControls } from "@/components/admin/AdminReviewControls";
import type { ReviewSummary } from "@/lib/types";
import { ReplyForm } from "@/components/reviews/ReplyForm";

function avatarUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `/media/${path}`;
}

/** A single review row: stars, author, body, photos/video and replies. */
export function ReviewItem({
  review,
  isSignedIn,
  isAdmin = false,
}: {
  review: ReviewSummary;
  isSignedIn: boolean;
  isAdmin?: boolean;
}) {
  const avatar = avatarUrl(review.avatarPath);

  return (
    <li className="rounded-md border border-line bg-surface p-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-tint font-heading text-[12px] text-accent">
            {(review.nickname ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-text">
            {review.nickname ? (
              <Link
                href={`/u/${encodeURIComponent(review.nickname)}`}
                className="transition-colors hover:text-accent"
              >
                {review.nickname}
              </Link>
            ) : (
              "Former user"
            )}
          </span>
          <span className="flex items-center gap-2">
            <StarRating value={review.rating} size={12} />
          </span>
        </div>
      </div>

      {review.body ? (
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{review.body}</p>
      ) : null}

      {review.media.length > 0 ? (
        <div className="mt-3">
          <MediaGallery
            items={review.media.map((media) => ({
              id: `review-${media.id}`,
              kind: media.kind,
              url: media.url,
              thumbUrl: media.thumbUrl,
              width: media.width,
              height: media.height,
              alt: "Review media",
              status: media.status,
            }))}
          />
        </div>
      ) : null}

      {review.replies.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 border-l-2 border-line pl-3">
          {review.replies.map((reply) => (
            <li key={reply.id} className="text-[13px] leading-relaxed">
              {reply.nickname ? (
                <Link
                  href={`/u/${encodeURIComponent(reply.nickname)}`}
                  className="font-medium text-text transition-colors hover:text-accent"
                >
                  {reply.nickname}
                </Link>
              ) : (
                <span className="font-medium text-text">Former user</span>
              )}
              <span className="text-muted"> · {reply.body}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isSignedIn ? (
        <div className="mt-3">
          <ReplyForm reviewId={review.id} />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ReportButton targetType="review" targetId={review.id} />
        {isAdmin ? (
          <AdminReviewControls
            reviewId={review.id}
            initialRating={review.rating}
            initialBody={review.body}
          />
        ) : null}
      </div>
    </li>
  );
}
