"use client";

import { SpotImage } from "@/components/SpotImage";
import { useMediaViewer } from "@/components/MediaGallery";

/** A full-width, clickable cover that opens the shared media viewer at `id`. */
export function CoverThumb({
  id,
  url,
  thumbUrl,
  width,
  height,
  alt,
}: {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
}) {
  const { open } = useMediaViewer();
  return (
    <button type="button" onClick={() => open(id)} aria-label="Open photo viewer" className="block w-full">
      <SpotImage
        url={url}
        thumbUrl={thumbUrl}
        width={width}
        height={height}
        alt={alt}
        className="aspect-video w-full rounded-md border border-line object-cover washed"
      />
    </button>
  );
}
