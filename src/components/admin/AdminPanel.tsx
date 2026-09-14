"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ReportRow = {
  id: number;
  targetType: string;
  targetId: number;
  targetLabel: string | null;
  reason: string | null;
  reporterNickname: string | null;
  createdAt: string;
};

export type RequestRow = {
  id: number;
  kind: string;
  spotId: number;
  spotName: string;
  spotSlug: string;
  requesterNickname: string;
  createdAt: string;
};

/** Admin moderation surface: report queue, spot request queue, and spot merge. */
export function AdminPanel({ reports, requests }: { reports: ReportRow[]; requests: RequestRow[] }) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState("");

  async function act(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) router.refresh();
  }

  async function merge(event: React.FormEvent) {
    event.preventDefault();
    setMerging(true);
    setMergeMsg("");
    const res = await fetch("/api/admin/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: Number(targetId), sourceId: Number(sourceId) }),
    });
    if (res.ok) {
      setMergeMsg("Merged.");
      setTargetId("");
      setSourceId("");
      router.refresh();
    } else {
      setMergeMsg("Merge failed — check the ids.");
    }
    setMerging(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-[22px] text-text">Admin</h1>
        <p className="mt-0.5 text-[13px] text-muted">Report queue, spot requests and the merge tool.</p>
      </div>

      <section>
        <h2 className="font-heading text-[18px] text-text">Reports</h2>
        {reports.length === 0 ? (
          <p className="mt-2 rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No open reports.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-text">
                    <span className="font-medium capitalize">{r.targetType}</span> ·{" "}
                    {r.targetType === "spot" ? (
                      <span className="font-medium">{r.targetLabel ?? `#${r.targetId}`}</span>
                    ) : (
                      <span>{r.targetLabel ?? `#${r.targetId}`}</span>
                    )}
                  </p>
                  {r.reason ? <p className="mt-0.5 text-[12px] text-muted">{r.reason}</p> : null}
                  <p className="mt-0.5 text-[11px] text-faint">reported by {r.reporterNickname ?? "?"}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(`/api/admin/reports/${r.id}`, { action: "resolved" })}
                    className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-fg hover:bg-accent-hover"
                  >
                    Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => act(`/api/admin/reports/${r.id}`, { action: "dismissed" })}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text hover:bg-surface-2"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-[18px] text-text">Spot requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No open requests.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-text">
                    <span className="font-medium capitalize">{r.kind}</span> ·{" "}
                    <Link href={`/spot/${r.spotSlug}`} className="font-medium hover:text-accent">
                      {r.spotName}
                    </Link>{" "}
                    <span className="text-muted">by {r.requesterNickname}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(`/api/admin/requests/${r.id}`, { action: "approved" })}
                    className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-fg hover:bg-accent-hover"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => act(`/api/admin/requests/${r.id}`, { action: "denied" })}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text hover:bg-surface-2"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-[18px] text-text">Merge spots</h2>
        <form onSubmit={merge} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="Target spot id"
            inputMode="numeric"
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-text placeholder:text-faint"
          />
          <input
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            placeholder="Source spot id"
            inputMode="numeric"
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-text placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={merging || !targetId || !sourceId}
            className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-45"
          >
            Merge source into target
          </button>
          {mergeMsg ? <span className="text-[13px] text-muted">{mergeMsg}</span> : null}
        </form>
        <p className="mt-1 text-[12px] text-faint">
          Moves the source&apos;s reviews, photos, visits, saves and categories into the target, then
          deletes the source. Ids are shown on each spot&apos;s edit URL.
        </p>
      </section>
    </div>
  );
}
