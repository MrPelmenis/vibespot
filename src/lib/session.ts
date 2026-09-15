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

/**
 * Whether auth cookies should be `Secure`. The standalone server always sees plain
 * HTTP (nginx terminates TLS), so NODE_ENV is the wrong signal — derive it from the
 * canonical origin instead. This also keeps `npm run start:prod` working over
 * http://localhost during local testing.
 */
export function secureCookies(): boolean {
    return (process.env.SITE_URL ?? "").startsWith("https://");
}

/**
 * Cookie domain: the registrable host from SITE_URL with any leading "www." stripped,
 * so the session is shared between `coolspot.lv` and `www.coolspot.lv`. Returns
 * undefined for localhost/IP so the cookie stays host-only there.
 */
export function cookieDomain(): string | undefined {
    const site = process.env.SITE_URL;
    if (!site) return undefined;
    try {
        let host = new URL(site).hostname;
        if (host === "localhost" || host.startsWith("127.") || host.startsWith("::1")) return undefined;
        if (host.startsWith("www.")) host = host.slice(4);
        return host;
    } catch {
        return undefined;
    }
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
        secure: secureCookies(),
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE_SECONDS,
        domain: cookieDomain(),
    });
}

export async function getSession(): Promise<Session | null> {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
        if (typeof payload.googleSub !== "string") return null;
        // A session without a real user id is a stale/pre-user cookie. Treat it as signed
        // out so every consumer (shell, spot page, /profile, /signin) agrees — otherwise
        // one view says "signed in" while another says "sign in".
        if (typeof payload.userId !== "string" || payload.userId.length === 0) return null;
        if (typeof payload.nickname !== "string" || payload.nickname.length === 0) return null;

        return {
            userId: payload.userId,
            googleSub: payload.googleSub,
            nickname: payload.nickname,
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
