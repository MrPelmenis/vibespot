"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { AdminReviewControls } from "@/components/admin/AdminReviewControls";
import { categoryIcon } from "@/lib/categories";

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

export type AdminUser = {
  id: number;
  nickname: string;
  email: string;
  isAdmin: boolean;
  isDeleted: boolean;
};

export type AdminCategory = {
  id: number;
  slug: string;
  name: string;
  color: string;
  icon: string;
};

export type ReviewRow = {
  id: number;
  spotId: number;
  spotName: string;
  spotSlug: string;
  authorNickname: string | null;
  rating: number;
  body: string | null;
  createdAt: string;
};

type SearchResult = {
  users: { id: number; nickname: string; spotCount: number }[];
  spots: { id: number; slug: string; name: string }[];
};

/** Admin moderation surface: report queue, spot requests, search + delete tools, and merge. */
export function AdminPanel({
  reports,
  requests,
  users,
  categories,
  reviews,
}: {
  reports: ReportRow[];
  requests: RequestRow[];
  users: AdminUser[];
  categories: AdminCategory[];
  reviews: ReviewRow[];
}) {
  const router = useRouter();
  const [targetId, setTargetId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [merging, setMerging] = useState(false);
  const [mergeMsg, setMergeMsg] = useState("");

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult>({ users: [], spots: [] });
  const [searching, setSearching] = useState(false);

  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#7a7f87");
  const [catIcon, setCatIcon] = useState("MapPin");
  const [userQuery, setUserQuery] = useState("");

  async function act(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) router.refresh();
  }

  async function del(url: string) {
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function patch(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "PATCH",
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
    setMergeMsg(res.ok ? "Merged." : "Merge failed — check the ids.");
    if (res.ok) {
      setTargetId("");
      setSourceId("");
      router.refresh();
    }
    setMerging(false);
  }

  async function search(value: string) {
    setQ(value);
    if (!value.trim()) {
      setResults({ users: [], spots: [] });
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`);
      if (res.ok) setResults((await res.json()) as SearchResult);
    } finally {
      setSearching(false);
    }
  }

  async function addCategory(event: React.FormEvent) {
    event.preventDefault();
    if (!catName.trim()) return;
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: catName, color: catColor, icon: catIcon }),
    });
    setCatName("");
    router.refresh();
  }

  const confirmDel = (label: string, id: number) => window.confirm(`Delete ${label} #${id}?`);

  const filteredUsers = users.filter((u) => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.id).includes(q) ||
      u.nickname.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });
  const NewCatIcon = categoryIcon(catIcon.trim());

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-[22px] text-text">Admin</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Reports, spot requests, search/delete tools and the merge tool.
        </p>
      </div>

      <section>
        <h2 className="font-heading text-[18px] text-text">Find spot / user</h2>
        <div className="relative mt-2">
          <Search
            size={15}
            strokeWidth={2.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search by spot name or user nickname…"
            aria-label="Search spots and users"
            className="w-full rounded-full border border-line bg-surface-2 py-2 pl-9 pr-3 text-[13px] text-text placeholder:text-faint"
          />
        </div>
        {searching ? (
          <p className="mt-1.5 text-[12px] text-faint">Searching…</p>
        ) : results.users.length > 0 || results.spots.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1.5">
            {results.users.map((u) => (
              <li key={`u-${u.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <span className="text-[13px] text-text">
                  <span className="font-medium text-faint">#{u.id}</span>{" "}
                  <Link href={`/u/${encodeURIComponent(u.nickname)}`} className="font-medium hover:text-accent">
                    {u.nickname}
                  </Link>{" "}
                  <span className="text-muted">({u.spotCount} spots)</span>
                </span>
                <button
                  type="button"
                  onClick={() => { if (confirmDel("user", u.id)) del(`/api/admin/users/${u.id}`); }}
                  className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-danger hover:bg-surface-2"
                >
                  Delete
                </button>
              </li>
            ))}
            {results.spots.map((s) => (
              <li key={`s-${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <span className="text-[13px] text-text">
                  <span className="font-medium text-faint">#{s.id}</span>{" "}
                  <Link href={`/spot/${s.slug}`} className="font-medium hover:text-accent">
                    {s.name}
                  </Link>
                </span>
                <span className="flex gap-2">
                  <Link
                    href={`/spots/${s.id}/edit`}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text hover:bg-surface-2"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => { if (confirmDel("spot", s.id)) del(`/api/admin/spots/${s.id}`); }}
                    className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-danger hover:bg-surface-2"
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : q.trim() ? (
          <p className="mt-1.5 text-[12px] text-faint">No matches.</p>
        ) : null}
      </section>

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
                    <span className="font-medium">{r.targetLabel ?? `#${r.targetId}`}</span>{" "}
                    <span className="text-faint">#{r.targetId}</span>
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
                    <span className="text-muted">by {r.requesterNickname}</span>{" "}
                    <span className="text-faint">#{r.spotId}</span>
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
        <h2 className="font-heading text-[18px] text-text">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 rounded-md border border-line bg-surface p-4 text-[13px] text-muted">
            No reviews yet.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[13px] text-text">
                    <span className="font-medium text-faint">#{r.id}</span>{" "}
                    <Link href={`/spot/${r.spotSlug}`} className="font-medium hover:text-accent">
                      {r.spotName}
                    </Link>{" "}
                    <span className="text-muted">by {r.authorNickname ?? "former user"}</span>{" "}
                    <span className="text-star">★ {r.rating}</span>
                  </p>
                  {r.body ? <p className="mt-0.5 truncate text-[12px] text-muted">{r.body}</p> : null}
                </div>
                <AdminReviewControls
                  reviewId={r.id}
                  initialRating={r.rating}
                  initialBody={r.body}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-heading text-[18px] text-text">Users</h2>
        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Search by id, nickname or email…"
          className="mt-2 w-full rounded-full border border-line bg-surface-2 px-3 py-2 text-[13px] text-text placeholder:text-faint"
        />
        <ul className="mt-2 flex flex-col gap-1.5">
          {filteredUsers.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <span className="text-[13px] text-text">
                <span className="font-medium text-faint">#{u.id}</span>{" "}
                <Link href={`/u/${encodeURIComponent(u.nickname)}`} className="font-medium hover:text-accent">
                  {u.nickname}
                </Link>{" "}
                <span className="text-muted">{u.email}</span>{" "}
                {u.isAdmin ? <span className="text-[11px] font-medium text-accent">admin</span> : null}
                {u.isDeleted ? <span className="text-[11px] text-faint">deleted</span> : null}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  disabled={u.isDeleted}
                  onClick={() => patch(`/api/admin/users/${u.id}`, { isAdmin: !u.isAdmin })}
                  className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-text hover:bg-surface-2 disabled:opacity-40"
                >
                  {u.isAdmin ? "Remove admin" : "Make admin"}
                </button>
                <button
                  type="button"
                  disabled={u.isDeleted}
                  onClick={() => { if (confirmDel("user", u.id)) del(`/api/admin/users/${u.id}`); }}
                  className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-danger hover:bg-surface-2 disabled:opacity-40"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-heading text-[18px] text-text">Categories</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
              <span className="text-[13px] text-text">
                <span className="font-medium text-faint">#{c.id}</span>{" "}
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-muted">{c.icon}</span>{" "}
                <span
                  className="inline-block h-3 w-3 rounded-full align-middle"
                  style={{ backgroundColor: c.color }}
                />
              </span>
              <button
                type="button"
                onClick={() => { if (confirmDel("category", c.id)) del(`/api/admin/categories/${c.id}`); }}
                className="rounded-full border border-line-strong px-3 py-1 text-[12px] text-danger hover:bg-surface-2"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCategory} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Name"
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-text placeholder:text-faint"
          />
          <input
            value={catIcon}
            onChange={(e) => setCatIcon(e.target.value)}
            placeholder="Icon (e.g. Coffee)"
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-text placeholder:text-faint"
          />
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-2"
            style={{ color: catColor }}
            title={`Preview: ${catIcon || "MapPin"}`}
          >
            <NewCatIcon size={16} strokeWidth={2.75} aria-hidden="true" />
          </span>
          <input
            type="color"
            value={catColor}
            onChange={(e) => setCatColor(e.target.value)}
            aria-label="Category color"
            className="h-8 w-10 rounded border border-line bg-surface-2"
          />
          <button
            type="submit"
            disabled={!catName.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-45"
          >
            Add category
          </button>
        </form>
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
          deletes the source.
        </p>
      </section>
    </div>
  );
}
