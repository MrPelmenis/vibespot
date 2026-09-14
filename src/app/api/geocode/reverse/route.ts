import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { reverseGeocode } from "@/lib/geocode";

/**
 * GET /api/geocode/reverse?lat=…&lng=… — address/city for a pin, proxied server-side.
 */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  try {
    const result = await reverseGeocode(lat, lng);
    return NextResponse.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
