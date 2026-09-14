import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { toggleReviewVote } from "@/lib/reviews";
import { getSession } from "@/lib/session";

/** POST /api/reviews/[id]/vote — toggle a "helpful" vote. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to vote" }, { status: 401 });
  }
  const { id } = await params;
  const reviewId = Number.parseInt(id, 10);

  try {
    const result = await toggleReviewVote(reviewId, Number(session.userId));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
