import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { geocodeSearch } from "@/lib/geocode";

/**
 * GET /api/geocode/search?q=… — place-name autocomplete, proxied server-side so the
 * Geoapify / LocationIQ keys never reach the browser.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await geocodeSearch(q);
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
