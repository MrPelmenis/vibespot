"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search } from "lucide-react";
import { tileAttribution, tileUrl } from "@/lib/mapStyle";
import type { GeocodeResult } from "@/lib/types";

/**
 * A small Leaflet map with a draggable pin + a place-name search box, used by the spot
 * form. Picking a location also reverse-geocodes an address/city (when a key is set).
 */

const DEFAULT_CENTER: [number, number] = [24.1052, 56.9496]; // Rīga

export type PickedLocation = {
  lat: number;
  lng: number;
  address: string;
  city: string | null;
};

const LOCATOR_ICON = L.divIcon({
  className: "",
  html: '<span class="cs-pin cs-pin--accent"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

export type LocationPickerProps = {
  lat?: number | null;
  lng?: number | null;
  onChange: (value: PickedLocation) => void;
};

export function LocationPicker({ lat, lng, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const hasPin = typeof lat === "number" && typeof lng === "number";
  const center: [number, number] = hasPin ? [lng as number, lat as number] : DEFAULT_CENTER;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center[1], center[0]],
      zoom: hasPin ? 14 : 11,
      attributionControl: false,
    });
    L.tileLayer(tileUrl(), { attribution: tileAttribution(), maxZoom: 19 }).addTo(map);
    const marker = L.marker([center[1], center[0]], { draggable: true, icon: LOCATOR_ICON }).addTo(map);
    mapRef.current = map;
    markerRef.current = marker;

    async function notify(mlat: number, mlng: number) {
      onChangeRef.current({ lng: mlng, lat: mlat, address: "", city: null });
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${mlat}&lng=${mlng}`);
        if (res.ok) {
          const data = (await res.json()) as {
            result?: { address?: string; city?: string | null };
          };
          if (data.result) {
            onChangeRef.current({
              lng: mlng,
              lat: mlat,
              address: data.result.address ?? "",
              city: data.result.city ?? null,
            });
          }
        }
      } catch {
        // no geocoding key — the pin still works
      }
    }

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      void notify(pos.lat, pos.lng);
    });
    map.on("click", (event: L.LeafletMouseEvent) => {
      marker.setLatLng(event.latlng);
      void notify(event.latlng.lat, event.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearched(false);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(value)}`);
        if (res.ok) {
          const data = (await res.json()) as { results?: GeocodeResult[] };
          setResults(data.results ?? []);
          setSearched(true);
        } else {
          setSearched(true);
          setResults([]);
        }
      } catch {
        setSearched(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }

  function choose(result: GeocodeResult) {
    setQuery(result.label);
    setResults([]);
    const map = mapRef.current;
    const marker = markerRef.current;
    if (map && marker) {
      map.flyTo([result.lat, result.lng], 15);
      marker.setLatLng([result.lat, result.lng]);
    }
    onChange({ lng: result.lng, lat: result.lat, address: result.label, city: null });
  }

  return (
    <div>
      <div className="relative z-10 mb-2">
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
            onChange={(event) => onSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setResults([]);
            }}
            onBlur={() => setTimeout(() => setResults([]), 150)}
            placeholder="Search for a place or address…"
            aria-label="Search for a place or address"
            className="w-full rounded-full border border-line bg-surface-2 py-2 pl-9 pr-3 text-[14px] text-text placeholder:text-faint"
          />
          {results.length > 0 ? (
            <ul
              className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-md"
              onMouseDown={(event) => event.preventDefault()}
            >
              {results.map((result, index) => (
                <li key={`${result.lat}-${result.lng}-${index}`}>
                  <button
                    type="button"
                    onClick={() => choose(result)}
                    className="w-full px-3 py-2 text-left text-[13px] text-text transition-colors hover:bg-surface-2"
                  >
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {searching ? (
          <p className="mt-1 text-[12px] text-faint">Searching…</p>
        ) : searched && results.length === 0 ? (
          <p className="mt-1 text-[12px] text-faint">No places found — or just click the map to drop the pin.</p>
        ) : null}
      </div>

      <div ref={containerRef} className="relative z-0 h-56 w-full overflow-hidden rounded-md border border-line" />
      <p className="mt-1 text-[12px] text-muted">Click the map or drag the pin to set the location.</p>
    </div>
  );
}
