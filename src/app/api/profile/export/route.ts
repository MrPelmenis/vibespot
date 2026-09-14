import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getSession } from "@/lib/session";
import { exportUserData } from "@/lib/users";

/** GET /api/profile/export — GDPR data export (JSON download). */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to export your data" }, { status: 401 });
  }

  try {
    const data = await exportUserData(Number(session.userId));
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="coolspot-export.json"',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
