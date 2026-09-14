import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { toggleSaveSpot } from "@/lib/reviews";
import { getSession } from "@/lib/session";

/** POST /api/spots/[id]/save — toggle the "want to go" save. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to save a spot" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  try {
    const result = await toggleSaveSpot(spotId, Number(session.userId));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
