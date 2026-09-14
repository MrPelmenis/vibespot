import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { getSession } from "@/lib/session";
import { toggleFollow } from "@/lib/social";

/** POST /api/users/[id]/follow — toggle following a user. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to follow people" }, { status: 401 });
  }
  const { id } = await params;
  const followeeId = Number.parseInt(id, 10);

  try {
    const result = await toggleFollow(Number(session.userId), followeeId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
