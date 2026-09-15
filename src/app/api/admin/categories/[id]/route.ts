import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { adminDeleteCategory } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** DELETE /api/admin/categories/[id] — delete a category (admin only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  try {
    await adminDeleteCategory(Number.parseInt(id, 10));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
