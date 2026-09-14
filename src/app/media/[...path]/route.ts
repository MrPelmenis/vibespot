import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { mediaRoot } from "@/lib/media";

/**
 * Serves uploaded media straight off disk. Media paths are UUID-based and immutable,
 * so responses are cached for a year. Videos get byte-range (206) support, which is
 * what <video> needs to stream and seek — without it playback stalls after the first
 * buffered chunk. In production nginx can serve /media/ directly (see README).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const root = mediaRoot();
  const abs = path.resolve(root, ...segments);

  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(abs);
    const type = contentType(abs);
    // Videos stream via byte-range requests, so they must NOT be `immutable` — Safari in
    // particular stalls mid-playback when a range response is cached as never-changing.
    // Images keep the aggressive immutable cache (their UUID paths never change).
    const cacheControl =
      type === "video/mp4"
        ? "public, max-age=3600"
        : "public, max-age=31536000, immutable";
    const baseHeaders = {
      "Content-Type": type,
      "Cache-Control": cacheControl,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };

    const range = request.headers.get("range");
    const match = range ? /bytes=(\d*)-(\d*)/.exec(range) : null;
    if (match) {
      const start = match[1] ? Number.parseInt(match[1], 10) : 0;
      const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : data.length - 1;
      const end = Math.min(requestedEnd, data.length - 1);
      if (start >= 0 && start <= end && start < data.length) {
        const chunk = data.subarray(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${data.length}`,
            "Content-Length": String(chunk.length),
          },
        });
      }
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${data.length}` },
      });
    }

    return new NextResponse(new Uint8Array(data), {
      headers: { ...baseHeaders, "Content-Length": String(data.length) },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

function contentType(file: string): string {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".avif")) return "image/avif";
  if (file.endsWith(".gif")) return "image/gif";
  if (file.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}
