import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, formFiles } from "@/lib/api";
import { pool } from "@/db/client";
import { deleteAvatarFile, processAndStoreAvatar } from "@/lib/media";
import { createSession, getSession } from "@/lib/session";

/** POST /api/profile/avatar — upload a new profile picture (multipart, `avatar`). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to change your avatar" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const files = formFiles(form, "avatar");
  if (files.length === 0) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  try {
    const userId = Number(session.userId);
    const { rows } = await pool.query<{ avatar_path: string | null }>(
      `SELECT avatar_path FROM users WHERE id = $1`,
      [userId],
    );
    const oldRel = rows[0]?.avatar_path ?? null;

    const rel = await processAndStoreAvatar(userId, Buffer.from(await files[0].arrayBuffer()));
    await pool.query(`UPDATE users SET avatar_path = $1 WHERE id = $2`, [rel, userId]);
    // Keep the session cookie's avatar in sync, otherwise the header keeps showing the
    // old picture until the next sign-in.
    await createSession({ ...session, avatarPath: rel });

    if (oldRel && oldRel.startsWith("avatars/")) {
      await deleteAvatarFile(oldRel);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
