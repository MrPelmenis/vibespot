import Link from "next/link";

/** Footer links shown on the home and profile pages. */
export function FooterLinks() {
  return (
    <footer className="pb-6 pt-2 text-center">
      <div className="flex justify-center gap-4 text-[12px] text-faint">
        <Link href="/about" className="transition-colors hover:text-text">
          About
        </Link>
        <Link href="/terms" className="transition-colors hover:text-text">
          Terms of Service
        </Link>
        <Link href="/privacy" className="transition-colors hover:text-text">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
