import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_STATE_MAX_AGE_SECONDS,
  googleClientId,
  redirectUriFor,
  requestOrigin,
} from "@/lib/google";
import { cookieDomain, secureCookies } from "@/lib/session";

/**
 * Starts the Google sign-in flow.
 *
 * We use the plain OAuth 2.0 authorization-code flow with PKCE, then verify the ID
 * token ourselves on the callback. No client secret ever reaches the browser and no
 * third-party auth SDK sits between us and the claims we persist.
 */
export async function GET(request: NextRequest) {
  const origin = requestOrigin(request);

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const url = new URL("/signin", origin);
    url.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(url);
  }

  // `state` defends against CSRF on the callback; `verifier` is the PKCE secret.
  const state = crypto.randomUUID();
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const challenge = base64UrlEncode(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );

  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", googleClientId());
  authorizeUrl.searchParams.set("redirect_uri", redirectUriFor(origin));
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid email profile");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    domain: cookieDomain(),
  };
  response.cookies.set("coolspot_oauth_state", state, cookieOptions);
  response.cookies.set("coolspot_oauth_verifier", verifier, cookieOptions);
  return response;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
