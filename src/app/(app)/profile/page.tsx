import { redirect } from "next/navigation";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "My Profile",
  description: "Your spots, your reviews and your saved places.",
};

export default async function ProfilePage() {
  const session = await getSession();
  if (session?.nickname) {
    redirect(`/u/${encodeURIComponent(session.nickname)}`);
  }

  return (
    <Card className="mx-auto mt-6 max-w-md p-6">
      <CardKicker>You</CardKicker>
      <CardTitle className="mt-2 text-[22px]">Sign in to see your profile</CardTitle>
      <CardBody>
        Your spots, your reviews and your saved places live here once you sign in with Google.
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
