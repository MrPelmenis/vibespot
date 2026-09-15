import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { categories, spotCategories, spotMedia } from "@/db/schema";
import { HttpError } from "@/lib/errors";
import { deleteMediaFile, writeSpotMediaFile, type ProcessedImage } from "@/lib/media";
import { slugify } from "@/lib/slug";
import { startVideoTranscode } from "@/lib/video";
import type { CategorySummary, SpotSummary } from "@/lib/types";

const MAX_CATEGORIES = 3;
const NAME_MIN = 3;
const NAME_MAX = 60;

export type SpotInput = {
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  categoryIds: number[];
  address?: string | null;
  city?: string | null;
  openingHours?: string | null;
};

/** Raw row shape from the geography-aware SELECT below. */
type SpotRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  status: string;
  opening_hours: unknown;
  rating_avg: string | null;
  rating_count: number;
  visit_count: number;
  save_count: number;
  review_count: number;
  created_at: Date;
  updated_at: Date;
  created_by: number | null;
  creator_nickname: string | null;
  creator_avatar: string | null;
};

// `location` is geography(Point,4326): never selected raw. Lat/lng are surfaced via
// ST_Y / ST_X, and inserts use ST_MakePoint, so the GiST index is the only thing that
// touches the column.
const SPOT_SELECT = `
  SELECT
    s.id, s.slug, s.name, s.description,
    ST_Y(s.location::geometry) AS lat,
    ST_X(s.location::geometry) AS lng,
    s.address, s.city, s.status, s.opening_hours,
    s.rating_avg, s.rating_count, s.visit_count, s.save_count, s.review_count,
    s.created_at, s.updated_at, s.created_by,
    u.nickname AS creator_nickname,
    u.avatar_path AS creator_avatar
  FROM spots s
  LEFT JOIN users u ON u.id = s.created_by
`;

export async function listCategories(): Promise<CategorySummary[]> {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
    })
    .from(categories)
    .orderBy(asc(categories.position));
}

async function hydrate(rows: SpotRow[]): Promise<SpotSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const catRows = await db
    .select({
      spotId: spotCategories.spotId,
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      color: categories.color,
      icon: categories.icon,
      position: spotCategories.position,
    })
    .from(spotCategories)
    .innerJoin(categories, eq(categories.id, spotCategories.categoryId))
    .where(inArray(spotCategories.spotId, ids))
    .orderBy(asc(spotCategories.spotId), asc(spotCategories.position));

  const mediaRows = await db
    .select({
      id: spotMedia.id,
      spotId: spotMedia.spotId,
      path: spotMedia.path,
      thumbPath: spotMedia.thumbPath,
      width: spotMedia.width,
      height: spotMedia.height,
      kind: spotMedia.kind,
      durationS: spotMedia.durationS,
      status: spotMedia.status,
      position: spotMedia.position,
    })
    .from(spotMedia)
    .where(inArray(spotMedia.spotId, ids))
    .orderBy(asc(spotMedia.spotId), asc(spotMedia.position));

  const catsBySpot = new Map<number, CategorySummary[]>();
  for (const c of catRows) {
    const list = catsBySpot.get(c.spotId) ?? [];
    list.push({ id: c.id, slug: c.slug, name: c.name, color: c.color, icon: c.icon });
    catsBySpot.set(c.spotId, list);
  }

  const mediaBySpot = new Map<number, SpotSummary["media"]>();
  for (const m of mediaRows) {
    const list = mediaBySpot.get(m.spotId) ?? [];
    list.push({
      id: m.id,
      url: `/media/${m.path}`,
      thumbUrl: `/media/${m.thumbPath}`,
      width: m.width,
      height: m.height,
      kind: m.kind as "image" | "video",
      durationS: m.durationS,
      status: m.status,
    });
    mediaBySpot.set(m.spotId, list);
  }

  // Cover fallback: spots without their own photo use the first photo of the top
  // review, so cards/map/metadata never show an empty placeholder.
  const spotsWithoutImage = ids.filter((id) => {
    const media = mediaBySpot.get(id) ?? [];
    return !media.some((m) => m.kind === "image");
  });
  const reviewCoverBySpot = new Map<number, { url: string; thumbUrl: string; width: number; height: number }>();
  if (spotsWithoutImage.length > 0) {
    const { rows: reviewCoverRows } = await pool.query<{
      spot_id: number;
      path: string;
      thumb_path: string | null;
      width: number | null;
      height: number | null;
    }>(
      `SELECT DISTINCT ON (r.spot_id)
         r.spot_id, rm.path, rm.thumb_path, rm.width, rm.height
       FROM review_media rm
       JOIN reviews r ON r.id = rm.review_id
       WHERE r.spot_id = ANY($1::bigint[]) AND rm.kind = 'image'
       ORDER BY r.spot_id, r.created_at DESC, rm.position ASC`,
      [spotsWithoutImage],
    );
    for (const rc of reviewCoverRows) {
      reviewCoverBySpot.set(rc.spot_id, {
        url: `/media/${rc.path}`,
        thumbUrl: `/media/${rc.thumb_path ?? rc.path}`,
        width: rc.width ?? 0,
        height: rc.height ?? 0,
      });
    }
  }

  return rows.map((r) => {
    const cats = catsBySpot.get(r.id) ?? [];
    const media = mediaBySpot.get(r.id) ?? [];
    const ownImage = media.find((m) => m.kind === "image");
    const cover = ownImage
      ? { url: ownImage.url, thumbUrl: ownImage.thumbUrl, width: ownImage.width, height: ownImage.height }
      : reviewCoverBySpot.get(r.id) ?? null;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      city: r.city,
      status: r.status,
      openingHours: (r.opening_hours as { text?: string } | null) ?? null,
      ratingAvg: r.rating_avg,
      ratingCount: r.rating_count,
      visitCount: r.visit_count,
      saveCount: r.save_count,
      reviewCount: r.review_count,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      createdBy: r.created_by,
      creatorNickname: r.creator_nickname,
      creatorAvatar: r.creator_avatar,
      categories: cats,
      primaryCategory: cats[0] ?? null,
      media,
      cover,
    };
  });
}

export async function listSpotsInBbox(opts: {
  west: number;
  south: number;
  east: number;
  north: number;
  categoryIds?: number[];
  limit?: number;
}): Promise<SpotSummary[]> {
  const { west, south, east, north, categoryIds, limit = 50 } = opts;
  const values: unknown[] = [west, south, east, north];
  let sql = `${SPOT_SELECT} WHERE s.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography`;

  // Cap the map at ~50 pins, best-rated first, so the map stays readable.
  const orderBy = ` ORDER BY s.rating_avg DESC NULLS LAST, s.rating_count DESC, s.created_at DESC`;

  if (categoryIds && categoryIds.length > 0) {
    sql += ` AND s.id IN (SELECT sc.spot_id FROM spot_categories sc WHERE sc.category_id = ANY($5::bigint[]))`;
    values.push(categoryIds);
    sql += orderBy + ` LIMIT $6`;
    values.push(limit);
  } else {
    sql += orderBy + ` LIMIT $5`;
    values.push(limit);
  }

  const { rows } = await pool.query<SpotRow>(sql, values);
  return hydrate(rows);
}

export async function listSpotsByRadius(opts: {
  lat: number;
  lng: number;
  radiusMeters: number;
  categoryIds?: number[];
  limit?: number;
  offset?: number;
}): Promise<SpotSummary[]> {
  const { lat, lng, radiusMeters, categoryIds, limit = 100, offset = 0 } = opts;
  const values: unknown[] = [lng, lat, radiusMeters];
  let sql = `${SPOT_SELECT} WHERE ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`;

  if (categoryIds && categoryIds.length > 0) {
    sql += ` AND s.id IN (SELECT sc.spot_id FROM spot_categories sc WHERE sc.category_id = ANY($4::bigint[]))`;
    values.push(categoryIds);
    sql += ` ORDER BY s.created_at DESC LIMIT $5 OFFSET $6`;
    values.push(limit, offset);
  } else {
    sql += ` ORDER BY s.created_at DESC LIMIT $4 OFFSET $5`;
    values.push(limit, offset);
  }

  const { rows } = await pool.query<SpotRow>(sql, values);
  return hydrate(rows);
}

export async function getSpotBySlug(slug: string): Promise<SpotSummary | null> {
  const { rows } = await pool.query<SpotRow>(`${SPOT_SELECT} WHERE s.slug = $1`, [slug]);
  if (rows.length === 0) return null;
  const [spot] = await hydrate(rows);
  return spot;
}

export async function getSpotById(id: number): Promise<SpotSummary | null> {
  const { rows } = await pool.query<SpotRow>(`${SPOT_SELECT} WHERE s.id = $1`, [id]);
  if (rows.length === 0) return null;
  const [spot] = await hydrate(rows);
  return spot;
}

export async function listSpotsForSitemap(): Promise<{ slug: string; updatedAt: string }[]> {
  const { rows } = await pool.query<{ slug: string; updated_at: Date }>(
    `SELECT slug, updated_at FROM spots ORDER BY id`,
  );
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at.toISOString() }));
}

function validate(input: SpotInput, name: string): void {
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    throw new HttpError(400, `Name must be ${NAME_MIN}–${NAME_MAX} characters`);
  }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new HttpError(400, "A valid location is required");
  }
  if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) {
    throw new HttpError(400, "Location is out of range");
  }
  if (
    !Array.isArray(input.categoryIds) ||
    input.categoryIds.length === 0 ||
    input.categoryIds.length > MAX_CATEGORIES
  ) {
    throw new HttpError(400, `Choose 1–${MAX_CATEGORIES} categories`);
  }
  if (new Set(input.categoryIds).size !== input.categoryIds.length) {
    throw new HttpError(400, "Categories must be distinct");
  }
}

async function assertCategoriesExist(categoryIds: number[]): Promise<void> {
  const { rows } = await pool.query(`SELECT id FROM categories WHERE id = ANY($1::bigint[])`, [
    categoryIds,
  ]);
  if (rows.length !== categoryIds.length) {
    throw new HttpError(400, "One or more selected categories do not exist");
  }
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "spot";
  let candidate = base;
  let suffix = 1;
  while (true) {
    const { rows } = await pool.query(`SELECT 1 FROM spots WHERE slug = $1`, [candidate]);
    if (rows.length === 0) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

export async function createSpot(input: SpotInput, userId: number) {
  const name = input.name.trim();
  validate(input, name);
  await assertCategoriesExist(input.categoryIds);
  const slug = await uniqueSlug(name);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO spots (slug, name, description, location, address, city, opening_hours, created_by)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7,
               CASE WHEN $8::text IS NULL THEN NULL ELSE jsonb_build_object('text', $8::text) END, $9)
       RETURNING id`,
      [
        slug,
        name,
        input.description ?? null,
        input.lng,
        input.lat,
        input.address ?? null,
        input.city ?? null,
        input.openingHours?.trim() || null,
        userId,
      ],
    );
    const spotId = inserted.rows[0].id;

    await client.query(
      `INSERT INTO spot_categories (spot_id, category_id, position)
       SELECT $1, cat_id, ord - 1
       FROM unnest($2::bigint[]) WITH ORDINALITY AS t(cat_id, ord)`,
      [spotId, input.categoryIds],
    );
    await client.query("COMMIT");
    return { id: spotId, slug };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // connection already gone — nothing to roll back
    }
    throw error;
  } finally {
    client.release();
  }
}

async function assertCanEdit(spotId: number, userId: number, isAdmin: boolean): Promise<void> {
  const { rows } = await pool.query<{ created_by: number | null }>(
    `SELECT created_by FROM spots WHERE id = $1`,
    [spotId],
  );
  if (rows.length === 0) throw new HttpError(404, "Spot not found");
  if (!isAdmin && rows[0].created_by !== userId) {
    throw new HttpError(403, "You can only edit spots you created");
  }
}

export async function updateSpot(
  id: number,
  input: SpotInput,
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  await assertCanEdit(id, userId, isAdmin);
  const name = input.name.trim();
  validate(input, name);
  await assertCategoriesExist(input.categoryIds);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE spots
       SET name = $1, description = $2,
           location = ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
           address = $5, city = $6,
           opening_hours = CASE WHEN $7::text IS NULL THEN NULL ELSE jsonb_build_object('text', $7::text) END
       WHERE id = $8`,
      [
        name,
        input.description ?? null,
        input.lng,
        input.lat,
        input.address ?? null,
        input.city ?? null,
        input.openingHours?.trim() || null,
        id,
      ],
    );
    await client.query(`DELETE FROM spot_categories WHERE spot_id = $1`, [id]);
    await client.query(
      `INSERT INTO spot_categories (spot_id, category_id, position)
       SELECT $1, cat_id, ord - 1
       FROM unnest($2::bigint[]) WITH ORDINALITY AS t(cat_id, ord)`,
      [id, input.categoryIds],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function addSpotMedia(
  spotId: number,
  opts: { images: ProcessedImage[]; video: Buffer | null },
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  await assertCanEdit(spotId, userId, isAdmin);

  const { rows } = await pool.query<{ max_pos: number }>(
    `SELECT COALESCE(MAX(position), -1) AS max_pos FROM spot_media WHERE spot_id = $1`,
    [spotId],
  );
  let position = Number(rows[0].max_pos) + 1;

  for (const image of opts.images) {
    const stored = await writeSpotMediaFile(spotId, image);
    try {
      await pool.query(
        `INSERT INTO spot_media (spot_id, path, thumb_path, width, height, kind, position)
         VALUES ($1, $2, $3, $4, $5, 'image', $6)`,
        [spotId, stored.path, stored.thumbPath, stored.width, stored.height, position],
      );
    } catch (error) {
      await deleteMediaFile(stored);
      throw error;
    }
    position += 1;
  }

  if (opts.video) {
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO spot_media (spot_id, path, thumb_path, width, height, kind, status, position)
       VALUES ($1, '', '', 0, 0, 'video', 'processing', $2) RETURNING id`,
      [spotId, position],
    );
    await startVideoTranscode(
      opts.video,
      { table: "spot_media", dir: "spots", parentId: spotId },
      inserted.rows[0].id,
    );
  }
}

export async function deleteSpotMedia(
  spotId: number,
  mediaId: number,
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  await assertCanEdit(spotId, userId, isAdmin);

  const { rows } = await pool.query<{ path: string; thumb_path: string }>(
    `SELECT path, thumb_path FROM spot_media WHERE id = $1 AND spot_id = $2`,
    [mediaId, spotId],
  );
  if (rows.length === 0) throw new HttpError(404, "Photo not found");

  await pool.query(`DELETE FROM spot_media WHERE id = $1`, [mediaId]);
  await deleteMediaFile({ path: rows[0].path, thumbPath: rows[0].thumb_path });
}

// ── Discovery (Phase 3) ──────────────────────────────────────────────────────

/** Page size for the feed's infinite scroll (initial load + each subsequent page). */
export const FEED_PAGE_SIZE = 30;

/** Lowercase + strip diacritics, matching what `unaccent` does in Postgres. */
function searchNormalize(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function searchSpots(query: string, limit = 30): Promise<SpotSummary[]> {
  const q = searchNormalize(query);
  if (!q) return [];

  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} WHERE (
       s.search_norm ILIKE ('%' || $1 || '%')
       OR similarity(unaccent(lower(s.name)), $1) > 0.3
       OR unaccent(lower(coalesce(s.address, ''))) ILIKE ('%' || $1 || '%')
       OR EXISTS (
         SELECT 1 FROM spot_categories sc
         JOIN categories c ON c.id = sc.category_id
         WHERE sc.spot_id = s.id AND unaccent(lower(c.name)) ILIKE ('%' || $1 || '%')
       )
       OR EXISTS (
         SELECT 1 FROM users u2
         WHERE u2.id = s.created_by
           AND (
             unaccent(lower(u2.nickname)) ILIKE ('%' || $1 || '%')
             OR similarity(unaccent(lower(u2.nickname)), $1) > 0.3
           )
       )
     )
     ORDER BY (unaccent(lower(s.name)) ILIKE ($1 || '%')) DESC,
              similarity(unaccent(lower(s.name)), $1) DESC,
              (s.search_norm ILIKE ('%' || $1 || '%')) DESC,
              s.created_at DESC
     LIMIT $2`,
    [q, limit],
  );
  return hydrate(rows);
}

export async function listSpots(opts: {
  categorySlug?: string;
  city?: string;
  sort?: "recent" | "rating";
  limit?: number;
}): Promise<SpotSummary[]> {
  const { categorySlug, city, sort = "recent", limit = 60 } = opts;
  const values: unknown[] = [];
  const where: string[] = [];
  let join = "";

  if (categorySlug) {
    join = `
      JOIN spot_categories sc ON sc.spot_id = s.id
      JOIN categories c ON c.id = sc.category_id`;
    values.push(categorySlug);
    where.push(`c.slug = $${values.length}`);
  }
  if (city) {
    values.push(city);
    where.push(`unaccent(lower(s.city)) = unaccent(lower($${values.length}))`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const orderBy =
    sort === "rating"
      ? "ORDER BY s.rating_avg DESC NULLS LAST, s.rating_count DESC, s.created_at DESC"
      : "ORDER BY s.created_at DESC";
  values.push(limit);

  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} ${join} ${whereClause} ${orderBy} LIMIT $${values.length}`,
    values,
  );
  return hydrate(rows);
}

export async function listTrendingSpots(opts: {
  categorySlug?: string;
  limit?: number;
  offset?: number;
}): Promise<SpotSummary[]> {
  const { categorySlug, limit = 60, offset = 0 } = opts;
  const values: unknown[] = [];
  const where: string[] = [];
  let join = "";

  if (categorySlug) {
    join = `
      JOIN spot_categories sc ON sc.spot_id = s.id
      JOIN categories c ON c.id = sc.category_id`;
    values.push(categorySlug);
    where.push(`c.slug = $${values.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  values.push(limit, offset);

  // Recency-weighted score: popularity (rating/reviews/visits) divided by age decay.
  // With zero reviews/visits (as now) it degenerates to newest-first.
  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} ${join} ${whereClause}
     ORDER BY (
       (s.rating_count * 3 + s.review_count * 2 + s.visit_count)::float8
       / power(EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400 + 2, 1.5)
     ) DESC, s.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return hydrate(rows);
}

export type LeaderboardEntry = {
  userId: number;
  nickname: string;
  avatarPath: string | null;
  spotCount: number;
  avgRating: string | null;
};

export async function listLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { rows } = await pool.query(
    `SELECT
       u.id AS user_id,
       u.nickname,
       u.avatar_path AS avatar_path,
       COUNT(s.id)::int AS spot_count,
       CASE WHEN SUM(s.rating_count) > 0
         THEN (SUM(s.rating_avg * s.rating_count) / SUM(s.rating_count))::text
         ELSE NULL END AS avg_rating
     FROM users u
     LEFT JOIN spots s ON s.created_by = u.id
     WHERE u.is_deleted = false
     GROUP BY u.id
     HAVING COUNT(s.id) > 0
     ORDER BY spot_count DESC, avg_rating DESC NULLS LAST, u.nickname ASC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    avatarPath: r.avatar_path,
    spotCount: r.spot_count,
    avgRating: r.avg_rating,
  }));
}

export async function listSpotsByCreator(userId: number, limit = 100): Promise<SpotSummary[]> {
  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} WHERE s.created_by = $1 ORDER BY s.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return hydrate(rows);
}

export async function listSavedSpots(userId: number, limit = 100): Promise<SpotSummary[]> {
  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} JOIN saved_spots sv ON sv.spot_id = s.id
     WHERE sv.user_id = $1 ORDER BY sv.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return hydrate(rows);
}

export async function listVisitedSpots(userId: number, limit = 100): Promise<SpotSummary[]> {
  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT} JOIN visits v ON v.spot_id = s.id
     WHERE v.user_id = $1 ORDER BY v.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return hydrate(rows);
}

export async function listFollowingSpots(userId: number, limit = 60, offset = 0): Promise<SpotSummary[]> {
  const { rows } = await pool.query<SpotRow>(
    `${SPOT_SELECT}
     WHERE s.created_by IN (SELECT followee_id FROM follows WHERE follower_id = $1)
     ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return hydrate(rows);
}
