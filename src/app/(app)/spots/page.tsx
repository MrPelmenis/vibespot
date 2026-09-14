import { FilterChip, SortLink } from "@/components/FilterChips";
import { SpotList } from "@/components/SpotList";
import { listCategories, listSpots } from "@/lib/spots";

export const metadata = {
  title: "Spots",
  description: "Browse every spot on CoolSpot — filter by category and sort by recency or rating.",
};

export default async function SpotsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort } = await searchParams;
  const sortBy = sort === "rating" ? "rating" : "recent";
  const [categories, spots] = await Promise.all([
    listCategories(),
    listSpots({ categorySlug: category || undefined, sort: sortBy }),
  ]);

  const href = (cat?: string, s?: string) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (s && s !== "recent") params.set("sort", s);
    const qs = params.toString();
    return qs ? `/spots?${qs}` : "/spots";
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-[22px] text-text">All spots</h1>
        <p className="mt-0.5 text-[13px] text-muted">Every place on CoolSpot.</p>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Filter by category"
      >
        <FilterChip href={href(undefined, sortBy)} active={!category}>
          All
        </FilterChip>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            href={href(c.slug, sortBy)}
            active={category === c.slug}
            color={c.color}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Sort">
        <SortLink href={href(category, "recent")} active={sortBy === "recent"}>
          Recent
        </SortLink>
        <SortLink href={href(category, "rating")} active={sortBy === "rating"}>
          Highest rated
        </SortLink>
      </div>

      <SpotList spots={spots} empty="No spots match. Be the first to add one." />
    </div>
  );
}
