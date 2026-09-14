import "server-only";

import type { GeocodeResult, ReverseGeocodeResult } from "@/lib/types";

/**
 * Geocoding proxy — the API keys never reach the browser. Geoapify is primary,
 * LocationIQ the fallback (per the spec's decided order). If no key is configured the
 * helpers return empty results so the create flow still works with a manual pin.
 */

export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const geoapify = process.env.GEOAPIFY_API_KEY;
  if (geoapify) {
    try {
      const url =
        "https://api.geoapify.com/v1/geocode/autocomplete?" +
        new URLSearchParams({ text: query, format: "json", apiKey: geoapify });
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: { formatted?: string; lat?: number; lon?: number }[];
        };
        return (data.results ?? [])
          .filter((r) => typeof r.lat === "number" && typeof r.lon === "number")
          .map((r) => ({ label: r.formatted ?? "", lat: r.lat!, lng: r.lon! }))
          .slice(0, 8);
      }
    } catch {
      // fall through to the next provider
    }
  }

  const locationiq = process.env.LOCATIONIQ_API_KEY;
  if (locationiq) {
    try {
      const url =
        "https://us1.locationiq.com/v1/autocomplete?" +
        new URLSearchParams({ key: locationiq, q: query, format: "json", limit: "8" });
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          display_name?: string;
          lat?: string;
          lon?: string;
        }[];
        return data.map((r) => ({
          label: r.display_name ?? "",
          lat: Number.parseFloat(r.lat ?? "0"),
          lng: Number.parseFloat(r.lon ?? "0"),
        }));
      }
    } catch {
      // no provider available
    }
  }

  return [];
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  const geoapify = process.env.GEOAPIFY_API_KEY;
  if (geoapify) {
    try {
      const url =
        "https://api.geoapify.com/v1/geocode/reverse?" +
        new URLSearchParams({
          lat: String(lat),
          lon: String(lng),
          format: "json",
          apiKey: geoapify,
        });
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          results?: {
            formatted?: string;
            city?: string;
            county?: string;
            state?: string;
          }[];
        };
        const r = data.results?.[0];
        if (r) {
          return {
            address: r.formatted ?? "",
            city: r.city ?? r.county ?? r.state ?? null,
          };
        }
      }
    } catch {
      // fall through
    }
  }
  return null;
}
