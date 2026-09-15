import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardBody, CardKicker, CardTitle } from "@/components/ui/Card";
import { getSession } from "@/lib/session";

/** Human-readable messages for the failure reasons the callback can emit. */
const ERRORS: Record<string, string> = {
  bad_state: "The sign-in attempt expired or did not match. Please try again.",
  missing_code: "Google did not return an authorization code. Please try again.",
  missing_verifier: "The sign-in session was lost. Please try again.",
  token_exchange_failed: "Google rejected the sign-in. Check the client id and secret.",
  token_exchange_error: "Could not reach Google. Please try again.",
  no_id_token: "Google did not return an identity token.",
  invalid_id_token: "The identity token failed verification. This has been logged.",
  signin_failed: "Sign-in could not be completed. Please try again in a moment.",
  google_not_configured:
    "Google sign-in isn't configured yet — add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the server.",
  google_error: "Google reported an error for this sign-in.",
};

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, session] = await Promise.all([searchParams, getSession()]);
  // Already signed in — don't show "You are signed in" next to an OAuth error.
  if (session) redirect("/");
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <Card className="mx-auto mt-6 max-w-md p-6">
      <CardKicker>Account</CardKicker>
      <CardTitle className="mt-2 text-[22px]">
        {session ? "You are signed in" : "Sign in to CoolSpot"}
      </CardTitle>

      <CardBody>
        {session
          ? "You already have an account, so adding spots, writing reviews and saving places is available. Browsing never required it — the map, spot pages and reviews are readable logged out."
          : "Browsing is open to everyone. Sign in with Google to add spots, write starred reviews, upload photos and videos, follow people and save places."}
      </CardBody>

      {message ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-danger"
        >
          {message}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {session ? (
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent font-heading text-sm text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Go to the feed
          </Link>
        ) : (
          <a
            href="/api/auth/google"
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent font-heading text-sm text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Continue with Google
          </a>
        )}

        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full border border-line-strong text-sm text-text transition-colors hover:bg-surface-2"
        >
          Not now
        </Link>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-faint">
        Signing in only ever stores the identity Google attests to — your account subject id,
        display name and avatar. We never trust a name or email sent by the browser.
      </p>
    </Card>
  );
}
