import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { createSession, getSession } from "@/lib/session";
import { updateProfile } from "@/lib/users";

/** PATCH /api/profile — update your own display name and/or description. */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to edit your profile" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    const nickname = typeof body.nickname === "string" && body.nickname.trim()
      ? body.nickname
      : undefined;
    const { nickname: finalNickname } = await updateProfile(Number(session.userId), {
      description: typeof body.description === "string" ? body.description : null,
      nickname,
    });

    // Keep the session cookie's display name in sync so /profile and the header
    // follow the new name immediately.
    if (finalNickname !== session.nickname) {
      await createSession({ ...session, nickname: finalNickname });
    }

    return NextResponse.json({ ok: true, nickname: finalNickname });
  } catch (error) {
    return errorResponse(error);
  }
}
