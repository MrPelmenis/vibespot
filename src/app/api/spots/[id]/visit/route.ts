import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { markVisit } from "@/lib/reviews";
import { getSession } from "@/lib/session";

/** POST /api/spots/[id]/visit — mark that you visited (deduped once per day). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to mark a visit" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  try {
    const result = await markVisit(spotId, Number(session.userId));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
