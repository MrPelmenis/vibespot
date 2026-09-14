"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Inline reply form under a review. */
export function ReplyForm({ reviewId }: { reviewId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const res = await fetch(`/api/reviews/${reviewId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: trimmed }),
    });
    if (res.ok) {
      setBody("");
      router.refresh();
    } else if (res.status === 401) {
      router.push("/signin");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Reply…"
        aria-label="Write a reply"
        className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-text placeholder:text-faint"
      />
      <button
        type="submit"
        disabled={submitting || !body.trim()}
        className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-accent-fg transition-colors disabled:opacity-45"
      >
        Reply
      </button>
    </form>
  );
}
