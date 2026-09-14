import "server-only";

import { spawn } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pool } from "@/db/client";
import { mediaRoot } from "@/lib/media";

/**
 * Async video transcoding: ffmpeg → H.264 + AAC MP4 with `+faststart`, 720p max, plus
 * a poster frame at ~1 s. The request never blocks — the transcode runs in a child
 * process and updates the media row when it finishes. If ffmpeg is missing, the upload
 * is rejected up front (see `isFfmpegAvailable`) rather than storing an unplayable file.
 */

export const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MB

export class VideoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoError";
  }
}

export function ffmpegPath(): string {
  return process.env.FFMPEG_PATH ?? "ffmpeg";
}
export function ffprobePath(): string {
  return process.env.FFPROBE_PATH ?? "ffprobe";
}

export type VideoTarget = {
  table: "spot_media" | "review_media";
  dir: "spots" | "reviews";
  parentId: number;
};

/** True if ffmpeg is on PATH (or FFMPEG_PATH), decided by a quick `-version` probe. */
export function isFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), ["-version"], { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 3000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => reject(new VideoError(`${cmd} failed to start: ${error.message}`)));
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new VideoError(`${cmd} exited ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

async function probe(
  videoPath: string,
): Promise<{ width: number; height: number; durationS: number | null }> {
  const out = await run(ffprobePath(), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    videoPath,
  ]);
  const data = JSON.parse(out) as {
    streams?: { width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const stream = data.streams?.[0];
  const duration = data.format?.duration ? Number(data.format.duration) : null;
  return { width: stream?.width ?? 0, height: stream?.height ?? 0, durationS: duration };
}

/**
 * Writes the uploaded bytes to a temp file and kicks off the transcode in the
 * background. On completion the media row is rewritten with the final MP4, poster and
 * dimensions; on failure it is marked `failed`.
 */
export async function startVideoTranscode(
  input: Buffer,
  target: VideoTarget,
  mediaId: number,
): Promise<void> {
  const tmpDir = path.join(mediaRoot(), "tmp");
  await mkdir(tmpDir, { recursive: true });
  const inputPath = path.join(tmpDir, `${randomUUID()}-input.mp4`);
  await writeFile(inputPath, input);

  const outDir = path.join(mediaRoot(), target.dir, String(target.parentId));
  await mkdir(outDir, { recursive: true });
  const id = randomUUID();
  const outPath = path.join(outDir, `${id}.mp4`);
  const posterPath = path.join(outDir, `${id}-poster.jpg`);
  const relVideo = `${target.dir}/${target.parentId}/${id}.mp4`;
  const relPoster = `${target.dir}/${target.parentId}/${id}-poster.jpg`;

  const markFailed = async () => {
    await pool.query(`UPDATE ${target.table} SET status = 'failed' WHERE id = $1`, [mediaId]);
    await unlink(inputPath).catch(() => {});
  };

  const child = spawn(ffmpegPath(), [
    "-i",
    inputPath,
    "-vf",
    "scale='min(1280,iw)':-2",
    "-c:v",
    "libx264",
    "-crf",
    "23",
    "-preset",
    "veryfast",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-y",
    outPath,
  ]);

  child.on("error", () => void markFailed());
  child.on("exit", (code) => {
    void (async () => {
      if (code !== 0) {
        await markFailed();
        return;
      }
      try {
        // Poster frame at ~1 s.
        await run(ffmpegPath(), [
          "-ss",
          "1",
          "-i",
          outPath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(640,iw)':-2",
          "-q:v",
          "2",
          "-y",
          posterPath,
        ]);
        const { width, height, durationS } = await probe(outPath);
        await pool.query(
          `UPDATE ${target.table}
           SET path = $1, thumb_path = $2, width = $3, height = $4, duration_s = $5, status = 'ready'
           WHERE id = $6`,
          [relVideo, relPoster, width, height, durationS, mediaId],
        );
      } catch (error) {
        console.error("video post-process failed:", error);
        await markFailed();
      } finally {
        await unlink(inputPath).catch(() => {});
      }
    })();
  });
}
