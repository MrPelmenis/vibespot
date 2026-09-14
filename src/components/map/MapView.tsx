"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Layers, LocateFixed, Search, X, type LucideIcon } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { SpotImage } from "@/components/SpotImage";
import { categoryIcon } from "@/lib/categories";
import { tileAttribution, tileUrl, type TileStyle } from "@/lib/mapStyle";
import type { CategorySummary, SpotSummary } from "@/lib/types";

const STATE_KEY = "coolspot-map-state";

function markerIcon(spot: SpotSummary): L.DivIcon {
  const primary = spot.primaryCategory ?? spot.categories[0];
  const color = primary?.color ?? "#7a7f87";
  const Icon = categoryIcon(primary?.icon ?? "MapPin");
  const svg = renderToStaticMarkup(
    <Icon size={15} strokeWidth={2.75} color="#fff" aria-hidden="true" />,
  );
  return L.divIcon({
    className: "",
    html: `<span class="cs-pin" style="background-color:${color}">${svg}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}

const USER_ICON = L.divIcon({
  className: "",
  html: '<span class="cs-user-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function popupElement(spot: SpotSummary): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cs-popup";

  if (spot.media[0]) {
    const imgLink = document.createElement("a");
    imgLink.href = `/spot/${encodeURIComponent(spot.slug)}`;
    const img = document.createElement("img");
    img.src = spot.media[0].thumbUrl;
    img.alt = "";
    img.className = "cs-popup-img";
    imgLink.appendChild(img);
    wrap.appendChild(imgLink);
  }

  const link = document.createElement("a");
  link.href = `/spot/${encodeURIComponent(spot.slug)}`;
  link.className = "cs-popup-title";
  link.textContent = spot.name;
  wrap.appendChild(link);

  const meta = document.createElement("div");
  meta.className = "cs-popup-cat";
  if (spot.creatorNickname) {
    const by = document.createElement("a");
    by.href = `/u/${encodeURIComponent(spot.creatorNickname)}`;
    by.className = "cs-popup-by";
    by.textContent = `by ${spot.creatorNickname}`;
    meta.appendChild(by);
  }
  const primary = spot.primaryCategory;
  if (primary) {
    const dot = document.createElement("span");
    dot.className = "cs-popup-dot";
    dot.style.backgroundColor = primary.color;
    const name = document.createElement("span");
    name.textContent = primary.name;
    meta.appendChild(dot);
    meta.appendChild(name);
  }
  wrap.appendChild(meta);
  return wrap;
}

export type MapViewProps = {
  initialSpots: SpotSummary[];
  categories: CategorySummary[];
  center: [number, number]; // [lng, lat]
  zoom: number;
  /** Ignore the saved map state and use `center`/`zoom` (used by "View on map"). */
  reset?: boolean;
};

export function MapView({ initialSpots, categories, center, zoom, reset }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const activeCategoryRef = useRef<number | null>(null);

  const [spots, setSpots] = useState<SpotSummary[]>(initialSpots);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [style, setStyle] = useState<TileStyle>("streets");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotSummary[]>([]);

  const reload = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    const params = new URLSearchParams({
      bbox: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
      limit: "50",
    });
    const categoryId = activeCategoryRef.current;
    if (categoryId != null) params.set("categoryIds", String(categoryId));
    try {
      const res = await fetch(`/api/spots?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { spots: SpotSummary[] };
        setSpots(data.spots);
      }
    } catch {
      // offline — keep markers
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let savedCenter: [number, number] = [center[1], center[0]];
    let savedZoom = zoom;
    if (!reset) {
      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          const s = JSON.parse(raw) as { c?: number[]; z?: number };
          if (Array.isArray(s.c) && s.c.length === 2 && typeof s.z === "number") {
            savedCenter = [s.c[0], s.c[1]];
            savedZoom = s.z;
          }
        }
      } catch {
        // ignore bad state
      }
    }

    const map = L.map(containerRef.current, {
      center: savedCenter,
      zoom: savedZoom,
      zoomControl: false,
      attributionControl: false,
    });
    const tiles = L.tileLayer(tileUrl("streets"), { attribution: tileAttribution(), maxZoom: 19 }).addTo(map);
    tileRef.current = tiles;
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Fetch spots for the current viewport immediately on open (initialSpots only cover
    // the default Rīga bbox, which may not match a restored map state).
    void reload();
    map.on("moveend", () => {
      void reload();
      const c = map.getCenter();
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ c: [c.lat, c.lng], z: map.getZoom() }));
      } catch {
        // storage unavailable
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const spot of spots) {
      L.marker([spot.lat, spot.lng], { icon: markerIcon(spot) })
        .bindPopup(popupElement(spot), { closeButton: false, offset: L.point(0, -14) })
        .addTo(layer);
    }
  }, [spots]);

  function selectCategory(id: number | null) {
    activeCategoryRef.current = id;
    setActiveCategory(id);
    void reload();
  }

  function toggleStyle() {
    setStyle((s) => {
      const next = s === "streets" ? "satellite" : "streets";
      tileRef.current?.setUrl(tileUrl(next));
      return next;
    });
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng(latlng);
        } else if (mapRef.current) {
          userMarkerRef.current = L.marker(latlng, { icon: USER_ICON }).addTo(mapRef.current);
        }
        mapRef.current?.flyTo(latlng, 15, { duration: 0.4 });
      },
      () => {},
      { enableHighAccuracy: true },
    );
  }

  function onSearch(value: string) {
    setQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      .then((res) => (res.ok ? res.json() : { spots: [] }))
      .then((data: { spots: SpotSummary[] }) => setResults(data.spots ?? []))
      .catch(() => setResults([]));
  }

  function chooseSpot(spot: SpotSummary) {
    mapRef.current?.flyTo([spot.lat, spot.lng], 15, { duration: 0.4 });
    setQuery("");
    setResults([]);
    void reload();
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Search */}
      <div className="absolute left-2 right-2 top-2 z-10">
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
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setResults([]);
            }}
            onBlur={() => setTimeout(() => setResults([]), 150)}
            placeholder="Search spots…"
            aria-label="Search spots"
            className="w-full rounded-full border border-line bg-surface py-2 pl-9 pr-8 text-[14px] text-text shadow-md placeholder:text-faint"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-text"
            >
              <X size={14} strokeWidth={2.75} aria-hidden="true" />
            </button>
          ) : null}
          {results.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
              {results.map((spot) => (
                <li key={spot.id}>
                  <button
                    type="button"
                    onClick={() => chooseSpot(spot)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
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
                      <span className="block truncate text-[13px] font-medium text-text">{spot.name}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {spot.primaryCategory?.name ?? ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Layer toggle (bottom-left) */}
      <button
        type="button"
        onClick={toggleStyle}
        aria-label={style === "streets" ? "Switch to satellite view" : "Switch to streets view"}
        title={style === "streets" ? "Satellite" : "Streets"}
        className="absolute bottom-28 left-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted shadow-md transition-colors hover:text-text"
      >
        <Layers size={17} strokeWidth={2.75} aria-hidden="true" />
      </button>
      {/* Locate (bottom-right) */}
      <button
        type="button"
        onClick={locate}
        aria-label="Locate me"
        title="Locate me"
        className="absolute bottom-28 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted shadow-md transition-colors hover:text-text"
      >
        <LocateFixed size={17} strokeWidth={2.75} aria-hidden="true" />
      </button>

      {/* Category filter (hidden while searching so results stay readable) */}
      {!query.trim() ? (
        <div
          className="absolute left-2 right-2 top-14 z-10 flex gap-1.5 overflow-x-auto rounded-full bg-surface/90 p-1 shadow-md backdrop-blur"
          role="group"
          aria-label="Filter spots by category"
        >
          <FilterChip label="All" active={activeCategory === null} onClick={() => selectCategory(null)} />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              color={c.color}
              icon={categoryIcon(c.icon)}
              active={activeCategory === c.id}
              onClick={() => selectCategory(c.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Bottom strip */}
      <div className="pointer-events-auto absolute inset-x-2 bottom-2 z-10">
        <p className="mb-1.5 inline-block rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-text shadow-md">
          {spots.length} {spots.length === 1 ? "spot" : "spots"} in view
        </p>
        {spots.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {spots.map((spot) => (
              <li key={spot.id} className="shrink-0">
                <Link
                  href={`/spot/${spot.slug}`}
                  className="flex w-40 items-center gap-2 rounded-md border border-line bg-surface p-2 shadow-md transition-colors hover:bg-surface-2"
                >
                  {spot.media[0] ? (
                    <SpotImage
                      url={spot.media[0].url}
                      thumbUrl={spot.media[0].thumbUrl}
                      width={spot.media[0].width}
                      height={spot.media[0].height}
                      alt={`${spot.name} — cover photo`}
                      className="h-9 w-9 shrink-0 rounded-md object-cover washed"
                    />
                  ) : (
                    <span
                      className="h-9 w-9 shrink-0 rounded-md"
                      style={{ backgroundColor: `${spot.primaryCategory?.color ?? "#7a7f87"}1f` }}
                    />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-text">{spot.name}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {spot.primaryCategory?.name ?? ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-muted shadow-md">
            No spots in this area yet — pan around, or be the first to add one.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors"
      style={
        active
          ? color
            ? { backgroundColor: color, color: "#fff" }
            : { backgroundColor: "var(--accent)", color: "var(--accent-fg)" }
          : color
            ? { color }
            : undefined
      }
    >
      {Icon ? <Icon size={13} strokeWidth={2.75} aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
