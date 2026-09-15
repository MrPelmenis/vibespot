import { NextResponse, type NextRequest } from "next/server";
import {
  googleClientId,
  googleClientSecret,
  redirectUriFor,
  requestOrigin,
  verifyGoogleIdToken,
} from "@/lib/google";
import { cookieDomain, createSession, secureCookies } from "@/lib/session";
import { upsertUserByIdentity } from "@/lib/users";

/**
 * Google OAuth callback.
 *
 * Order of operations, deliberately:
 *   1. Validate `state` against the cookie (CSRF).
 *   2. Exchange the code for tokens, using the PKCE verifier.
 *   3. Verify the ID token's signature, issuer and audience ourselves.
 *   4. Persist identity from the `sub` claim only.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);
  const params = request.nextUrl.searchParams;

  if (params.get("error")) {
    return failure(origin, params.get("error") ?? "google_error");
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("coolspot_oauth_state")?.value;
  const verifier = request.cookies.get("coolspot_oauth_verifier")?.value;

  if (!code) return failure(origin, "missing_code");
  if (!state || !expectedState || state !== expectedState) return failure(origin, "bad_state");
  if (!verifier) return failure(origin, "missing_verifier");

  let idToken: string;
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: redirectUriFor(origin),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      console.error("Google token exchange failed:", tokenResponse.status);
      return failure(origin, "token_exchange_failed");
    }

    const tokens = (await tokenResponse.json()) as { id_token?: string };
    if (!tokens.id_token) return failure(origin, "no_id_token");
    idToken = tokens.id_token;
  } catch (error) {
    console.error("Google token exchange error:", error);
    return failure(origin, "token_exchange_error");
  }

  try {
    const identity = await verifyGoogleIdToken(idToken);

    // Persist (or refresh) the user row, keyed on the verified `sub`. The session
    // then carries the real Postgres id — still never an email or id from the client.
    const user = await upsertUserByIdentity(identity);
    await createSession({
      userId: String(user.id),
      googleSub: user.googleSub,
      nickname: user.nickname,
      avatarPath: user.avatarPath,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    console.error("Sign-in failed:", error);
    return failure(origin, "signin_failed");
  }

  const response = NextResponse.redirect(new URL("/", origin));
  deleteOauthCookies(response);
  return response;
}

function failure(origin: string, reason: string) {
  const url = new URL("/signin", origin);
  url.searchParams.set("error", reason);
  const response = NextResponse.redirect(url);
  deleteOauthCookies(response);
  return response;
}

function deleteOauthCookies(response: NextResponse): void {
  const options = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    domain: cookieDomain(),
  };
  response.cookies.set("coolspot_oauth_state", "", options);
  response.cookies.set("coolspot_oauth_verifier", "", options);
}
