#!/usr/bin/env node
/**
 * Applies the versioned SQL migrations in `drizzle/` in filename order, recording
 * each applied file in a `_coolspot_migrations` table so re-runs are idempotent.
 *
 * The extensions (postgis, pg_trgm, unaccent, citext) are NOT created here — they
 * are a one-time superuser prerequisite (see README "Database"), because the app
 * role that runs these migrations cannot create `postgis` itself.
 *
 * Usage:
 *   npm run migrate
 *
 * Reads DATABASE_URL from the environment, or from `.env` / `.env.local` (Next's
 * convention) so it works without a dotenv dependency.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load Next-style env files; real environment variables always win.
for (const name of [".env", ".env.local"]) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (checked the environment and .env/.env.local).");
  process.exit(1);
}

const migrationsDir = path.join(root, "drizzle");
const pool = new pg.Pool({ connectionString: url });

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _coolspot_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await pool.query("SELECT name FROM _coolspot_migrations");
  const applied = new Set(rows.map((r) => r.name));

  let newCount = 0;
  let failed = false;

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _coolspot_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  ✓ applied ${file}`);
      newCount += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`\n✗ migration ${file} failed:`);
      console.error(error.message);
      failed = true;
      break;
    } finally {
      client.release();
    }
  }

  if (!failed) {
    console.log(
      newCount === 0
        ? `  nothing to apply — all ${files.length} migration(s) already recorded.`
        : `\nMigrations complete (${files.length} file(s) total).`,
    );
  }

  await pool.end();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
