import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { getSession } from "@/lib/session";
import { updateSpot } from "@/lib/spots";

/**
 * PATCH /api/spots/[id] — edit a spot's name, description, location and categories.
 * Creator (or admin) only; the slug stays stable on edit.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to edit a spot" }, { status: 401 });
  }

  const { id } = await params;
  const spotId = Number.parseInt(id, 10);
  if (!Number.isInteger(spotId)) {
    return NextResponse.json({ error: "Invalid spot id" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  try {
    await updateSpot(
      spotId,
      {
        name: String(body.name ?? ""),
        description: typeof body.description === "string" ? body.description : null,
        lat: Number(body.lat),
        lng: Number(body.lng),
        categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.map(Number) : [],
        address: typeof body.address === "string" ? body.address : null,
        city: typeof body.city === "string" ? body.city : null,
        openingHours: typeof body.openingHours === "string" ? body.openingHours : null,
      },
      Number(session.userId),
      session.isAdmin,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
