"use client";

import { useEffect, useState } from "react";

type Result = { file: File; thumb: string | null; failed: boolean };

/**
 * Generates a thumbnail image from a video File's first frame (canvas capture) so the
 * upload form shows a real preview image rather than a bare filename. The result is
 * scoped to the exact File so a swap back to "Loading…" happens naturally when the
 * parent selects a different file.
 */
export function VideoThumb({ file, className }: { file: File; className?: string }) {
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const finish = (thumb: string | null, failed: boolean) => {
      URL.revokeObjectURL(url);
      setResult({ file, thumb, failed });
    };

    video.addEventListener("loadeddata", () => {
      try {
        const width = video.videoWidth || 160;
        const height = video.videoHeight || 120;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          finish(canvas.toDataURL("image/jpeg", 0.72), false);
        } else {
          finish(null, true);
        }
      } catch {
        finish(null, true);
      }
    });
    video.addEventListener("error", () => finish(null, true));
    video.load();

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const current = result && result.file === file ? result : null;

  if (current?.thumb) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={current.thumb}
        alt="Video preview"
        className={className ?? "h-24 w-40 rounded-md border border-line object-cover"}
      />
    );
  }
  return (
    <div
      className={
        className ??
        "flex h-24 w-40 items-center justify-center rounded-md border border-line bg-surface-2 text-[12px] text-muted"
      }
    >
      {current?.failed ? "No preview" : "Loading…"}
    </div>
  );
}
