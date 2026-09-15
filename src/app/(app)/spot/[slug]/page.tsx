import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Map as MapIcon, Pencil } from "lucide-react";
import { CategoryChip } from "@/components/CategoryChip";
import { SortLink } from "@/components/FilterChips";
import { MediaGallery, MediaViewerProvider } from "@/components/MediaGallery";
import { ReportButton } from "@/components/ReportButton";
import { StarRating } from "@/components/StarRating";
import { ButtonLink } from "@/components/ui/Button";
import { DistributionBar } from "@/components/reviews/DistributionBar";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewItem } from "@/components/reviews/ReviewItem";
import { SpotActions } from "@/components/reviews/SpotActions";
import { getSession } from "@/lib/session";
import { slugify } from "@/lib/slug";
import { getSpotBySlug } from "@/lib/spots";
import { getSpotReviewState, listReviewDistribution, listReviews } from "@/lib/reviews";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const spot = await getSpotBySlug(slug);
  if (!spot) return { title: "Spot not found" };

  const base = (process.env.SITE_URL ?? "https://coolspot.lv").replace(/\/$/, "");
  const description = (spot.description ?? `${spot.name} on CoolSpot.`).slice(0, 160);
  const cover = spot.cover;

  return {
    title: spot.name,
    description,
    openGraph: {
      title: spot.name,
      description,
      type: "website",
      url: `${base}/spot/${spot.slug}`,
      ...(cover
        ? { images: [{ url: `${base}${cover.url}`, width: cover.width, height: cover.height, alt: spot.name }] }
        : {}),
    },
  };
}

export default async function SpotPage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ sort?: string }> }) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const reviewSort = sort === "rating" ? "rating" : "recent";

  const [spot, session] = await Promise.all([getSpotBySlug(slug), getSession()]);
  if (!spot) notFound();

  const viewerId = session?.userId ? Number(session.userId) : null;
  const isSignedIn = viewerId != null;
  const isOwner =
    viewerId != null && (session!.isAdmin || spot.createdBy === viewerId);

  const [reviews, distribution, state] = await Promise.all([
    listReviews(spot.id, { sort: reviewSort, viewerId }),
    listReviewDistribution(spot.id),
    viewerId
      ? getSpotReviewState(spot.id, viewerId)
      : Promise.resolve({ savedByMe: false, visitedToday: false, myReviewId: null }),
  ]);

  const myReview = viewerId && state.myReviewId ? reviews.find((r) => r.id === state.myReviewId) ?? null : null;
  const hasRating = spot.reviewCount > 0;
  const avg = hasRating && spot.ratingAvg != null ? Number(spot.ratingAvg) : 0;

  // The spot's own media, shown in its own grid…
  const mainItems = spot.media.map((media, index) => ({
    id: `spot-${media.id}`,
    kind: media.kind,
    url: media.url,
    thumbUrl: media.thumbUrl,
    width: media.width,
    height: media.height,
    alt: `${spot.name} — ${media.kind === "video" ? "video" : `photo ${index + 1}`}`,
    status: media.status,
  }));
  // …and the combined list (main + every review) that the shared viewer navigates.
  const galleryItems = [
    ...mainItems,
    ...reviews.flatMap((review) =>
      review.media.map((media) => ({
        id: `review-${media.id}`,
        kind: media.kind,
        url: media.url,
        thumbUrl: media.thumbUrl,
        width: media.width,
        height: media.height,
        alt: `${review.nickname ?? "Reviewer"} — review media`,
        status: media.status,
      })),
    ),
  ];

  return (
    <article className="mx-auto max-w-[720px]">
      <MediaViewerProvider items={galleryItems}>
      <header>
        <h1 className="font-heading text-[26px] text-text">{spot.name}</h1>
        {spot.categories.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {spot.categories.map((category) => (
              <CategoryChip key={category.id} category={category} />
            ))}
          </div>
        ) : null}
        {(spot.city || spot.address) && (
          <p className="mt-2 text-[13px] text-muted">
            {spot.city ? (
              <Link href={`/city/${slugify(spot.city)}`} className="transition-colors hover:text-text">
                {spot.city}
              </Link>
            ) : null}
            {spot.city && spot.address ? " · " : null}
            {spot.address}
          </p>
        )}
        <p className="mt-2 text-[13px] text-muted">
          {spot.creatorNickname ? (
            <>
              Added by{" "}
              <Link
                href={`/u/${encodeURIComponent(spot.creatorNickname)}`}
                className="font-medium text-text transition-colors hover:text-accent"
              >
                {spot.creatorNickname}
              </Link>
            </>
          ) : (
            "Community-owned spot"
          )}
        </p>
      </header>

      {mainItems.length > 0 ? (
        <div className="mt-4">
          <MediaGallery items={mainItems} />
        </div>
      ) : spot.cover ? (
        <div className="mt-4">
          {/* Fallback: spot has no own photos — show the top review's photo as cover. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={spot.cover.url}
            alt={`${spot.name} — cover photo`}
            className="aspect-video w-full rounded-md border border-line object-cover washed"
          />
        </div>
      ) : (
        <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-line bg-surface-2 text-[13px] text-muted">
          No photos yet — be the first to add one.
        </div>
      )}

      {/* Quick actions, just below the media */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ButtonLink href={`/map?lat=${spot.lat}&lng=${spot.lng}&zoom=15`} variant="secondary" size="sm">
          <MapIcon size={14} strokeWidth={2.75} aria-hidden="true" />
          View on map
        </ButtonLink>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lng}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] text-text transition-colors hover:bg-surface-2"
        >
          <ExternalLink size={14} strokeWidth={2.75} aria-hidden="true" />
          Google Maps
        </a>
      </div>

      {/* Rating + actions */}
      <section className="mt-4 rounded-md border border-line bg-surface p-4">
        {hasRating ? (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-[34px] leading-none text-text">{avg.toFixed(1)}</span>
                <StarRating value={avg} size={18} />
              </div>
              <p className="mt-1 text-[12px] text-muted">
                {spot.reviewCount} {spot.reviewCount === 1 ? "review" : "reviews"}
                {spot.visitCount > 0 ? ` · ${spot.visitCount} visits` : ""}
              </p>
            </div>
            <DistributionBar distribution={distribution} total={spot.reviewCount} />
          </div>
        ) : (
          <p className="text-[13px] text-muted">No reviews yet — be the first to rate this spot.</p>
        )}

        <div className="mt-3">
          <SpotActions
            spotId={spot.id}
            saved={state.savedByMe}
            visitedToday={state.visitedToday}
            isSignedIn={isSignedIn}
          />
        </div>
      </section>

      {spot.description ? (
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-text">
          {spot.description}
        </p>
      ) : null}

      {spot.openingHours?.text ? (
        <div className="mt-4">
          <h2 className="font-heading text-[15px] text-text">Opening hours</h2>
          <p className="mt-1 text-[14px] text-text">{spot.openingHours.text}</p>
        </div>
      ) : null}

      {/* Reviews list */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-[18px] text-text">Reviews</h2>
          <div className="flex gap-1.5" role="group" aria-label="Sort reviews">
            <SortLink href={`/spot/${spot.slug}`} active={reviewSort === "recent"}>
              Recent
            </SortLink>
            <SortLink href={`/spot/${spot.slug}?sort=rating`} active={reviewSort === "rating"}>
              Highest
            </SortLink>
          </div>
        </div>

        {reviews.length === 0 ? (
          <p className="mt-3 rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No reviews yet — write the first one below.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {reviews.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                isSignedIn={isSignedIn}
                isAdmin={session?.isAdmin === true}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Review form (below the list, so "edit your review" reads in context) */}
      <section className="mt-6">
        {isSignedIn ? (
          <ReviewForm
            spotId={spot.id}
            review={
              myReview
                ? {
                    id: myReview.id,
                    rating: myReview.rating,
                    body: myReview.body,
                    media: myReview.media,
                  }
                : null
            }
          />
        ) : (
          <p className="rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            <a href="/signin" className="font-medium text-accent hover:underline">
              Sign in
            </a>{" "}
            to write a review, save this spot or mark that you visited.
          </p>
        )}
      </section>

      <footer className="mt-6 flex flex-wrap items-center gap-2">
        {isOwner ? (
          <ButtonLink href={`/spots/${spot.id}/edit`} variant="secondary" size="sm">
            <Pencil size={14} strokeWidth={2.75} aria-hidden="true" />
            Edit this spot
          </ButtonLink>
        ) : null}
        <ReportButton targetType="spot" targetId={spot.id} />
      </footer>
      </MediaViewerProvider>
    </article>
  );
}
