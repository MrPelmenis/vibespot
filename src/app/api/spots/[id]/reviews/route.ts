import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, formFiles, formString } from "@/lib/api";
import { processImageToWebp } from "@/lib/media";
import { addReviewMedia, createReview } from "@/lib/reviews";
import { getSession } from "@/lib/session";
import { isFfmpegAvailable, MAX_VIDEO_BYTES, VideoError } from "@/lib/video";

/**
 * POST /api/spots/[id]/reviews — write one review (1–5 stars) with optional photos and
 * a video. Multipart: rating, body, visitedOn, `images` files, and at most one `video`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in to write a review" }, { status: 401 });
  }
  const { id } = await params;
  const spotId = Number.parseInt(id, 10);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  try {
    const images = [];
    for (const file of formFiles(form, "images")) {
      images.push(await processImageToWebp(Buffer.from(await file.arrayBuffer())));
    }

    const videoFiles = formFiles(form, "video");
    let video: Buffer | null = null;
    if (videoFiles.length > 0) {
      const file = videoFiles[0];
      if (file.size > MAX_VIDEO_BYTES) {
        throw new VideoError("Video must be 10 MB or less.");
      }
      if (!(await isFfmpegAvailable())) {
        throw new VideoError("ffmpeg is not available, so video cannot be processed right now.");
      }
      video = Buffer.from(await file.arrayBuffer());
    }

    const reviewId = await createReview(
      {
        spotId,
        rating: Number(form.get("rating")),
        body: formString(form, "body") || null,
        visitedOn: formString(form, "visitedOn") || null,
      },
      Number(session.userId),
    );

    if (images.length > 0 || video) {
      await addReviewMedia(reviewId, { images, video }, Number(session.userId));
    }

    return NextResponse.json({ reviewId }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
