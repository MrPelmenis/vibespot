import { SpotForm } from "@/components/spots/SpotForm";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { getSession } from "@/lib/session";
import { listCategories } from "@/lib/spots";

export const metadata = {
  title: "Add a spot",
  description: "Drop a pin, describe the place and add photos.",
};

export default async function NewSpotPage() {
  const [session, categories] = await Promise.all([getSession(), listCategories()]);

  if (!session?.userId) {
    return (
      <Card className="mx-auto mt-6 max-w-md p-6">
        <CardKicker>Contribute</CardKicker>
        <CardTitle className="mt-2 text-[22px]">Sign in to add a spot</CardTitle>
        <CardBody>
          Anyone can browse the map, but adding a spot needs a Google account so you can
          come back and edit it later.
        </CardBody>
        <div className="mt-5">
          <a
            href="/api/auth/google"
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-5 font-heading text-sm text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Continue with Google
          </a>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-heading text-[22px] text-text">Add a spot</h1>
      <p className="mb-4 mt-1 text-[13px] text-muted">
        Drop a pin, choose up to three categories and add photos.
      </p>
      <SpotForm categories={categories} />
    </div>
  );
}
