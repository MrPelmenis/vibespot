import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { pool } from "@/db/client";
import { getSession } from "@/lib/session";

const TARGET_TYPES = ["spot", "review", "user"];

/** POST /api/reports — report a spot, review or user (no pre-approval; admins act later). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to report" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const targetType = String(body.targetType ?? "");
  const targetId = Number(body.targetId);
  if (!TARGET_TYPES.includes(targetType) || !Number.isInteger(targetId)) {
    return NextResponse.json({ error: "Invalid report target" }, { status: 400 });
  }

  try {
    await pool.query(
      `INSERT INTO reports (target_type, target_id, reporter_id, reason) VALUES ($1, $2, $3, $4)`,
      [targetType, targetId, Number(session.userId), typeof body.reason === "string" ? body.reason : null],
    );
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
