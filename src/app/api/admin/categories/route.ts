import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { adminCreateCategory, listAdminCategories } from "@/lib/admin";
import { getSession } from "@/lib/session";

/** GET /api/admin/categories — all categories (admin only). */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  try {
    const categories = await listAdminCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/admin/categories — create a category (admin only). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const color = typeof body?.color === "string" && body.color.trim() ? body.color.trim() : "#7a7f87";
  const icon = typeof body?.icon === "string" && body.icon.trim() ? body.icon.trim() : "MapPin";
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  try {
    await adminCreateCategory({ slug, name, color, icon });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
