import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * The image pipeline (§4 of the spec): validate actual bytes, auto-rotate, strip all
 * EXIF/GPS, resize to a 2560 px long-edge master and write WebP q80, plus a 400 px
 * thumbnail. Files live on local disk under MEDIA_ROOT; the database stores only
 * relative paths — never base64.
 *
 * Video transcoding (ffmpeg) is Phase 4 and lives in its own module.
 */

const MASTER_LONG_EDGE = 2560;
const THUMB_LONG_EDGE = 400;
const WEBP_QUALITY = 80;
const AVATAR_SIZE = 256;

// Formats sharp can decode AND that we accept. GIF is deliberately absent: sharp would
// flatten an animated GIF to its first frame, and the spec forbids silently losing the
// animation (the two legacy GIFs are handled by the Phase 6 import, not this path).
const ACCEPTED = new Set(["jpeg", "png", "webp", "avif", "heif"]);

export type ProcessedImage = {
  master: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
};

export type StoredImage = {
  path: string; // relative, forward-slash, e.g. spots/12/<uuid>-master.webp
  thumbPath: string;
  width: number;
  height: number;
};

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaError";
  }
}

export function mediaRoot(): string {
  const root = process.env.MEDIA_ROOT ?? "./data/media";
  // `turbopackIgnore`: the runtime media root is intentionally a dynamic path (set by
  // MEDIA_ROOT at boot), so the bundler must not trace the project from here.
  return path.isAbsolute(root)
    ? root
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), root);
}

async function renderWebP(input: Buffer, longEdge: number) {
  const { data, info } = await sharp(input)
    .rotate() // applies EXIF orientation, then discards it
    .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return { buffer: data, width: info.width, height: info.height };
}

/**
 * Validates and encodes one uploaded image into master + thumbnail WebP buffers, all
 * in memory. EXIF/GPS is stripped because we never call `.withMetadata()`.
 */
export async function processImageToWebp(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input, { failOn: "error" }).metadata();
  if (!metadata.format || !ACCEPTED.has(metadata.format)) {
    throw new MediaError(
      "Unsupported image. Upload a JPEG, PNG, WebP or HEIC file.",
    );
  }

  const master = await renderWebP(input, MASTER_LONG_EDGE);
  const thumb = await renderWebP(input, THUMB_LONG_EDGE);

  return {
    master: master.buffer,
    thumb: thumb.buffer,
    width: master.width,
    height: master.height,
  };
}

export async function writeSpotMediaFile(
  spotId: number,
  image: ProcessedImage,
): Promise<StoredImage> {
  const dir = path.join(mediaRoot(), "spots", String(spotId));
  await mkdir(dir, { recursive: true });

  const id = randomUUID();
  const masterName = `${id}-master.webp`;
  const thumbName = `${id}-thumb.webp`;

  await writeFile(path.join(dir, masterName), image.master);
  await writeFile(path.join(dir, thumbName), image.thumb);

  return {
    path: `spots/${spotId}/${masterName}`,
    thumbPath: `spots/${spotId}/${thumbName}`,
    width: image.width,
    height: image.height,
  };
}

/** Resizes and re-encodes a profile avatar to a 256px WebP file, returning the path. */
export async function processAndStoreAvatar(userId: number, input: Buffer): Promise<string> {
  // UUID in the name so a new upload always gets a fresh URL — /media/ is served with
  // an `immutable` cache, so reusing the same filename would show a stale avatar.
  const rel = `avatars/${userId}-${randomUUID()}.webp`;
  const abs = path.join(mediaRoot(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  const avatar = await sharp(input)
    .rotate()
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  await writeFile(abs, avatar);
  return rel;
}

export async function deleteAvatarFile(rel: string): Promise<void> {
  if (!rel.startsWith("avatars/")) return;
  await unlink(path.join(mediaRoot(), rel)).catch(() => {});
}

export async function writeReviewImageFile(
  reviewId: number,
  image: ProcessedImage,
): Promise<StoredImage> {
  const dir = path.join(mediaRoot(), "reviews", String(reviewId));
  await mkdir(dir, { recursive: true });

  const id = randomUUID();
  const masterName = `${id}-master.webp`;
  const thumbName = `${id}-thumb.webp`;

  await writeFile(path.join(dir, masterName), image.master);
  await writeFile(path.join(dir, thumbName), image.thumb);

  return {
    path: `reviews/${reviewId}/${masterName}`,
    thumbPath: `reviews/${reviewId}/${thumbName}`,
    width: image.width,
    height: image.height,
  };
}

export async function deleteMediaFile(
  stored: Pick<StoredImage, "path" | "thumbPath">,
): Promise<void> {
  for (const rel of [stored.path, stored.thumbPath]) {
    try {
      await unlink(path.join(mediaRoot(), rel));
    } catch {
      // Already gone — nothing to clean up.
    }
  }
}
