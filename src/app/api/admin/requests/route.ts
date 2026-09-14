import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { listSpotRequests } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** GET /api/admin/requests?status=open — spot delete/edit requests (admin only). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const status = request.nextUrl.searchParams.get("status") ?? "open";
  try {
    const requests = await listSpotRequests(status);
    return NextResponse.json({ requests });
  } catch (error) {
    return errorResponse(error);
  }
}
