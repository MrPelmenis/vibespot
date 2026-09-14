import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { searchSpots } from "@/lib/spots";
import { searchUsers } from "@/lib/users";

/**
 * GET /api/search?q=… — one box over users and spots. Users come first (so a name
 * match surfaces the profile before their spots), then spots by name/description/
 * city/category/address/author, with unaccent + trigram tolerance (`riga` → `Rīga`).
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ users: [], spots: [] });

  try {
    const [users, spots] = await Promise.all([searchUsers(q, 5), searchSpots(q, 20)]);
    return NextResponse.json({ users, spots });
  } catch (error) {
    return errorResponse(error);
  }
}
