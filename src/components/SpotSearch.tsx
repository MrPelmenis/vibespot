"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, User } from "lucide-react";
import { SpotImage } from "@/components/SpotImage";
import { avatarUrl } from "@/lib/avatar";
import type { SpotSummary } from "@/lib/types";
import type { UserSearchResult } from "@/lib/users";

type Results = { users: UserSearchResult[]; spots: SpotSummary[] };

/**
 * The one-box search. Debounces against /api/search and shows a dropdown with
 * matching users first (profile → their spots), then spot results. The debounce lives
 * in the change handler (not an effect) so state updates never cascade through an effect.
 */
export function SpotSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ users: [], spots: [] });
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed) {
      setResults({ users: [], spots: [] });
      setOpen(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = (await res.json()) as Results;
          setResults({ users: data.users ?? [], spots: data.spots ?? [] });
          setOpen(true);
        }
      } catch {
        // offline — ignore
      } finally {
        setSearching(false);
      }
    }, 250);
  }

  const hasAny = results.users.length > 0 || results.spots.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={2.75}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search people, spots, categories…"
          aria-label="Search"
          className="w-full rounded-full border border-line bg-surface-2 py-2.5 pl-9 pr-3 text-[14px] text-text placeholder:text-faint"
        />
      </div>

      {open && query.trim() ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
          {searching ? (
            <p className="px-3 py-2 text-[13px] text-muted">Searching…</p>
          ) : !hasAny ? (
            <p className="px-3 py-2 text-[13px] text-muted">No people or spots match “{query}”.</p>
          ) : (
            <ul>
              {results.users.map((user) => {
                const avatar = avatarUrl(user.avatarPath);
                return (
                  <li key={`u-${user.id}`}>
                    <Link
                      href={`/u/${encodeURIComponent(user.nickname)}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2"
                    >
                      {avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatar}
                          alt=""
                          width={36}
                          height={36}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent">
                          <User size={16} strokeWidth={2.75} aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-text">
                          {user.nickname}
                        </span>
                        <span className="block truncate text-[11px] text-muted">
                          {user.spotCount} {user.spotCount === 1 ? "spot" : "spots"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}

              {results.spots.map((spot) => (
                <li key={`s-${spot.id}`}>
                  <Link
                    href={`/spot/${spot.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2"
                  >
                    {spot.media[0] ? (
                      <SpotImage
                        url={spot.media[0].url}
                        thumbUrl={spot.media[0].thumbUrl}
                        width={spot.media[0].width}
                        height={spot.media[0].height}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-md object-cover washed"
                      />
                    ) : (
                      <span className="h-9 w-9 shrink-0 rounded-md bg-surface-2" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-text">
                        {spot.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {spot.primaryCategory?.name ?? ""}
                        {spot.city ? ` · ${spot.city}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
