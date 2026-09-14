import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Global 404 — rendered with the theme tokens (no app shell), with quick links back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-heading text-[64px] leading-none text-accent">404</p>
      <h1 className="font-heading text-[20px] text-text">This page doesn&apos;t exist</h1>
      <p className="max-w-sm text-[13px] text-muted">
        The spot or page you&apos;re looking for may have moved, or the link is wrong.
      </p>
      <div className="mt-2 flex gap-2">
        <ButtonLink href="/" size="md">
          Go home
        </ButtonLink>
        <Link
          href="/map"
          className="inline-flex h-9 items-center rounded-full border border-line-strong px-4 text-sm text-text transition-colors hover:bg-surface-2"
        >
          Open the map
        </Link>
      </div>
    </div>
  );
}
