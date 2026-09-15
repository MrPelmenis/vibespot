import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { adminDeleteReview, adminUpdateReview } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** DELETE /api/admin/reviews/[id] — hard-delete a review (admin only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  try {
    await adminDeleteReview(Number.parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/admin/reviews/[id] — edit a review's rating/body (admin only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  try {
    await adminUpdateReview(
      Number.parseInt(id, 10),
      rating,
      typeof body?.body === "string" ? body.body : null,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
