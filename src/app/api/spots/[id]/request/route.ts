import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { pool } from "@/db/client";
import { getSession } from "@/lib/session";

const KINDS = ["delete", "edit"];

/**
 * POST /api/spots/[id]/request — request that a spot be deleted (or edited). Non-admins
 * cannot delete spots themselves; this lands in the admin queue.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to request changes" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const kind = String(body.kind ?? "");
  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid request kind" }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO spot_requests (kind, spot_id, user_id, payload) VALUES ($1, $2, $3, $4)`,
      [kind, spotId, Number(session.userId), body.payload ?? null],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
