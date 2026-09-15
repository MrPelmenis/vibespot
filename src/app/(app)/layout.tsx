import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";

/**
 * Authenticated-area layout. Everything inside this group renders inside the app
 * shell (top bar + bottom tabs on mobile, sidebar on desktop).
 *
 * Reading the session here rather than fetching it from the client means the shell
 * renders correctly in the first HTML response — which is the whole point of the
 * rebuild, so it applies to the shell too, not just the spot pages.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <AppShell
      nickname={session?.nickname ?? null}
      avatarPath={session?.avatarPath ?? null}
      isSignedIn={Boolean(session)}
    >
      {children}
    </AppShell>
  );
}
