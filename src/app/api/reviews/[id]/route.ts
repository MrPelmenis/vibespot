import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { updateReview } from "@/lib/reviews";
import { getSession } from "@/lib/session";

/**
 * PATCH /api/reviews/[id] — edit your review's rating, body and visit date. The author
 * can edit forever; one review per user per spot.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to edit a review" }, { status: 401 });
  }
  const { id } = await params;
  const reviewId = Number.parseInt(id, 10);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    await updateReview(
      reviewId,
      {
        rating: Number(body.rating),
        body: typeof body.body === "string" ? body.body : null,
        visitedOn: typeof body.visitedOn === "string" ? body.visitedOn : null,
      },
      Number(session.userId),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
