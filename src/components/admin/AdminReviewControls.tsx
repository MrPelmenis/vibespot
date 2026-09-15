"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";

/** Admin-only edit/delete controls for a single review, used inline in both the
 *  regular review list and the admin panel. */
export function AdminReviewControls({
  reviewId,
  initialRating,
  initialBody,
}: {
  reviewId: number;
  initialRating: number;
  initialBody: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(`/api/admin/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, body }),
    });
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
    setBusy(false);
  }

  async function del() {
    setBusy(true);
    const res = await fetch(`/api/admin/reviews/${reviewId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setBusy(false);
  }

  if (editing) {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded-md border border-line bg-surface-2 p-2">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setRating(v)}
              aria-label={`${v} star${v === 1 ? "" : "s"}`}
              aria-checked={rating === v}
              role="radio"
              className="rounded-full p-0.5 transition-transform hover:scale-110"
            >
              <Star
                size={18}
                strokeWidth={2.75}
                aria-hidden="true"
                className={v <= rating ? "fill-star text-star" : "text-faint"}
              />
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Review body"
          className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-faint"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy || rating < 1}
            className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-45"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-3 py-1 text-[12px] text-muted hover:text-text"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[12px] text-text hover:bg-surface-2"
      >
        <Pencil size={12} strokeWidth={2.75} aria-hidden="true" />
        Edit
      </button>
      {confirming ? (
        <>
          <button
            type="button"
            onClick={del}
            disabled={busy}
            className="rounded-full bg-danger px-2.5 py-1 text-[12px] font-medium text-danger-fg disabled:opacity-45"
          >
            Sure?
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-full px-2 py-1 text-[12px] text-muted hover:text-text"
          >
            No
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2.5 py-1 text-[12px] text-danger hover:bg-surface-2"
        >
          <Trash2 size={12} strokeWidth={2.75} aria-hidden="true" />
          Delete
        </button>
      )}
    </div>
  );
}
