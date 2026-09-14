import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, types } from "pg";
import * as schema from "@/db/schema";

/**
 * Postgres connection pool + Drizzle client.
 *
 * The pool is created once and cached on `globalThis` so Next.js dev-mode hot
 * reloads do not open a new pool per module instance (which exhausts connections).
 *
 * `DATABASE_URL` is read lazily at pool construction rather than asserted here, so
 * `next build` does not require a database just to bundle the app. A missing or
 * wrong URL surfaces as a clear connection error on the first query instead.
 */

// int8 (OID 20) → number. Raw SQL via `pool.query` bypasses Drizzle's mappers, which
// would otherwise hand back bigint ids as strings. CoolSpot ids never approach 2^53,
// so this is safe and keeps raw and Drizzle results consistent.
types.setTypeParser(20, (value) => Number.parseInt(value, 10));

// `date` (OID 1082) → keep the raw "YYYY-MM-DD" string. The default parser turns it
// into a Date at local midnight, which both shifts the day across timezones and makes
// React throw "Objects are not valid as a React child" when rendered directly.
types.setTypeParser(1082, (value) => value);

const globalForDb = globalThis as unknown as { coolspotPool?: Pool };

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    // Never let a connection go stale silently across a Postgres restart.
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalForDb.coolspotPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.coolspotPool = pool;
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  return url;
}
