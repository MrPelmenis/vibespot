import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { destroySession, getSession } from "@/lib/session";
import { deleteAccount } from "@/lib/users";

/**
 * POST /api/profile/delete — delete your account. Contributions are identity-stripped
 * (not cascade-deleted), private data is removed, and the session is destroyed.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to delete your account" }, { status: 401 });
  }

  try {
    await deleteAccount(Number(session.userId));
    await destroySession();
    const response = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
