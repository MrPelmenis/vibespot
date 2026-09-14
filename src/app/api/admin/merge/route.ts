import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { mergeSpots } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** POST /api/admin/merge — merge source spot into target spot (admin only). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    await mergeSpots(Number(body.targetId), Number(body.sourceId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
