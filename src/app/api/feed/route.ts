import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { getSession } from "@/lib/session";
import {
  FEED_PAGE_SIZE,
  listCategories,
  listFollowingSpots,
  listSpotsByRadius,
  listTrendingSpots,
} from "@/lib/spots";
import type { SpotSummary } from "@/lib/types";

/** Same fallback the feed page uses when the visitor denies geolocation. */
const RIGA = { lat: 56.9496, lng: 24.1052 };
const NEARBY_RADIUS_METERS = 50_000;

/**
 * GET /api/feed?tab=&category=&offset= — one more page of the feed, mirroring the
 * server-rendered first page. Powers the infinite scroll sentinel.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tab = params.get("tab") ?? "trending";
  const category = params.get("category") ?? undefined;
  const offset = clampOffset(params.get("offset"));

  try {
    let spots: SpotSummary[] = [];
    if (tab === "following") {
      const session = await getSession();
      const viewerId = session?.userId ? Number(session.userId) : null;
      spots = viewerId ? await listFollowingSpots(viewerId, FEED_PAGE_SIZE, offset) : [];
    } else if (tab === "nearby") {
      const categoryId = category
        ? (await listCategories()).find((c) => c.slug === category)?.id
        : undefined;
      spots = await listSpotsByRadius({
        lat: RIGA.lat,
        lng: RIGA.lng,
        radiusMeters: NEARBY_RADIUS_METERS,
        categoryIds: categoryId ? [categoryId] : undefined,
        limit: FEED_PAGE_SIZE,
        offset,
      });
    } else {
      spots = await listTrendingSpots({ categorySlug: category, limit: FEED_PAGE_SIZE, offset });
    }
    return NextResponse.json({ spots });
  } catch (error) {
    return errorResponse(error);
  }
}

function clampOffset(raw: string | null): number {
  const n = Number.parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
