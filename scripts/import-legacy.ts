#!/usr/bin/env node
/**
 * One-time legacy import: reads the legacy SQLite DB and its `uploads/` tree
 * (read-only) and writes the 11 live spots, their 14 images and the 9 users into
 * Postgres. Verbatim text, correct timestamps, community ownership for the sentinel
 * "deleted" user's spots, base64 avatars extracted to WebP, animated GIFs kept as-is.
 *
 * Idempotent: users are keyed on email, spots on their generated slug, so re-running
 * skips what is already present. It refuses to run if the legacy DB is missing.
 *
 * The 15 comments, 1 comment image and all likes are deliberately NOT imported (the
 * owners dropped them), and spot ids 30–61 (the pre-2025-01-30 era) are skipped.
 *
 * Usage:  npm run import:legacy
 * Env:    LEGACY_DIR (defaults to the parent directory, where the legacy repo lives),
 *         DATABASE_URL, MEDIA_ROOT — all otherwise read from .env / .env.local.
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Env (Next convention; real environment wins) ─────────────────────────────
for (const name of [".env", ".env.local"]) {
  const file = path.join(projectRoot, name);
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

const legacyRoot = path.resolve(process.env.LEGACY_DIR ?? path.resolve(projectRoot, ".."));
const legacyDbPath = path.join(legacyRoot, "BackEnd","db", "main_db.db");
const uploadsDir = path.join(legacyRoot, "BackEnd", "uploads", "spot_images");

if (!existsSync(legacyDbPath)) {
  console.error(`Legacy database not found at ${legacyDbPath}`);
  console.error("Set LEGACY_DIR to the legacy repo checkout, e.g. LEGACY_DIR=/path/to/coolspot");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (checked the environment and .env/.env.local).");
  process.exit(1);
}

const mediaRoot = path.isAbsolute(process.env.MEDIA_ROOT ?? "")
  ? process.env.MEDIA_ROOT
  : path.resolve(projectRoot, process.env.MEDIA_ROOT ?? "./data/media");

const sqlite = new DatabaseSync(legacyDbPath, { readOnly: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const MASTER_LONG_EDGE = 2560;
const THUMB_LONG_EDGE = 400;
const WEBP_QUALITY = 80;
const AVATAR_SIZE = 256;

// ── Helpers ──────────────────────────────────────────────────────────────────

const LATVIAN = { ā: "a", č: "c", ē: "e", ģ: "g", ī: "i", ķ: "k", ļ: "l", ņ: "n", š: "s", ū: "u", ž: "z" };

function slugify(input: string): string {
  const t = Array.from(input)
    .map((ch) => LATVIAN[ch.toLowerCase()] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return t
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Europe/Riga is UTC+2 (EET) in winter, UTC+3 (EEST) from the last Sunday of March to
// the last Sunday of October. The four naive timestamps are all mid-winter, but this
// computes the offset properly rather than assuming +2.
function rigaOffsetHours(year: number, month0: number, day: number): number {
  const lastSunday = (y: number, m0: number): number => {
    const last = new Date(Date.UTC(y, m0 + 1, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  const start = lastSunday(year, 2);
  const end = lastSunday(year, 9);
  const inDst =
    (month0 === 2 && day >= start) || (month0 > 2 && month0 < 9) || (month0 === 9 && day < end);
  return inDst ? 3 : 2;
}

function parseLegacyTimestamp(ts: string): Date {
  const trimmed = (ts ?? "").trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) return new Date(trimmed);
  const asUtc = new Date(trimmed + "Z");
  if (Number.isNaN(asUtc.getTime())) throw new Error(`Unparseable timestamp: ${ts}`);
  const off = rigaOffsetHours(asUtc.getUTCFullYear(), asUtc.getUTCMonth(), asUtc.getUTCDate());
  return new Date(asUtc.getTime() - off * 3_600_000);
}

async function renderWebP(input: Buffer, longEdge: number) {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

function decodeBase64Image(value: string | null): Buffer | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = /^data:[^;]+;base64,(.*)$/s.exec(trimmed);
  try {
    return match ? Buffer.from(match[1], "base64") : Buffer.from(trimmed, "base64");
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const counts = { users: 0, spots: 0, media: 0, avatars: 0 };

function all<T>(sql: string, params?: unknown[]): T[] {
  return sqlite.prepare(sql).all(...(params ?? [])) as T[];
}

async function main() {
  const legacyTags = all<{ id: number; tag_name: string }>("SELECT id, tag_name FROM tags");
  const legacyUsers = all<{ id: number; nickname: string; email: string; description: string; is_admin: number; profile_pic: string | null }>(
    "SELECT id, nickname, email, description, is_admin, profile_pic FROM users",
  );
  const legacySpots = all<{ id: number; name: string; description: string | null; geolocation: string; user_id: number; timestamp: string }>(
    "SELECT id, name, description, geolocation, user_id, timestamp FROM spots WHERE id BETWEEN 78 AND 88",
  );
  const legacySpotTags = all<{ spot_id: number; tag_id: number }>(
    "SELECT spot_id, tag_id FROM spot_tags WHERE spot_id BETWEEN 78 AND 88 ORDER BY spot_id, tag_id",
  );
  const legacyImages = all<{ id: number; spot_id: number; file_path: string }>(
    "SELECT id, spot_id, file_path FROM spot_images WHERE spot_id BETWEEN 78 AND 88 ORDER BY spot_id, id",
  );

  // categories: name → id
  const catRows = (await pool.query("SELECT id, name FROM categories")).rows as { id: number; name: string }[];
  const catIdByName = new Map(catRows.map((c) => [c.name.toLowerCase(), c.id]));
  const tagNameById = new Map(legacyTags.map((t) => [t.id, t.tag_name]));

  // ── Users ──────────────────────────────────────────────────────────────────
  const userIdMap = new Map<number, number | null>();
  for (const u of legacyUsers) {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [u.email]);
    if (existing.rowCount) {
      userIdMap.set(u.id, existing.rows[0].id);
      continue;
    }
    const inserted = await pool.query(
      `INSERT INTO users (google_sub, email, nickname, description, is_admin)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      // google_sub is unique+not-null; legacy users never signed in via Google, so use
      // a stable synthetic value derived from the legacy id.
      [`legacy:${u.id}`, u.email, u.nickname, u.description ?? null, u.is_admin === 1],
    );
    const newId = inserted.rows[0].id as number;
    userIdMap.set(u.id, newId);
    counts.users += 1;

    const avatar = decodeBase64Image(u.profile_pic);
    if (avatar) {
      try {
        const webp = await sharp(avatar)
          .rotate()
          .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE, fit: "cover" })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer();
        const rel = `avatars/${newId}.webp`;
        const abs = path.join(mediaRoot, rel);
        mkdirSync(path.dirname(abs), { recursive: true });
        writeFileSync(abs, webp);
        await pool.query("UPDATE users SET avatar_path = $1 WHERE id = $2", [rel, newId]);
        counts.avatars += 1;
      } catch (error) {
        console.warn(`  (avatar for legacy user ${u.id} skipped: ${(error as Error).message})`);
      }
    }
  }

  // ── Spots ──────────────────────────────────────────────────────────────────
  const tagsBySpot = new Map<number, number[]>();
  for (const st of legacySpotTags) {
    const list = tagsBySpot.get(st.spot_id) ?? [];
    list.push(st.tag_id);
    tagsBySpot.set(st.spot_id, list);
  }
  const imagesBySpot = new Map<number, { id: number; file_path: string }[]>();
  for (const img of legacyImages) {
    const list = imagesBySpot.get(img.spot_id) ?? [];
    list.push(img);
    imagesBySpot.set(img.spot_id, list);
  }

  const spotIdMap = new Map<number, number>();
  for (const s of legacySpots) {
    const slug = slugify(s.name) || `spot-${s.id}`;
    const existing = await pool.query("SELECT id FROM spots WHERE slug = $1", [slug]);
    if (existing.rowCount) {
      spotIdMap.set(s.id, existing.rows[0].id);
      continue;
    }

    const [lat, lng] = s.geolocation.split(",").map(Number);
    const createdAt = parseLegacyTimestamp(s.timestamp);
    const createdBy = s.user_id === 0 ? null : (userIdMap.get(s.user_id) ?? null);

    const inserted = await pool.query(
      `INSERT INTO spots (slug, name, description, location, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $7)
       RETURNING id`,
      [slug, s.name, s.description ?? null, lng, lat, createdBy, createdAt],
    );
    const spotId = inserted.rows[0].id as number;
    spotIdMap.set(s.id, spotId);
    counts.spots += 1;

    const tagIds = tagsBySpot.get(s.id) ?? [];
    for (let i = 0; i < tagIds.length; i += 1) {
      const tagName = tagNameById.get(tagIds[i]);
      const catId = tagName ? catIdByName.get(tagName.toLowerCase()) : undefined;
      if (!catId) {
        console.warn(`  (no category for legacy tag "${tagName}" on spot ${s.id})`);
        continue;
      }
      await pool.query(
        "INSERT INTO spot_categories (spot_id, category_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        [spotId, catId, i],
      );
    }

    const images = imagesBySpot.get(s.id) ?? [];
    const dir = path.join(mediaRoot, "spots", String(spotId));
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < images.length; i += 1) {
      const src = path.join(uploadsDir, path.basename(images[i].file_path));
      try {
        const input = readFileSync(src);
        const meta = await sharp(input, { failOn: "error" }).metadata();
        const isGif = meta.format === "gif";
        const id = randomUUID();

        let rel: string;
        let thumbRel: string;
        let width = meta.width ?? 0;
        let height = meta.height ?? 0;

        if (isGif) {
          // Preserve the animation: keep the GIF as the master; thumb is a WebP still.
          rel = `spots/${spotId}/${id}-master.gif`;
          thumbRel = `spots/${spotId}/${id}-thumb.webp`;
          writeFileSync(path.join(mediaRoot, rel), input);
          const thumb = await sharp(input).rotate()
            .resize({ width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE, fit: "inside", withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer();
          writeFileSync(path.join(mediaRoot, thumbRel), thumb);
        } else {
          const master = await renderWebP(input, MASTER_LONG_EDGE);
          const thumb = await renderWebP(input, THUMB_LONG_EDGE);
          width = master.width;
          height = master.height;
          rel = `spots/${spotId}/${id}-master.webp`;
          thumbRel = `spots/${spotId}/${id}-thumb.webp`;
          writeFileSync(path.join(mediaRoot, rel), master.buffer);
          writeFileSync(path.join(mediaRoot, thumbRel), thumb.buffer);
        }

        await pool.query(
          "INSERT INTO spot_media (spot_id, path, thumb_path, width, height, position) VALUES ($1,$2,$3,$4,$5,$6)",
          [spotId, rel, thumbRel, width, height, i],
        );
        counts.media += 1;
      } catch (error) {
        console.warn(`  (image ${images[i].file_path} skipped: ${(error as Error).message})`);
      }
    }
  }

  console.log(`\nLegacy import complete:`);
  console.log(`  users:   ${counts.users} imported (${legacyUsers.length - counts.users} already present)`);
  console.log(`  spots:   ${counts.spots} imported (${legacySpots.length - counts.spots} already present)`);
  console.log(`  media:   ${counts.media} images`);
  console.log(`  avatars: ${counts.avatars} extracted`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
