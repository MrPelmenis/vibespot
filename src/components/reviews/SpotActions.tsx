"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, Footprints } from "lucide-react";

/** Save ("want to go") and "I visited" toggles for the spot page. */
export function SpotActions({
  spotId,
  saved,
  visitedToday,
  isSignedIn,
}: {
  spotId: number;
  saved: boolean;
  visitedToday: boolean;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [savedState, setSavedState] = useState(saved);
  const [visitedState, setVisitedState] = useState(visitedToday);

  async function toggleSave() {
    if (!isSignedIn) {
      router.push("/signin");
      return;
    }
    const res = await fetch(`/api/spots/${spotId}/save`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { saved: boolean };
      setSavedState(data.saved);
      router.refresh();
    }
  }

  async function markVisited() {
    if (!isSignedIn) {
      router.push("/signin");
      return;
    }
    const res = await fetch(`/api/spots/${spotId}/visit`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { visited: boolean };
      setVisitedState(data.visited);
      router.refresh();
    }
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={toggleSave}
        aria-pressed={savedState}
        className={[
          "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
          savedState
            ? "bg-accent-tint text-accent"
            : "border border-line-strong text-text hover:bg-surface-2",
        ].join(" ")}
      >
        <Bookmark size={15} strokeWidth={2.75} aria-hidden="true" className={savedState ? "fill-current" : ""} />
        {savedState ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={markVisited}
        aria-pressed={visitedState}
        className={[
          "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
          visitedState
            ? "bg-accent-2-tint text-accent-2"
            : "border border-line-strong text-text hover:bg-surface-2",
        ].join(" ")}
      >
        <Footprints size={15} strokeWidth={2.75} aria-hidden="true" />
        {visitedState ? "Visited" : "I visited"}
      </button>
    </div>
  );
}
