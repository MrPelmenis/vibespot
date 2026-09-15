/**
 * Shared, serialisable shapes passed between server components and client
 * components. No `server-only` import here — client components consume these types
 * too, so they must be plain data (Dates are pre-converted to ISO strings).
 */

export type CategorySummary = {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string;
};

export type SpotMediaSummary = {
  id: number;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  kind: "image" | "video";
  durationS: string | null;
  status: string;
};

export type SpotSummary = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  status: string;
  openingHours: { text?: string } | null;
  /** String from Postgres `numeric`; NULL means zero reviews — never shown then. */
  ratingAvg: string | null;
  ratingCount: number;
  visitCount: number;
  saveCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  creatorNickname: string | null;
  creatorAvatar: string | null;
  categories: CategorySummary[];
  primaryCategory: CategorySummary | null;
  media: SpotMediaSummary[];
  /** Representative image: the spot's own first photo, else the first photo of the
   *  top review. Null when there are no photos at all. `id` + `fromReview` let the
   *  spot page open the shared media viewer at the right item. */
  cover: {
    id: number;
    fromReview: boolean;
    url: string;
    thumbUrl: string;
    width: number;
    height: number;
  } | null;
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

export type ReverseGeocodeResult = {
  address: string;
  city: string | null;
};

export type ReviewMediaSummary = {
  id: number;
  kind: "image" | "video";
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  durationS: string | null;
  status: string;
};

export type ReviewReplySummary = {
  id: number;
  userId: number | null;
  nickname: string | null;
  avatarPath: string | null;
  body: string;
  createdAt: string;
};

export type ReviewSummary = {
  id: number;
  spotId: number;
  userId: number | null;
  nickname: string | null;
  avatarPath: string | null;
  rating: number;
  body: string | null;
  visitedOn: string | null;
  helpfulCount: number;
  createdAt: string;
  updatedAt: string;
  votedByMe: boolean;
  media: ReviewMediaSummary[];
  replies: ReviewReplySummary[];
};

export type ReviewDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export type SpotReviewState = {
  savedByMe: boolean;
  visitedToday: boolean;
  myReviewId: number | null;
};
