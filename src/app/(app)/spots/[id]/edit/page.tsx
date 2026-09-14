import Link from "next/link";
import { notFound } from "next/navigation";
import { SpotForm } from "@/components/spots/SpotForm";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { getSession } from "@/lib/session";
import { getSpotById, listCategories } from "@/lib/spots";

export const metadata = {
  title: "Edit spot",
  robots: { index: false, follow: true },
};

export default async function EditSpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  const [session, spot, categories] = await Promise.all([
    getSession(),
    Number.isInteger(spotId) ? getSpotById(spotId) : Promise.resolve(null),
    listCategories(),
  ]);

  if (!spot) notFound();

  const isOwner =
    session?.userId != null &&
    (session.isAdmin || spot.createdBy === Number(session.userId));

  if (!isOwner) {
    return (
      <Card className="mx-auto mt-6 max-w-md p-6">
        <CardKicker>Access</CardKicker>
        <CardTitle className="mt-2 text-[22px]">You cannot edit this spot</CardTitle>
        <CardBody>
          Only the person who added a spot (or an admin) can edit it. Deleting is
          admin-only, so a spot&apos;s history is never lost.
        </CardBody>
        <div className="mt-4">
          <Link
            href={`/spot/${spot.slug}`}
            className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm text-text transition-colors hover:bg-surface-2"
          >
            Back to the spot
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-heading text-[22px] text-text">Edit spot</h1>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Editing changes the content, not the address — the URL stays the same.
      </p>
      <SpotForm categories={categories} spot={spot} />
    </div>
  );
}
