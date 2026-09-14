import { SpotList } from "@/components/SpotList";
import { listSpots } from "@/lib/spots";

type Props = { params: Promise<{ city: string }> };

export async function generateMetadata({ params }: Props) {
  const { city } = await params;
  const name = decodeCity(city);
  return {
    title: name,
    description: `Spots in ${name} on CoolSpot.`,
  };
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  const name = decodeCity(city);
  const spots = await listSpots({ city: name, sort: "recent" });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-[22px] text-text">{name}</h1>
        <p className="mt-0.5 text-[13px] text-muted">Spots in {name}.</p>
      </div>
      <SpotList spots={spots} empty={`No spots in ${name} yet.`} />
    </div>
  );
}

/** URL slug → human name (hyphens become spaces; diacritics are matched via unaccent). */
function decodeCity(slug: string): string {
  return slug.replace(/-/g, " ");
}
