import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session = a signed, HttpOnly cookie holding our own claims.
 *
 * The single most important rule in this codebase lives here: `userId` and
 * `googleSub` are written ONLY from a verified Google ID token's `sub` claim. They
 * are never read from a request body, query string or header. The legacy app keyed
 * every write on a client-supplied `userEmail`, which let any signed-in user read,
 * edit and delete anyone else's data — do not reintroduce that shape.
 */

const COOKIE_NAME = "coolspot_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type Session = {
  /** Primary key in our own `users` table. Null until the user row is created. */
  userId: string | null;
  /** Google's stable subject identifier — the real account key. */
  googleSub: string;
  nickname: string | null;
  avatarPath: string | null;
  isAdmin: boolean;
};

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Generate one with:\n" +
        "  openssl rand -base64 32\n" +
        "and put it in .env.local (never commit it).",
    );
  }
  return new TextEncoder().encode(value);
}

export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.googleSub !== "string") return null;

    return {
      userId: typeof payload.userId === "string" ? payload.userId : null,
      googleSub: payload.googleSub,
      nickname: typeof payload.nickname === "string" ? payload.nickname : null,
      avatarPath: typeof payload.avatarPath === "string" ? payload.avatarPath : null,
      isAdmin: payload.isAdmin === true,
    };
  } catch {
    return null; // expired, tampered with, or signed with an old secret
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
