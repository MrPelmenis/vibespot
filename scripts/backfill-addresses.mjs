#!/usr/bin/env node
/**
 * Backfills missing `address` (and `city`) on spots by reverse-geocoding their
 * lat/lng. Geoapify primary, LocationIQ fallback — the same providers as the app's
 * `/api/geocode/reverse` route, but run offline as a one-off maintenance script.
 *
 * Idempotent: only spots with a NULL/empty address are touched, so it is safe to
 * re-run. The `spots_search_trigger` (0003) recomputes `search_norm` on UPDATE, so a
 * newly-filled `city` flows into search automatically.
 *
 * Usage:
 *   npm run backfill:addresses            # apply
 *   npm run backfill:addresses -- --dry-run
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load Next-style env files; real environment variables always win.
for (const name of [".env", ".env.local"]) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked the environment and .env/.env.local).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const dryRun = process.argv.includes("--dry-run");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function reverseGeocode(lat, lng) {
  const geoapify = process.env.GEOAPIFY_API_KEY;
  if (geoapify) {
    try {
      const res = await fetch(
        "https://api.geoapify.com/v1/geocode/reverse?" +
          new URLSearchParams({
            lat: String(lat),
            lon: String(lng),
            format: "json",
            apiKey: geoapify,
          }),
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        const r = data.results?.[0];
        if (r?.formatted) {
          return { address: r.formatted, city: r.city ?? r.county ?? r.state ?? null };
        }
      }
    } catch {
      // fall through to the next provider
    }
  }

  const locationiq = process.env.LOCATIONIQ_API_KEY;
  if (locationiq) {
    try {
      const res = await fetch(
        "https://us1.locationiq.com/v1/reverse?" +
          new URLSearchParams({
            key: locationiq,
            lat: String(lat),
            lon: String(lng),
            format: "json",
          }),
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.display_name) {
          return { address: data.display_name, city: data.address?.city ?? null };
        }
      }
    } catch {
      // no provider available
    }
  }

  return null;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, name, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
     FROM spots
     WHERE address IS NULL OR address = ''
     ORDER BY id`,
  );

  console.log(`Found ${rows.length} spot(s) without an address${dryRun ? " (dry run)" : ""}.`);

  let updated = 0;
  for (const s of rows) {
    const geo = await reverseGeocode(s.lat, s.lng);
    if (!geo?.address) {
      console.warn(`  ✗ ${s.name} (id ${s.id}): no reverse-geocode result`);
      continue;
    }

    if (!dryRun) {
      await pool.query(
        `UPDATE spots SET address = $1, city = COALESCE(NULLIF(city, ''), $2) WHERE id = $3`,
        [geo.address, geo.city, s.id],
      );
    }
    console.log(`  ✓ ${s.name} → ${geo.address}${geo.city ? ` (${geo.city})` : ""}`);
    updated += 1;
    await sleep(250); // stay within the free-tier rate limit
  }

  console.log(`\nDone: ${dryRun ? "would update" : "updated"} ${updated} spot(s).`);
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});

