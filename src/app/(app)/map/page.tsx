import { MapViewClient } from "@/components/map/MapViewClient";
import { SpotCard } from "@/components/SpotCard";
import { listCategories, listSpotsInBbox } from "@/lib/spots";

export const metadata = {
  title: "Map",
  description:
    "Explore spots on a map — filter by category, pan around and see what is nearby.",
};

const RIGA_BBOX = { west: 23.6, south: 56.7, east: 24.6, north: 57.2 };
const RIGA_CENTER: [number, number] = [24.1052, 56.9496];

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; zoom?: string }>;
}) {
  const { lat, lng, zoom } = await searchParams;
  const [categories, initialSpots] = await Promise.all([
    listCategories(),
    listSpotsInBbox({ ...RIGA_BBOX, limit: 200 }),
  ]);

  const latN = Number(lat);
  const lngN = Number(lng);
  const hasTarget = Number.isFinite(latN) && Number.isFinite(lngN);
  const center: [number, number] = hasTarget ? [lngN, latN] : RIGA_CENTER;
  const initialZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : 11;

  return (
    <>
      <div className="h-[calc(100dvh-112px-env(safe-area-inset-bottom,0px))] md:h-dvh">
        <MapViewClient
          initialSpots={initialSpots}
          categories={categories}
          center={center}
          zoom={initialZoom}
          reset={hasTarget}
        />
      </div>

      {/* No-JavaScript / screen-reader fallback list. */}
      <section aria-label="Spots" className="mx-auto w-full max-w-[720px] px-4 py-5">
        <h2 className="sr-only">Spots</h2>
        {initialSpots.length === 0 ? (
          <p className="rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No spots here yet — be the first to add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {initialSpots.map((spot) => (
              <SpotCard key={spot.id} spot={spot} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
