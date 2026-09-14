/* eslint-disable @next/next/no-img-element -- intentional: a plain <img> with srcset is
   the requirement here (real file URLs + srcset variants, no next/image re-encode). */
import type { CSSProperties } from "react";

/**
 * A plain <img> with explicit width/height (CLS-free) and a thumbnail→master srcset.
 *
 * The spec asks for real file URLs and `srcset` variants — a plain image element does
 * exactly that without `next/image`'s optimizer re-encoding files sharp already wrote.
 * Media is served from our own /media/ route with HTTP caching; dimensions come from
 * the DB so layout never jumps.
 */
export function SpotImage({
  url,
  thumbUrl,
  width,
  height,
  alt,
  sizes = "(max-width: 640px) 100vw, 720px",
  priority = false,
  className,
  style,
}: {
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src={thumbUrl}
      srcSet={`${thumbUrl} 400w, ${url} ${width}w`}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}
