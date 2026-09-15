import "server-only";

import type { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifies a Google ID token server-side against Google's published JWKS.
 *
 * We verify `aud` (the token was minted for OUR client id), `iss` (Google) and the
 * signature. Only then is the `sub` claim trustworthy — and `sub` is the identity we
 * persist. Email is treated as mutable profile data, never as a key.
 */

const GOOGLE_JWKS = new URL("https://www.googleapis.com/oauth2/v3/certs");
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Cached by jose across requests; fetched once and refreshed on key rotation.
const jwks = createRemoteJWKSet(GOOGLE_JWKS);

export type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export function googleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error(
      "GOOGLE_CLIENT_ID is not set. Create an OAuth 2.0 Web client in Google Cloud " +
        "Console and put the id in .env.local.",
    );
  }
  return id;
}

export function googleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not set. Put it in .env.local — server-side only.");
  }
  return secret;
}

/** Verifies an ID token offline against Google's JWKS. Throws on any mismatch. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: googleClientId(),
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Google ID token had no subject claim");
  }

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/** Derives the callback URL from the request itself, so dev/staging/prod all work. */
export function redirectUriFor(origin: string): string {
  return new URL("/api/auth/google/callback", origin).toString();
}

/**
 * The canonical origin for OAuth redirects. `request.nextUrl.origin` is unreliable in
 * the standalone server (it reflects the HOSTNAME bind address, e.g. 0.0.0.0), so
 * prefer the configured SITE_URL and fall back to the request origin.
 */
export function requestOrigin(request: NextRequest): string {
  const site = process.env.SITE_URL;
  if (site) return site.replace(/\/+$/, "");
  return request.nextUrl.origin;
}

/** True when `origin` is the same site as `expected`, ignoring a `www.` prefix. */
export function isSameOrigin(origin: string, expected: string): boolean {
  try {
    const a = new URL(origin);
    const b = new URL(expected);
    const hostA = a.hostname.replace(/^www\./, "");
    const hostB = b.hostname.replace(/^www\./, "");
    return a.protocol === b.protocol && hostA === hostB;
  } catch {
    return false;
  }
}

/** How long an OAuth `state` cookie stays valid — the whole round trip, nothing more. */
export const OAUTH_STATE_MAX_AGE_SECONDS = 600;
