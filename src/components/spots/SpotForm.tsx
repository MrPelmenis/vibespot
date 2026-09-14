"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VideoThumb } from "@/components/VideoThumb";
import dynamic from "next/dynamic";
import type { LocationPickerProps, PickedLocation } from "@/components/spots/LocationPicker";

// Leaflet touches `window` at import time, so the picker is client-only (ssr: false).
const LocationPicker = dynamic<LocationPickerProps>(
  () => import("@/components/spots/LocationPicker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-56 w-full animate-pulse rounded-md bg-surface-2" /> },
);
import type { CategorySummary, SpotSummary } from "@/lib/types";

/**
 * Create/edit form for a spot. Create submits one multipart POST; edit updates fields,
 * adds new photos and removes deleted ones as separate requests to the owner-only
 * endpoints. Identity is never sent — the server derives it from the session cookie.
 */

const MAX_CATEGORIES = 3;

export function SpotForm({
  categories,
  spot,
}: {
  categories: CategorySummary[];
  spot?: SpotSummary;
}) {
  const router = useRouter();
  const isEdit = Boolean(spot);

  const [name, setName] = useState(spot?.name ?? "");
  const [description, setDescription] = useState(spot?.description ?? "");
  const [openingHours, setOpeningHours] = useState(spot?.openingHours?.text ?? "");
  const [location, setLocation] = useState<PickedLocation | null>(
    spot ? { lat: spot.lat, lng: spot.lng, address: spot.address ?? "", city: spot.city } : null,
  );
  const [categoryIds, setCategoryIds] = useState<number[]>(
    spot?.categories.map((c) => c.id) ?? [],
  );
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [existingMedia, setExistingMedia] = useState(spot?.media ?? []);
  const [removedMediaIds, setRemovedMediaIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const canSubmit =
    name.trim().length >= 3 &&
    location != null &&
    categoryIds.length >= 1 &&
    !submitting;

  function toggleCategory(id: number) {
    setCategoryIds((current) => {
      if (current.includes(id)) return current.filter((c) => c !== id);
      if (current.length >= MAX_CATEGORIES) return current;
      return [...current, id];
    });
  }

  function onImagesSelected(files: FileList | null) {
    if (!files) return;
    setImages((current) => [...current, ...Array.from(files)]);
  }

  function removeNewImage(index: number) {
    setImages((current) => current.filter((_, i) => i !== index));
  }

  function removeExisting(id: number) {
    setExistingMedia((current) => current.filter((m) => m.id !== id));
    setRemovedMediaIds((current) => [...current, id]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!location) {
      setError("Pick a location on the map.");
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && spot) {
        const patch = await fetch(`/api/spots/${spot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            lat: location.lat,
            lng: location.lng,
            categoryIds,
            address: location.address || null,
            city: location.city || null,
            openingHours: openingHours.trim() || null,
          }),
        });
        if (!patch.ok) {
          setError(await readError(patch));
          return;
        }
        if (images.length > 0 || video) {
          const form = new FormData();
          for (const file of images) form.append("images", file);
          if (video) form.append("video", video);
          const media = await fetch(`/api/spots/${spot.id}/media`, { method: "POST", body: form });
          if (!media.ok) {
            setError(await readError(media));
            return;
          }
        }
        for (const mediaId of removedMediaIds) {
          await fetch(`/api/spots/${spot.id}/media?mediaId=${mediaId}`, { method: "DELETE" });
        }
        router.push(`/spot/${spot.slug}`);
      } else {
        const form = new FormData();
        form.set("name", name);
        form.set("description", description);
        form.set("lat", String(location.lat));
        form.set("lng", String(location.lng));
        form.set("categoryIds", categoryIds.join(","));
        if (location.address) form.set("address", location.address);
        if (location.city) form.set("city", location.city);
        if (openingHours.trim()) form.set("openingHours", openingHours.trim());
        for (const file of images) form.append("images", file);
        if (video) form.append("video", video);

        const res = await fetch("/api/spots", { method: "POST", body: form });
        if (!res.ok) {
          setError(await readError(res));
          return;
        }
        const data = (await res.json()) as { slug: string };
        router.push(`/spot/${data.slug}`);
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Name" hint="3–60 characters">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-[14px] text-text placeholder:text-faint"
          placeholder="e.g. The best sunset spot"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-line bg-surface-2 px-4 py-2 text-[14px] text-text placeholder:text-faint"
          placeholder="What makes this place worth visiting?"
        />
      </Field>

      <Field label="Opening hours" hint="optional">
        <label className="mb-1.5 flex items-center gap-1.5 text-[13px] text-muted">
          <input
            type="checkbox"
            checked={openingHours === "Open 24 hours"}
            onChange={(event) => setOpeningHours(event.target.checked ? "Open 24 hours" : "")}
            className="h-4 w-4"
          />
          Open all the time (24/7)
        </label>
        <input
          value={openingHours === "Open 24 hours" ? "" : openingHours}
          onChange={(event) => setOpeningHours(event.target.value)}
          disabled={openingHours === "Open 24 hours"}
          className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-[14px] text-text placeholder:text-faint disabled:opacity-50"
          placeholder="e.g. Mon–Fri 9:00–17:00"
        />
      </Field>

      <Field label="Location">
        <LocationPicker
          lat={location?.lat}
          lng={location?.lng}
          onChange={(value) => setLocation(value)}
        />
        {location?.address ? (
          <p className="mt-1 text-[12px] text-muted">{location.address}</p>
        ) : null}
      </Field>

      <Field label="Categories" hint={`Choose 1–${MAX_CATEGORIES}`}>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((category) => {
            const active = categoryIds.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.id)}
                aria-pressed={active}
                className="rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: category.color, borderColor: category.color, color: "#fff" }
                    : undefined
                }
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Photos & video">
        <div className="mb-2 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-text transition-colors hover:bg-surface-2">
            <ImagePlus size={16} strokeWidth={2.75} aria-hidden="true" />
            Add photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              onChange={(event) => onImagesSelected(event.target.files)}
              className="sr-only"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-[13px] text-text transition-colors hover:bg-surface-2">
            <Video size={16} strokeWidth={2.75} aria-hidden="true" />
            {video ? "Change video" : "Add a video"}
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              onChange={(event) => setVideo(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        </div>

        {existingMedia.length > 0 || previews.length > 0 || video ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {existingMedia.map((media) => (
              <div key={media.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.thumbUrl}
                  alt="Existing media"
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
                  onClick={() => removeNewImage(index)}
                  aria-label="Remove new photo"
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

        <p className="mt-1 text-[12px] text-faint">Photos: JPEG, PNG, WebP or HEIC. Video: MP4 up to 10 MB.</p>
      </Field>

      {error ? (
        <p role="alert" className="rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={!canSubmit} className="h-10 px-5 text-sm">
          {submitting ? <Loader2 size={16} strokeWidth={2.75} className="animate-spin" aria-hidden="true" /> : null}
          {isEdit ? "Save changes" : "Add spot"}
        </Button>
        {!canSubmit ? (
          <span className="text-[12px] text-muted">Add a name, a location and at least one category.</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label className="font-heading text-[14px] text-text">{label}</label>
        {hint ? <span className="text-[12px] text-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
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
