"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flag } from "lucide-react";

/** "Report" control for spots, reviews and users. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "spot" | "review" | "user";
  targetId: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);

  async function submit() {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    });
    if (res.ok) {
      setDone(true);
      setOpen(false);
    } else if (res.status === 401) {
      router.push("/signin");
    }
  }

  if (done) {
    return <span className="text-[12px] text-success">Reported — thanks.</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-muted"
      >
        <Flag size={12} strokeWidth={2.75} aria-hidden="true" />
        Report
      </button>
      {open ? (
        <div className="mt-1.5">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Why are you reporting this?"
            className="w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-faint"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!reason.trim()}
              className="rounded-full bg-danger px-3 py-1 text-[12px] font-medium text-danger-fg disabled:opacity-45"
            >
              Submit report
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-[12px] text-muted hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
