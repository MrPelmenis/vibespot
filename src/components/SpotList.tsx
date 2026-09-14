import { SpotCard } from "@/components/SpotCard";
import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import type { SpotSummary } from "@/lib/types";

/** A column of spot cards, with a single empty-state card when there is nothing. */
export function SpotList({ spots, empty }: { spots: SpotSummary[]; empty: string }) {
  if (spots.length === 0) {
    return (
      <Card className="p-5">
        <CardTitle>Nothing here yet</CardTitle>
        <CardBody>{empty}</CardBody>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {spots.map((spot) => (
        <SpotCard key={spot.id} spot={spot} />
      ))}
    </ul>
  );
}
