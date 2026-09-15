import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { adminSetAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { deleteAccount } from "@/lib/users";

/** DELETE /api/admin/users/[id] — identity-strip a user (admin only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const targetId = Number.parseInt(id, 10);
  if (targetId === Number(session.userId)) {
    return NextResponse.json(
      { error: "You can't delete your own account from the admin tool" },
      { status: 400 },
    );
  }

  try {
    await deleteAccount(targetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/admin/users/[id] — toggle a user's admin flag (admin only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  if (!session.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const { id } = await params;
  const targetId = Number.parseInt(id, 10);
  if (targetId === Number(session.userId)) {
    return NextResponse.json({ error: "You can't change your own admin flag" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    await adminSetAdmin(targetId, body?.isAdmin === true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
