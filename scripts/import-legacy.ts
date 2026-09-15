#!/usr/bin/env node
/**
 * One-time legacy import: reads a legacy SQLite database and its `spot_images/` tree
 * (both read-only) and writes **every** user, **every** spot and **every** spot image
 * into Postgres.
 *
 * There is deliberately no id range in this script. An earlier version filtered on
 * `id BETWEEN 78 AND 88`, which silently imported only the eleven spots that existed
 * on 2025-01-30 and dropped everything added afterwards. Everything is read from the
 * source database now; if a row exists there, it is imported.
 *
 * Imported verbatim: names, descriptions, coordinates, categories, JSON timestamps
 * (naive local Riga time and UTC ISO both handled), base64 avatars (extracted to WebP).
 * Animated GIFs keep their animation, with a WebP still as the thumbnail.
 *
 * NOT imported, on purpose (see docs/rebuild/03-rebuild-spec.md):
 *   - comments          `reviews.rating` is NOT NULL with a 1–5 CHECK, and `reviews` is
 *                       UNIQUE(spot_id, user_id) while some spots have two legacy
 *                       comments by the same author — importing them would mean
 *                       inventing star ratings and merging authors. They are dropped.
 *   - likes             the product removed likes in favour of star ratings.
 *   - orphan files      images on disk that no `spot_images` row references are ignored.
 *
 * Idempotent and gap-filling: users are matched on email, spots on their generated
 * slug, media on (spot, position). Re-running imports only what is missing — so after
 * you copy the remaining legacy images over, running it again fills in just those.
 *
 * Usage:
 *   npm run import:legacy                        # resolve sources, then import
 *   npm run import:legacy -- --dry-run           # report everything, change nothing
 *   npm run import:legacy -- --allow-missing     # don't fail on absent image files
 *   npm run import:legacy -- --skip-images       # metadata only
 *   npm run import:legacy -- --refresh-users     # also refresh users matched by email
 *
 * Env:
 *   LEGACY_DB       path to the legacy SQLite file       (default: auto-detected)
 *   LEGACY_UPLOADS  path to the legacy spot_images/ dir  (default: auto-detected)
 *   LEGACY_DIR      legacy repo root used by detection   (default: the parent dir)
 *   DATABASE_URL, MEDIA_ROOT — read from the environment or .env / .env.local.
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const allowMissing = argv.includes("--allow-missing");
const skipImages = argv.includes("--skip-images");
const refreshUsers = argv.includes("--refresh-users");

// ── Env (Next convention; the real environment wins) ─────────────────────────
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

// ── Source resolution ────────────────────────────────────────────────────────

const legacyRoot = path.resolve(process.env.LEGACY_DIR ?? path.resolve(projectRoot, ".."));

/**
 * Resolve one source path. An explicit env var is authoritative: if it is set but does
 * not exist we stop, rather than quietly falling back to a different database.
 */
function resolveSource(
  label: string,
  envName: string,
  candidates: string[],
  kind: "file" | "dir",
): string | null {
  const explicit = process.env[envName]?.trim();
  if (explicit) {
    const abs = path.resolve(projectRoot, explicit);
    const ok = kind === "file" ? existsSync(abs) && statSync(abs).isFile() : existsSync(abs);
    if (!ok) {
      console.error(`✗ ${envName}=${explicit} does not point at a ${kind} (${abs}).`);
      process.exit(1);
    }
    console.log(`  ${label}: ${abs}  (from ${envName})`);
    return abs;
  }
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`  ${label}: ${candidate}  (auto-detected)`);
      return candidate;
    }
  }
  return null;
}

console.log("Legacy import — resolving sources");

const legacyDbPath = resolveSource("database", "LEGACY_DB", [
  path.join(projectRoot, "main_db.db"),
  path.join(projectRoot, "legacy", "main_db.db"),
  path.join(legacyRoot, "main_db.db"),
  path.join(legacyRoot, "BackEnd", "db", "main_db.db"),
  path.join(legacyRoot, "BackEnd", "main_db.db"),
  path.join(legacyRoot, "db", "main_db.db"),
], "file");

const uploadsDir = skipImages
  ? null
  : resolveSource("images  ", "LEGACY_UPLOADS", [
      path.join(projectRoot, "legacy_uploads", "spot_images"),
      path.join(projectRoot, "uploads", "spot_images"),
      path.join(legacyRoot, "BackEnd", "uploads", "spot_images"),
      path.join(legacyRoot, "uploads", "spot_images"),
    ], "dir");

if (!legacyDbPath) {
  console.error(
    "\n✗ No legacy database found.\n" +
      "  Put it at ./main_db.db, or point at it directly:\n" +
      "    LEGACY_DB=/path/to/main_db.db npm run import:legacy\n" +
      "  (LEGACY_DIR=/path/to/legacy-repo also works.)",
  );
  process.exit(1);
}
if (!skipImages && !uploadsDir) {
  console.error(
    "\n✗ No legacy spot_images/ directory found.\n" +
      "  Point at it directly:\n" +
      "    LEGACY_UPLOADS=/path/to/uploads/spot_images npm run import:legacy\n" +
      "  Or import metadata only with:  npm run import:legacy -- --skip-images",
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("\n✗ DATABASE_URL is not set (checked the environment and .env/.env.local).");
  process.exit(1);
}

const mediaRoot = path.isAbsolute(process.env.MEDIA_ROOT ?? "")
  ? process.env.MEDIA_ROOT!
  : path.resolve(projectRoot, process.env.MEDIA_ROOT ?? "./data/media");

const sqlite = new DatabaseSync(legacyDbPath, { readOnly: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const MASTER_LONG_EDGE = 2560;
const THUMB_LONG_EDGE = 400;
const WEBP_QUALITY = 80;
const AVATAR_SIZE = 256;

// ── Helpers ──────────────────────────────────────────────────────────────────

const LATVIAN: Record<string, string> = {
  ā: "a", č: "c", ē: "e", ģ: "g", ī: "i", ķ: "k", ļ: "l", ņ: "n", š: "s", ū: "u", ž: "z",
};

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

// Europe/Riga is UTC+2 (EET) in winter and UTC+3 (EEST) from the last Sunday of March
// to the last Sunday of October. Legacy naive timestamps are local wall-clock time.
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
  const asUtc = new Date(trimmed.replace(" ", "T") + "Z");
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

/**
 * The old schema stored a base64 data-URI in `profile_pic`, but some rows hold a path
 * into the old CRA bundle (`/static/media/DefaultProfilePic….png`) instead. Decoding
 * that as base64 yields garbage, so anything that is not a data-URI or bare base64 is
 * treated as "no avatar".
 */
function decodeBase64Image(value: string | null): Buffer | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(https?:)?\//i.test(trimmed) || /^data:image\/[a-z+.-]+;(?!base64)/i.test(trimmed)) {
    return null;
  }
  const match = /^data:[^;]+;base64,(.*)$/s.exec(trimmed);
  const payload = match ? match[1] : trimmed;
  if (!/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(payload)) return null;
  const buf = Buffer.from(payload, "base64");
  // A real avatar is a few KB; anything tiny is a broken value, not an image.
  return buf.byteLength > 256 ? buf : null;
}

function all<T>(sql: string, params?: unknown[]): T[] {
  return sqlite.prepare(sql).all(...((params ?? []) as never[])) as T[];
}

// ── Main ─────────────────────────────────────────────────────────────────────

const counts = {
  users: 0, usersMatched: 0, spots: 0, spotsMatched: 0,
  media: 0, mediaPresent: 0, avatars: 0,
};
const missingFiles: { legacySpotId: number; spotName: string; file: string; expected: string }[] = [];
const warnings: string[] = [];

async function main() {
  const legacyTags = all<{ id: number; tag_name: string }>("SELECT id, tag_name FROM tags");
  const legacyUsers = all<{
    id: number; nickname: string; email: string; description: string | null;
    is_admin: number; profile_pic: string | null;
  }>("SELECT id, nickname, email, description, is_admin, profile_pic FROM users ORDER BY id");
  const legacySpots = all<{
    id: number; name: string; description: string | null; geolocation: string | null;
    user_id: number; timestamp: string;
  }>("SELECT id, name, description, geolocation, user_id, timestamp FROM spots ORDER BY id");
  const legacySpotTags = all<{ spot_id: number; tag_id: number }>(
    "SELECT spot_id, tag_id FROM spot_tags ORDER BY spot_id, id",
  );
  const legacyImages = all<{ id: number; spot_id: number; file_path: string }>(
    "SELECT id, spot_id, file_path FROM spot_images ORDER BY spot_id, id",
  );

  console.log(
    `\nSource: ${legacySpots.length} spots, ${legacyImages.length} images, ${legacyUsers.length} users`,
  );
  if (dryRun) console.log("Mode:   DRY RUN — nothing will be written\n");

  const catRows = (await pool.query("SELECT id, name FROM categories")).rows as { id: number; name: string }[];
  const catIdByName = new Map(catRows.map((c) => [c.name.toLowerCase(), c.id]));
  const tagNameById = new Map(legacyTags.map((t) => [t.id, t.tag_name]));

  // ── Users ──────────────────────────────────────────────────────────────────
  // Legacy id 0 is the sentinel "deleted" account. It is not a real person: its
  // content is handed to the community, so it is never created as a user.
  const userIdMap = new Map<number, number | null>([[0, null]]);

  async function importAvatar(u: { id: number; profile_pic: string | null }, newId: number) {
    const avatar = decodeBase64Image(u.profile_pic);
    if (!avatar) return;
    if (dryRun) {
      counts.avatars += 1;
      return;
    }
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
      warnings.push(`avatar for legacy user ${u.id} skipped: ${(error as Error).message}`);
    }
  }

  for (const u of legacyUsers) {
    if (u.id === 0) continue;
    const email = (u.email ?? "").trim();
    if (!email) {
      warnings.push(`user ${u.id} has no email — skipped`);
      userIdMap.set(u.id, null);
      continue;
    }

    const existing = await pool.query("SELECT id, avatar_path FROM users WHERE email = $1", [email]);
    if (existing.rowCount) {
      const newId = existing.rows[0].id as number;
      userIdMap.set(u.id, newId);
      counts.usersMatched += 1;
      if (refreshUsers && !dryRun) {
        await pool.query(
          "UPDATE users SET description = $1, is_admin = $2 WHERE id = $3",
          [u.description ?? null, u.is_admin === 1, newId],
        );
      }
      // Only fill in an avatar when the user has none: a matched account may have set
      // one in the rebuild, which is newer than the legacy base64 data-URI.
      if (!existing.rows[0].avatar_path) await importAvatar(u, newId);
      continue;
    }

    if (dryRun) {
      console.log(`  + user ${u.id} → ${email} (${u.nickname})`);
      userIdMap.set(u.id, null);
      counts.users += 1;
      continue;
    }

    try {
      const inserted = await pool.query(
        `INSERT INTO users (google_sub, email, nickname, description, is_admin)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        // google_sub is unique+not-null; legacy users never signed in with Google, so
        // use a stable synthetic value derived from the legacy id.
        [`legacy:${u.id}`, email, u.nickname, u.description ?? null, u.is_admin === 1],
      );
      const newId = inserted.rows[0].id as number;
      userIdMap.set(u.id, newId);
      counts.users += 1;
      await importAvatar(u, newId);
    } catch (error) {
      // `users.nickname` is UNIQUE (citext), so a legacy nickname can collide with an
      // account created in the rebuild. Fall back to a suffixed one rather than losing
      // the user — and their spots' ownership — entirely.
      if ((error as { code?: string }).code !== "23505") throw error;
      try {
        const retry = await pool.query(
          `INSERT INTO users (google_sub, email, nickname, description, is_admin)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [
            `legacy:${u.id}`, email, `${u.nickname} (legacy ${u.id})`,
            u.description ?? null, u.is_admin === 1,
          ],
        );
        const newId = retry.rows[0].id as number;
        userIdMap.set(u.id, newId);
        counts.users += 1;
        warnings.push(
          `user ${u.id} nickname "${u.nickname}" was taken — imported as "${u.nickname} (legacy ${u.id})"`,
        );
      } catch (retryError) {
        userIdMap.set(u.id, null);
        warnings.push(`user ${u.id} (${email}) could not be imported: ${(retryError as Error).message}`);
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

  async function importSpotImages(s: { id: number; name: string }, spotId: number) {
    const images = imagesBySpot.get(s.id) ?? [];
    if (!images.length) return;

    // Position is the import key, so already-imported media is never duplicated and
    // media missing from an otherwise complete spot still gets filled in.
    const taken = new Set<number>(
      (await pool.query("SELECT position FROM spot_media WHERE spot_id = $1", [spotId])).rows.map(
        (r) => r.position as number,
      ),
    );

    if (!dryRun) mkdirSync(path.join(mediaRoot, "spots", String(spotId)), { recursive: true });

    for (let i = 0; i < images.length; i += 1) {
      if (taken.has(i)) {
        counts.mediaPresent += 1;
        continue;
      }
      const file = path.basename(images[i].file_path);
      const src = path.join(uploadsDir!, file);

      if (!existsSync(src)) {
        missingFiles.push({ legacySpotId: s.id, spotName: s.name, file, expected: src });
        continue;
      }

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
          // Preserve the animation: the GIF is the master, the thumb is a WebP still.
          rel = `spots/${spotId}/${id}-master.gif`;
          thumbRel = `spots/${spotId}/${id}-thumb.webp`;
          if (!dryRun) {
            writeFileSync(path.join(mediaRoot, rel), input);
            const thumb = await sharp(input)
              .rotate()
              .resize({
                width: THUMB_LONG_EDGE, height: THUMB_LONG_EDGE,
                fit: "inside", withoutEnlargement: true,
              })
              .webp({ quality: WEBP_QUALITY })
              .toBuffer();
            writeFileSync(path.join(mediaRoot, thumbRel), thumb);
          }
        } else {
          const master = await renderWebP(input, MASTER_LONG_EDGE);
          const thumb = await renderWebP(input, THUMB_LONG_EDGE);
          width = master.width;
          height = master.height;
          rel = `spots/${spotId}/${id}-master.webp`;
          thumbRel = `spots/${spotId}/${id}-thumb.webp`;
          if (!dryRun) {
            writeFileSync(path.join(mediaRoot, rel), master.buffer);
            writeFileSync(path.join(mediaRoot, thumbRel), thumb.buffer);
          }
        }

        if (!dryRun) {
          await pool.query(
            "INSERT INTO spot_media (spot_id, path, thumb_path, width, height, position) VALUES ($1,$2,$3,$4,$5,$6)",
            [spotId, rel, thumbRel, width, height, i],
          );
        }
        counts.media += 1;
      } catch (error) {
        warnings.push(`image ${file} (spot ${s.id} "${s.name}") skipped: ${(error as Error).message}`);
      }
    }
  }

  for (const s of legacySpots) {
    const coords = (s.geolocation ?? "").split(",").map((p) => Number(p.trim()));
    const [lat, lng] = coords;
    if (coords.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      warnings.push(`spot ${s.id} "${s.name}" has an unusable geolocation (${s.geolocation}) — skipped`);
      continue;
    }

    const slug = slugify(s.name ?? "") || `spot-${s.id}`;
    const existing = await pool.query("SELECT id, name FROM spots WHERE slug = $1", [slug]);
    let spotId: number;

    if (existing.rowCount) {
      spotId = existing.rows[0].id as number;
      counts.spotsMatched += 1;
      // A slug is derived from the name, so a match on a differently-named spot means
      // the rebuild already has a spot that happens to collide. Flag it loudly rather
      // than silently attaching legacy images to someone else's spot.
      if ((existing.rows[0].name as string) !== s.name) {
        warnings.push(
          `slug "${slug}" already exists as "${existing.rows[0].name}" — ` +
            `legacy spot ${s.id} "${s.name}" matched it`,
        );
      }
    } else if (dryRun) {
      // A negative placeholder id: it matches no `spot_media` row, so the media pass
      // below reports exactly what a real run would import — including missing files.
      console.log(`  + spot ${s.id} → /${slug}  (${s.name})`);
      spotId = -s.id;
      counts.spots += 1;
    } else {
      const createdAt = parseLegacyTimestamp(s.timestamp);
      const inserted = await pool.query(
        `INSERT INTO spots (slug, name, description, location, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $7)
         RETURNING id`,
        [slug, s.name, s.description ?? null, lng, lat, userIdMap.get(s.user_id) ?? null, createdAt],
      );
      spotId = inserted.rows[0].id as number;
      counts.spots += 1;
    }

    // Categories — PK (spot_id, category_id) makes this idempotent on re-run.
    for (const tagId of tagsBySpot.get(s.id) ?? []) {
      const tagName = tagNameById.get(tagId);
      const catId = tagName ? catIdByName.get(tagName.toLowerCase()) : undefined;
      if (!catId) {
        warnings.push(`no category for legacy tag "${tagName}" (spot ${s.id})`);
        continue;
      }
      if (!dryRun) {
        await pool.query(
          "INSERT INTO spot_categories (spot_id, category_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
          [spotId, catId, tagId],
        );
      }
    }

    if (!skipImages) await importSpotImages(s, spotId);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${dryRun ? "Dry run complete — nothing written" : "Legacy import complete"}:`);
  console.log(`  users:   ${counts.users} created, ${counts.usersMatched} already present`);
  console.log(`  avatars: ${counts.avatars} extracted`);
  console.log(`  spots:   ${counts.spots} created, ${counts.spotsMatched} already present`);
  console.log(`  images:  ${counts.media} imported, ${counts.mediaPresent} already present`);

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  if (missingFiles.length) {
    console.log(`\n✗ ${missingFiles.length} referenced image file(s) are not in ${uploadsDir}:`);
    for (const m of missingFiles) {
      console.log(`    ${m.file}  (legacy spot ${m.legacySpotId} "${m.spotName}")`);
    }

    const spotIds = [...new Set(missingFiles.map((m) => m.legacySpotId))].sort((a, b) => a - b);
    console.log(
      `\n  These live on the old server. Copy the whole tree over, then re-run this script —\n` +
        `  it fills in only what is missing:\n\n` +
        `    rsync -avP -e "ssh -p 4222" <user>@<host>:<legacy>/uploads/spot_images/ ./legacy_uploads/spot_images/\n\n` +
        `  Affected legacy spot ids: ${spotIds.join(", ")}`,
    );

    if (!allowMissing) {
      console.log("\n  Re-run with --allow-missing to import the rest anyway.");
      process.exitCode = 1;
    }
  }

  console.log(`\nNext: backfill address/city metadata for the new spots:\n  npm run backfill:addresses\n`);

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
