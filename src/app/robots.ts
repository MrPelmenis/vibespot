import type { MetadataRoute } from "next";

/**
 * Crawl control. This is what the legacy site never had — it returned a 404 for
 * /robots.txt and had no sitemap at all.
 *
 * Note: robots.txt controls crawling, not indexing. To actually keep a page out of
 * search results use a `noindex` robots meta tag (`export const metadata = { robots:
 * { index: false } }`) — a Disallow alone does not do it.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL ?? "https://coolspot.lv";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing user-private lives under these, but there is no reason to crawl them.
        disallow: ["/api/", "/signin"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
