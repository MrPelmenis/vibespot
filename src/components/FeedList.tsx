"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SpotCard } from "@/components/SpotCard";
import type { SpotSummary } from "@/lib/types";

/**
 * The feed's spot list with infinite scroll. It renders the server-provided first page
 * and appends further pages via /api/feed when a sentinel scrolls into view.
 */
export function FeedList({
  initialSpots,
  tab,
  category,
  hasMore,
}: {
  initialSpots: SpotSummary[];
  tab: string;
  category?: string;
  hasMore: boolean;
}) {
  const [spots, setSpots] = useState<SpotSummary[]>(initialSpots);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(!hasMore);
  const offsetRef = useRef(initialSpots.length);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab, offset: String(offsetRef.current) });
      if (category) params.set("category", category);
      const res = await fetch(`/api/feed?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { spots: SpotSummary[] };
        if (data.spots.length === 0) {
          setDone(true);
        } else {
          setSpots((cur) => [...cur, ...data.spots]);
          offsetRef.current += data.spots.length;
        }
      } else {
        setDone(true);
      }
    } catch {
      setDone(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [done, tab, category]);

  useEffect(() => {
    if (done) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [done, loadMore]);

  return (
    <>
      <ul className="flex flex-col gap-2.5">
        {spots.map((spot) => (
          <SpotCard key={spot.id} spot={spot} />
        ))}
      </ul>
      {!done ? (
        <div
          ref={sentinelRef}
          className="flex min-h-8 items-center justify-center py-4 text-muted"
        >
          {loading ? (
            <Loader2 size={18} strokeWidth={2.75} className="animate-spin" aria-hidden="true" />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
