import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FilterChip, SortLink } from "@/components/FilterChips";
import { SpotList } from "@/components/SpotList";
import { listCategories, listSpots } from "@/lib/spots";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: `${category.name} spots on CoolSpot.`,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: Props & { searchParams: Promise<{ sort?: string }> }) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const sortBy = sort === "rating" ? "rating" : "recent";

  const [categories, spots] = await Promise.all([
    listCategories(),
    listSpots({ categorySlug: slug, sort: sortBy }),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const href = (catSlug?: string, s?: string) => {
    const params = new URLSearchParams();
    if (s && s !== "recent") params.set("sort", s);
    const qs = params.toString();
    const base = catSlug ? `/category/${catSlug}` : "/spots";
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-[22px] text-text">
          <CategoryIcon name={category.icon} size={20} style={{ color: category.color }} />
          {category.name}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">Every {category.name} spot.</p>
      </div>

      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5"
        role="group"
        aria-label="Filter by category"
      >
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            href={href(c.slug, sortBy)}
            active={c.slug === slug}
            color={c.color}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      <div className="flex gap-1.5" role="group" aria-label="Sort">
        <SortLink href={href(slug, "recent")} active={sortBy === "recent"}>
          Recent
        </SortLink>
        <SortLink href={href(slug, "rating")} active={sortBy === "rating"}>
          Highest rated
        </SortLink>
      </div>

      <SpotList spots={spots} empty={`No ${category.name} spots yet.`} />
    </div>
  );
}
