import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { createReply } from "@/lib/reviews";
import { getSession } from "@/lib/session";

/** POST /api/reviews/[id]/replies — reply to a review. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to reply" }, { status: 401 });
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
    await createReply(reviewId, Number(session.userId), String(body.body ?? ""));
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
