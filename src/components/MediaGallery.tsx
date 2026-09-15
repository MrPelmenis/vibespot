"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { SpotImage } from "@/components/SpotImage";

export type GalleryItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  /** For videos: "ready" | "processing" | "failed". Images are always "ready". */
  status: string;
};

/** Items that can open in the fullscreen viewer: images + videos that finished transcoding. */
function playable(items: GalleryItem[]): GalleryItem[] {
  return items.filter((m) => m.kind === "image" || m.status === "ready");
}

type ViewerContextValue = { open: (id: string) => void };
const ViewerContext = createContext<ViewerContextValue>({ open: () => {} });

/** Lets a non-gallery thumbnail (e.g. the fallback cover) open the shared viewer. */
export function useMediaViewer(): ViewerContextValue {
  return useContext(ViewerContext);
}

/**
 * Holds the combined media list and the single fullscreen viewer for a page, so each
 * gallery (main + every review) displays separately but they all navigate one shared
 * viewer — open any photo/video and arrow through everything.
 */
export function MediaViewerProvider({
  items,
  children,
}: {
  items: GalleryItem[];
  children: ReactNode;
}) {
  const media = playable(items);
  const [index, setIndex] = useState<number | null>(null);

  const indexById = new Map<string, number>();
  media.forEach((m, i) => indexById.set(m.id, i));

  function open(id: string) {
    const i = indexById.get(id);
    if (i != null) setIndex(i);
  }

  return (
    <ViewerContext.Provider value={{ open }}>
      {children}
      {index !== null ? (
        <MediaViewer
          items={media}
          index={index}
          onClose={() => setIndex(null)}
          onNavigate={setIndex}
        />
      ) : null}
    </ViewerContext.Provider>
  );
}

/** A side-by-side grid of photo/video thumbnails; clicking one opens the shared viewer. */
export function MediaGallery({ items }: { items: GalleryItem[] }) {
  const { open } = useContext(ViewerContext);

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((m) => {
        if (m.kind === "video" && m.status !== "ready") {
          return (
            <div
              key={m.id}
              className="flex aspect-square items-center justify-center rounded-md border border-line bg-surface-2 px-2 text-center text-[12px] text-muted"
            >
              {m.status === "failed" ? "Video failed to process" : "Video processing…"}
            </div>
          );
        }

        return (
          <button
            key={m.id}
            type="button"
            onClick={() => open(m.id)}
            aria-label={`View ${m.kind === "video" ? "video" : "photo"} fullscreen`}
            className="relative block w-full"
          >
            {m.kind === "image" ? (
              <SpotImage
                url={m.url}
                thumbUrl={m.thumbUrl ?? m.url}
                width={m.width ?? 0}
                height={m.height ?? 0}
                alt={m.alt}
                className="aspect-square w-full rounded-md border border-line object-cover washed"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.thumbUrl ?? undefined}
                alt={m.alt}
                className="aspect-square w-full rounded-md border border-line object-cover washed"
              />
            )}
            {m.kind === "video" ? (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white">
                  <Play size={18} strokeWidth={2.75} aria-hidden="true" />
                </span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function MediaViewer({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: GalleryItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight") onNavigate((index + 1) % items.length);
      else if (event.key === "ArrowLeft") onNavigate((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onNavigate]);

  const item = items[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item?.alt ?? "Media viewer"}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} strokeWidth={2.75} aria-hidden="true" />
      </button>
      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + items.length) % items.length);
          }}
          aria-label="Previous"
          className="absolute left-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronLeft size={22} strokeWidth={2.75} aria-hidden="true" />
        </button>
      ) : null}

      {item.kind === "video" ? (
        <video
          key={item.id}
          controls
          autoPlay
          playsInline
          poster={item.thumbUrl ?? undefined}
          className="max-h-[90vh] max-w-[92vw] rounded-md object-contain"
          onClick={(e) => e.stopPropagation()}
        >
          <source src={item.url} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.alt}
          className="max-h-[90vh] max-w-[92vw] rounded-md object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {items.length > 1 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % items.length);
          }}
          aria-label="Next"
          className="absolute right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronRight size={22} strokeWidth={2.75} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
