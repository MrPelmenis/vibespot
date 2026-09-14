import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { actionSpotRequest } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** POST /api/admin/requests/[id] — approve or deny a spot request (admin only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  const action = body.action === "denied" ? "denied" : "approved";

  try {
    await actionSpotRequest(Number.parseInt(id, 10), Number(session.userId), action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
