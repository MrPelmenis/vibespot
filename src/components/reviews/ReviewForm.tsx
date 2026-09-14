"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Star, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VideoThumb } from "@/components/VideoThumb";
import type { ReviewMediaSummary } from "@/lib/types";

type Props = {
  spotId: number;
  review: {
    id: number;
    rating: number;
    body: string | null;
    media: ReviewMediaSummary[];
  } | null;
};

/**
 * Write or edit a review (one per user per spot, editable forever). Create submits one
 * multipart POST (rating/body/date/photos/video); edit patches the fields then adds /
 * removes media with the owner-only endpoints.
 */
export function ReviewForm({ spotId, review }: Props) {
  const router = useRouter();
  const isEdit = Boolean(review);

  const [rating, setRating] = useState(review?.rating ?? 0);
  const [body, setBody] = useState(review?.body ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the "existing" list from the latest server data minus what the user has
  // marked for removal — no separate state to drift out of sync after a refresh.
  const existingMedia = (review?.media ?? []).filter((m) => !removedMediaIds.includes(m.id));

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Pick a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && review) {
        const patch = await fetch(`/api/reviews/${review.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, body }),
        });
        if (!patch.ok) {
          setError(await readError(patch));
          return;
        }
        if (images.length > 0 || video) {
          const form = new FormData();
          for (const f of images) form.append("images", f);
          if (video) form.append("video", video);
          const media = await fetch(`/api/reviews/${review.id}/media`, { method: "POST", body: form });
          if (!media.ok) {
            setError(await readError(media));
            return;
          }
        }
        for (const mediaId of removedMediaIds) {
          await fetch(`/api/reviews/${review.id}/media?mediaId=${mediaId}`, { method: "DELETE" });
        }
      } else {
        const form = new FormData();
        form.set("rating", String(rating));
        form.set("body", body);
        for (const f of images) form.append("images", f);
        if (video) form.append("video", video);
        const res = await fetch(`/api/spots/${spotId}/reviews`, { method: "POST", body: form });
        if (!res.ok) {
          setError(await readError(res));
          return;
        }
      }
      // Clear the transient uploads so a second "Save" can't re-upload them.
      setImages([]);
      setVideo(null);
      setRemovedMediaIds([]);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function removeExisting(id: number) {
    setRemovedMediaIds((cur) => [...cur, id]);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-line bg-surface p-4">
      <h3 className="font-heading text-[15px] text-text">
        {isEdit ? "Edit your review" : "Write a review"}
      </h3>

      <div className="mt-2" role="radiogroup" aria-label="Your rating">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
              aria-checked={rating === value}
              role="radio"
              className="rounded-full p-0.5 transition-transform hover:scale-110"
            >
              <Star
                size={26}
                strokeWidth={2.75}
                aria-hidden="true"
                className={value <= rating ? "fill-star text-star" : "text-faint"}
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="What was it like?"
        className="mt-3 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[14px] text-text placeholder:text-faint"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-text transition-colors hover:bg-surface-2">
          <ImagePlus size={14} strokeWidth={2.75} aria-hidden="true" />
          Photos
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={(event) => {
              if (event.target.files) setImages((cur) => [...cur, ...Array.from(event.target.files!)]);
            }}
            className="sr-only"
          />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[12px] text-text transition-colors hover:bg-surface-2">
          <Video size={14} strokeWidth={2.75} aria-hidden="true" />
          {video ? "Change video" : "Video"}
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
      </div>

      {existingMedia.length > 0 || previews.length > 0 || video ? (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {existingMedia.map((media) => (
            <div key={media.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.thumbUrl ?? media.url}
                alt="Review media"
                className="aspect-square w-full rounded-md border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => removeExisting(media.id)}
                aria-label="Remove media"
                className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-danger-fg"
              >
                <X size={12} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          ))}
          {previews.map((url, index) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="New photo preview"
                className="aspect-square w-full rounded-md border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => setImages((cur) => cur.filter((_, i) => i !== index))}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-danger-fg"
              >
                <X size={12} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          ))}
          {video ? (
            <div className="relative">
              <VideoThumb file={video} className="aspect-square w-full rounded-md border border-line object-cover" />
              <button
                type="button"
                onClick={() => setVideo(null)}
                aria-label="Remove video"
                className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-danger-fg"
              >
                <X size={12} strokeWidth={2.75} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <Button type="submit" disabled={submitting || rating < 1} className="h-9 px-4 text-sm">
          {submitting ? <Loader2 size={15} strokeWidth={2.75} className="animate-spin" aria-hidden="true" /> : null}
          {isEdit ? "Save changes" : "Post review"}
        </Button>
      </div>
    </form>
  );
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}
