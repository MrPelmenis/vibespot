import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, formFiles, formString, parseIdList } from "@/lib/api";
import { processImageToWebp } from "@/lib/media";
import { getSession } from "@/lib/session";
import { addSpotMedia, createSpot, listSpotsByRadius, listSpotsInBbox } from "@/lib/spots";
import { isFfmpegAvailable, MAX_VIDEO_BYTES, VideoError } from "@/lib/video";

/**
 * GET /api/spots — viewport or radius query, the same PostGIS reads the map uses.
 *
 *   ?bbox=west,south,east,north      viewport (bounding box) mode
 *   ?lat=…&lng=…&radius=…            radius mode (metres, default 5000)
 *   &categoryIds=1,2,3               optional category filter (applies to both)
 *   &limit=…                         max results (default 100, capped at 500)
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const categoryIds = parseIdList(params.get("categoryIds"));
  const limit = clampLimit(params.get("limit"));

  try {
    const bbox = params.get("bbox");
    if (bbox) {
      const [west, south, east, north] = bbox.split(",").map(Number);
      if ([west, south, east, north].some((n) => !Number.isFinite(n))) {
        return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
      }
      const spots = await listSpotsInBbox({ west, south, east, north, categoryIds, limit });
      return NextResponse.json({ spots });
    }

    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "Provide a bbox, or lat and lng" },
        { status: 400 },
      );
    }
    const radius = Math.min(Math.max(Number(params.get("radius") ?? 5000), 100), 100_000);
    const spots = await listSpotsByRadius({
      lat,
      lng,
      radiusMeters: radius,
      categoryIds,
      limit,
    });
    return NextResponse.json({ spots });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/spots — create a spot with photos, multipart/form-data.
 * Fields: name, description, lat, lng, categoryIds (comma-separated), address, city,
 * and any number of `images` file parts.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to add a spot" }, { status: 401 });
  }
  const userId = Number(session.userId);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const files = formFiles(form, "images");
  const videoFiles = formFiles(form, "video");

  try {
    // Encode images up front — this validates every file before any DB row is created.
    const images = [];
    for (const file of files) {
      images.push(await processImageToWebp(Buffer.from(await file.arrayBuffer())));
    }

    let video: Buffer | null = null;
    if (videoFiles.length > 0) {
      const file = videoFiles[0];
      if (file.size > MAX_VIDEO_BYTES) throw new VideoError("Video must be 10 MB or less.");
      if (!(await isFfmpegAvailable())) {
        throw new VideoError("ffmpeg is not available, so video cannot be processed right now.");
      }
      video = Buffer.from(await file.arrayBuffer());
    }

    const { id, slug } = await createSpot(
      {
        name: formString(form, "name"),
        description: formString(form, "description") || null,
        lat: Number(form.get("lat")),
        lng: Number(form.get("lng")),
        categoryIds: parseIdList(formString(form, "categoryIds")),
        address: formString(form, "address") || null,
        city: formString(form, "city") || null,
        openingHours: formString(form, "openingHours") || null,
      },
      userId,
    );

    if (images.length > 0 || video) {
      await addSpotMedia(id, { images, video }, userId, session.isAdmin);
    }

    return NextResponse.json({ slug }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "100", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : 100;
}
