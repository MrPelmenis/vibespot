import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, formFiles } from "@/lib/api";
import { processImageToWebp } from "@/lib/media";
import { getSession } from "@/lib/session";
import { addSpotMedia, deleteSpotMedia } from "@/lib/spots";
import { isFfmpegAvailable, MAX_VIDEO_BYTES, VideoError } from "@/lib/video";

/**
 * POST /api/spots/[id]/media — add photos (and at most one video) to an existing spot.
 * DELETE /api/spots/[id]/media?mediaId=… — remove one. Both are creator/admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to add media" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const files = formFiles(form, "images");
  const videoFiles = formFiles(form, "video");
  if (files.length === 0 && videoFiles.length === 0) {
    return NextResponse.json({ error: "No images or video provided" }, { status: 400 });
  }

  try {
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

    await addSpotMedia(spotId, { images, video }, Number(session.userId), session.isAdmin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to remove photos" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);
  const mediaId = Number.parseInt(request.nextUrl.searchParams.get("mediaId") ?? "", 10);
  if (!Number.isInteger(mediaId)) {
    return NextResponse.json({ error: "Invalid media id" }, { status: 400 });
  }

  try {
    await deleteSpotMedia(spotId, mediaId, Number(session.userId), session.isAdmin);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
