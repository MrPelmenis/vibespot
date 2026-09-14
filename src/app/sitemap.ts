import type { MetadataRoute } from "next";
import { listCategories, listSpotsForSitemap } from "@/lib/spots";

// The sitemap must reflect the live tables, not a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * Sitemap for crawlers. Every spot gets its own crawlable URL, and the index pages
 * (/spots, /category/<slug>) link the rest so nothing is orphaned. Only `lastModified`
 * is meaningful to Google — changeFrequency and priority are ignored, so omitted.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.SITE_URL ?? "https://coolspot.lv").replace(/\/$/, "");
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now },
    { url: `${base}/map`, lastModified: now },
    { url: `${base}/spots`, lastModified: now },
    { url: `${base}/leaderboard`, lastModified: now },
  ];

  try {
    const categories = await listCategories();
    for (const category of categories) {
      entries.push({ url: `${base}/category/${category.slug}`, lastModified: now });
    }

    const spots = await listSpotsForSitemap();
    for (const spot of spots) {
      entries.push({
        url: `${base}/spot/${spot.slug}`,
        lastModified: new Date(spot.updatedAt),
      });
    }
  } catch {
    // Database unavailable (e.g. before the first migration) — degrade gracefully.
  }

  return entries;
}
