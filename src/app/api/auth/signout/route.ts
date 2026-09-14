import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/google";
import { destroySession } from "@/lib/session";

/**
 * Sign-out. A POST (never a GET) so it cannot be triggered by a stray link or
 * prefetch, and same-origin so another site cannot log the user out. The origin check
 * uses the canonical SITE_URL rather than `request.nextUrl.origin`, which in the
 * standalone server reflects the bind address (0.0.0.0) instead of the public host.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== requestOrigin(request)) {
    return NextResponse.json({ error: "cross-origin sign-out rejected" }, { status: 403 });
  }

  await destroySession();
  return NextResponse.redirect(new URL("/", requestOrigin(request)), { status: 303 });
}
