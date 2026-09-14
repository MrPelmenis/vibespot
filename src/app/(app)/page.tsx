import Link from "next/link";
import { FeedList } from "@/components/FeedList";
import { FooterLinks } from "@/components/FooterLinks";
import { SpotSearch } from "@/components/SpotSearch";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { getSession } from "@/lib/session";
import { FEED_PAGE_SIZE, listCategories, listFollowingSpots, listSpotsByRadius, listTrendingSpots } from "@/lib/spots";

export const metadata = {
  title: "Feed",
  description:
    "Trending spots near you, in your city and worldwide — plus the latest spots from people you follow.",
};

const FEED_TABS = [
  { id: "trending", label: "Trending" },
  { id: "following", label: "Following" },
  { id: "nearby", label: "Nearby" },
] as const;

type FeedTab = (typeof FEED_TABS)[number]["id"];

// Default view: Rīga, 50 km (the spec's fallback when the visitor denies geolocation).
const RIGA = { lat: 56.9496, lng: 24.1052 };
const NEARBY_RADIUS_METERS = 50_000;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; category?: string; sort?: string }>;
}) {
  const { tab, category, sort } = await searchParams;
  const activeTab: FeedTab = FEED_TABS.some((t) => t.id === tab) ? (tab as FeedTab) : "trending";
  const sortBy = sort === "rating" ? "rating" : "recent";
  const [categories, session] = await Promise.all([listCategories(), getSession()]);
  const viewerId = session?.userId ? Number(session.userId) : null;

  let spots: Awaited<ReturnType<typeof listTrendingSpots>> = [];
  if (activeTab === "trending") {
    spots = await listTrendingSpots({ categorySlug: category || undefined, limit: FEED_PAGE_SIZE });
  } else if (activeTab === "nearby") {
    const categoryId = category
      ? categories.find((c) => c.slug === category)?.id
      : undefined;
    spots = await listSpotsByRadius({
      lat: RIGA.lat,
      lng: RIGA.lng,
      radiusMeters: NEARBY_RADIUS_METERS,
      categoryIds: categoryId ? [categoryId] : undefined,
      limit: FEED_PAGE_SIZE,
    });
  } else if (activeTab === "following" && viewerId) {
    spots = await listFollowingSpots(viewerId, FEED_PAGE_SIZE);
  }
  const hasMore = spots.length >= FEED_PAGE_SIZE;

  return (
    <div className="flex flex-col gap-4">
      <SpotSearch />

      {/* Tabs are real links — shareable, crawlable, keyboard accessible. */}
      <nav aria-label="Feed views" className="flex gap-1.5">
        {FEED_TABS.map((item) => (
          <Link
            key={item.id}
            href={feedHref(item.id, category, sortBy)}
            aria-current={item.id === activeTab ? "page" : undefined}
            className={[
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              item.id === activeTab
                ? "bg-accent text-accent-fg"
                : "border border-line text-muted hover:bg-surface-2 hover:text-text",
            ].join(" ")}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {activeTab === "following" ? (
        viewerId ? (
          spots.length === 0 ? (
            <Card className="p-5">
              <CardTitle>Nothing here yet</CardTitle>
              <CardBody>Follow people to see their latest spots here.</CardBody>
            </Card>
          ) : (
            <FeedList
              key={`${activeTab}-${category ?? ""}`}
              initialSpots={spots}
              tab={activeTab}
              hasMore={hasMore}
            />
          )
        ) : (
          <Card className="p-5">
            <CardKicker>Following</CardKicker>
            <CardTitle className="mt-2 text-[22px]">Spots from people you follow</CardTitle>
            <CardBody>
              <a href="/signin" className="font-medium text-accent hover:underline">
                Sign in
              </a>{" "}
              to follow people and see their latest spots here.
            </CardBody>
          </Card>
        )
      ) : (
        <>
          {/* Category filter + sort compose on the list. */}
          <div className="flex flex-col gap-2">
            <div
              className="flex gap-1.5 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Filter by category"
            >
              <FilterLink
                href={feedHref(activeTab, undefined, sortBy)}
                active={!category}
                label="All"
              />
              {categories.map((c) => (
                <FilterLink
                  key={c.id}
                  href={feedHref(activeTab, c.slug, sortBy)}
                  active={category === c.slug}
                  label={c.name}
                  color={c.color}
                />
              ))}
            </div>

            <div className="flex gap-1.5" role="group" aria-label="Sort">
              <SortLink
                href={feedHref(activeTab, category, "recent")}
                active={sortBy === "recent"}
                label="Recent"
              />
              <SortLink
                href={feedHref(activeTab, category, "rating")}
                active={sortBy === "rating"}
                label="Highest rated"
              />
            </div>
          </div>

          {spots.length === 0 ? (
            <Card className="p-5">
              <CardTitle>No spots match</CardTitle>
              <CardBody>
                Nothing here with the current filters yet. Clear a filter, or be the first to add a
                spot.
              </CardBody>
            </Card>
          ) : (
            <FeedList
              key={`${activeTab}-${category ?? ""}`}
              initialSpots={spots}
              tab={activeTab}
              category={category}
              hasMore={hasMore}
            />
          )}
        </>
      )}

      <FooterLinks />
    </div>
  );
}

function feedHref(tab: FeedTab, category?: string, sort?: string): string {
  const params = new URLSearchParams();
  if (tab !== "trending") params.set("tab", tab);
  if (category) params.set("category", category);
  if (sort && sort !== "recent") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

function FilterLink({
  href,
  active,
  label,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className="shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
      style={
        active
          ? color
            ? { backgroundColor: color, borderColor: color, color: "#fff" }
            : { backgroundColor: "var(--accent)", borderColor: "var(--accent)", color: "var(--accent-fg)" }
          : undefined
      }
    >
      {label}
    </Link>
  );
}

function SortLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={[
        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
