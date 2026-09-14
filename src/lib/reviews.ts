import "server-only";

import { pool } from "@/db/client";
import { HttpError } from "@/lib/errors";
import { deleteMediaFile, writeReviewImageFile, type ProcessedImage } from "@/lib/media";
import { startVideoTranscode } from "@/lib/video";
import type { ReviewDistribution, ReviewReplySummary, ReviewSummary, SpotReviewState } from "@/lib/types";

/**
 * Reviews — star ratings (1–5) replace likes entirely. One review per user per spot,
 * editable forever. `rating_avg` / `rating_count` / `review_count` on `spots` are
 * recomputed in the same transaction as any review write; `visit_count` and
 * `save_count` likewise for their writes.
 */

type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<unknown>;
};

async function recomputeSpotStats(client: Queryable, spotId: number): Promise<void> {
  await client.query(
    `UPDATE spots SET
       rating_avg   = (SELECT AVG(rating) FROM reviews WHERE spot_id = $1),
       rating_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1),
       review_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1)
     WHERE id = $1`,
    [spotId],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

type ReviewRow = {
  id: number;
  spot_id: number;
  user_id: number | null;
  rating: number;
  body: string | null;
  visited_on: string | null;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
  nickname: string | null;
  avatar_path: string | null;
};

export async function listReviews(
  spotId: number,
  opts: { sort?: "recent" | "rating" | "helpful"; viewerId?: number | null } = {},
): Promise<ReviewSummary[]> {
  const { sort = "recent", viewerId } = opts;
  const orderBy =
    sort === "rating"
      ? "r.rating DESC, r.created_at DESC"
      : sort === "helpful"
        ? "r.helpful_count DESC, r.created_at DESC"
        : "r.created_at DESC";

  const { rows } = await pool.query<ReviewRow>(
    `SELECT r.id, r.spot_id, r.user_id, r.rating, r.body, r.visited_on, r.helpful_count,
            r.created_at, r.updated_at, u.nickname, u.avatar_path
     FROM reviews r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.spot_id = $1
     ORDER BY ${orderBy}`,
    [spotId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const { rows: mediaRows } = await pool.query<{
    id: number;
    review_id: number;
    kind: string;
    path: string;
    thumb_path: string | null;
    width: number | null;
    height: number | null;
    duration_s: string | null;
    status: string;
  }>(
    `SELECT id, review_id, kind, path, thumb_path, width, height, duration_s, status
     FROM review_media WHERE review_id = ANY($1::bigint[]) ORDER BY review_id, position`,
    [ids],
  );

  const { rows: replyRows } = await pool.query<{
    id: number;
    review_id: number;
    user_id: number | null;
    body: string;
    created_at: Date;
    nickname: string | null;
    avatar_path: string | null;
  }>(
    `SELECT rr.id, rr.review_id, rr.user_id, rr.body, rr.created_at, u.nickname, u.avatar_path
     FROM review_replies rr LEFT JOIN users u ON u.id = rr.user_id
     WHERE rr.review_id = ANY($1::bigint[]) ORDER BY rr.review_id, rr.created_at`,
    [ids],
  );

  let votedIds = new Set<number>();
  if (viewerId != null) {
    const { rows: voteRows } = await pool.query<{ review_id: number }>(
      `SELECT review_id FROM review_votes WHERE user_id = $1 AND review_id = ANY($2::bigint[])`,
      [viewerId, ids],
    );
    votedIds = new Set(voteRows.map((v) => v.review_id));
  }

  const mediaByReview = new Map<number, ReviewSummary["media"]>();
  for (const m of mediaRows) {
    const list = mediaByReview.get(m.review_id) ?? [];
    list.push({
      id: m.id,
      kind: m.kind as "image" | "video",
      url: `/media/${m.path}`,
      thumbUrl: m.thumb_path ? `/media/${m.thumb_path}` : null,
      width: m.width,
      height: m.height,
      durationS: m.duration_s,
      status: m.status,
    });
    mediaByReview.set(m.review_id, list);
  }

  const repliesByReview = new Map<number, ReviewReplySummary[]>();
  for (const r of replyRows) {
    const list = repliesByReview.get(r.review_id) ?? [];
    list.push({
      id: r.id,
      userId: r.user_id,
      nickname: r.nickname,
      avatarPath: r.avatar_path,
      body: r.body,
      createdAt: r.created_at.toISOString(),
    });
    repliesByReview.set(r.review_id, list);
  }

  return rows.map((r) => ({
    id: r.id,
    spotId: r.spot_id,
    userId: r.user_id,
    nickname: r.nickname,
    avatarPath: r.avatar_path,
    rating: r.rating,
    body: r.body,
    visitedOn: r.visited_on,
    helpfulCount: r.helpful_count,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    votedByMe: votedIds.has(r.id),
    media: mediaByReview.get(r.id) ?? [],
    replies: repliesByReview.get(r.id) ?? [],
  }));
}

export async function listReviewDistribution(spotId: number): Promise<ReviewDistribution> {
  const { rows } = await pool.query<{ rating: number; count: number }>(
    `SELECT rating, COUNT(*)::int AS count FROM reviews WHERE spot_id = $1 GROUP BY rating`,
    [spotId],
  );
  const dist: ReviewDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) dist[r.rating as 1 | 2 | 3 | 4 | 5] = r.count;
  return dist;
}

export async function getMyReview(
  spotId: number,
  userId: number,
): Promise<{ id: number; rating: number; body: string | null; visitedOn: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, rating, body, visited_on FROM reviews WHERE spot_id = $1 AND user_id = $2`,
    [spotId, userId],
  );
  return rows[0] ?? null;
}

export async function createReview(
  input: { spotId: number; rating: number; body: string | null; visitedOn: string | null },
  userId: number,
): Promise<number> {
  const rating = Math.round(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Rating must be 1–5 stars");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO reviews (spot_id, user_id, rating, body, visited_on)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.spotId, userId, rating, input.body ?? null, input.visitedOn ?? null],
    );
    await recomputeSpotStats(client, input.spotId);
    await client.query("COMMIT");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "You have already reviewed this spot — edit your review instead.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReview(
  reviewId: number,
  input: { rating: number; body: string | null; visitedOn: string | null },
  userId: number,
): Promise<void> {
  const rating = Math.round(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Rating must be 1–5 stars");
  }
  await assertReviewOwner(reviewId, userId);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE reviews SET rating = $1, body = $2, visited_on = $3 WHERE id = $4`, [
      rating,
      input.body ?? null,
      input.visitedOn ?? null,
      reviewId,
    ]);
    const spot = await client.query<{ spot_id: number }>(
      `SELECT spot_id FROM reviews WHERE id = $1`,
      [reviewId],
    );
    await recomputeSpotStats(client, spot.rows[0].spot_id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function assertReviewOwner(reviewId: number, userId: number): Promise<void> {
  const { rows } = await pool.query<{ user_id: number | null }>(
    `SELECT user_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (rows.length === 0) throw new HttpError(404, "Review not found");
  if (rows[0].user_id !== userId) throw new HttpError(403, "You can only edit your own review");
}

export async function addReviewMedia(
  reviewId: number,
  opts: { images: ProcessedImage[]; video: Buffer | null },
  userId: number,
): Promise<void> {
  await assertReviewOwner(reviewId, userId);

  const { rows } = await pool.query<{ max_pos: number }>(
    `SELECT COALESCE(MAX(position), -1) AS max_pos FROM review_media WHERE review_id = $1`,
    [reviewId],
  );
  let position = Number(rows[0].max_pos) + 1;

  for (const image of opts.images) {
    const stored = await writeReviewImageFile(reviewId, image);
    await pool.query(
      `INSERT INTO review_media (review_id, kind, path, thumb_path, width, height, status, position)
       VALUES ($1, 'image', $2, $3, $4, $5, 'ready', $6)`,
      [reviewId, stored.path, stored.thumbPath, stored.width, stored.height, position],
    );
    position += 1;
  }

  if (opts.video) {
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO review_media (review_id, kind, path, status, position)
       VALUES ($1, 'video', '', 'processing', $2) RETURNING id`,
      [reviewId, position],
    );
    await startVideoTranscode(
      opts.video,
      { table: "review_media", dir: "reviews", parentId: reviewId },
      inserted.rows[0].id,
    );
  }
}

export async function deleteReviewMedia(
  reviewId: number,
  mediaId: number,
  userId: number,
): Promise<void> {
  await assertReviewOwner(reviewId, userId);
  const { rows } = await pool.query<{ path: string; thumb_path: string | null }>(
    `SELECT path, thumb_path FROM review_media WHERE id = $1 AND review_id = $2`,
    [mediaId, reviewId],
  );
  if (rows.length === 0) throw new HttpError(404, "Media not found");
  await pool.query(`DELETE FROM review_media WHERE id = $1`, [mediaId]);
  await deleteMediaFile({ path: rows[0].path, thumbPath: rows[0].thumb_path ?? "" });
}

export async function toggleReviewVote(
  reviewId: number,
  userId: number,
): Promise<{ voted: boolean; helpfulCount: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT 1 FROM review_votes WHERE review_id = $1 AND user_id = $2`,
      [reviewId, userId],
    );
    let voted: boolean;
    if (existing.rowCount) {
      await client.query(`DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2`, [
        reviewId,
        userId,
      ]);
      voted = false;
    } else {
      await client.query(`INSERT INTO review_votes (review_id, user_id) VALUES ($1, $2)`, [
        reviewId,
        userId,
      ]);
      voted = true;
    }
    await client.query(
      `UPDATE reviews SET helpful_count = (SELECT COUNT(*)::int FROM review_votes WHERE review_id = $1) WHERE id = $1`,
      [reviewId],
    );
    const { rows } = await client.query<{ helpful_count: number }>(
      `SELECT helpful_count FROM reviews WHERE id = $1`,
      [reviewId],
    );
    await client.query("COMMIT");
    return { voted, helpfulCount: rows[0].helpful_count };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function createReply(reviewId: number, userId: number, body: string): Promise<number> {
  const trimmed = body.trim();
  if (!trimmed) throw new HttpError(400, "Reply cannot be empty");
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO review_replies (review_id, user_id, body) VALUES ($1, $2, $3) RETURNING id`,
    [reviewId, userId, trimmed],
  );
  return rows[0].id;
}

export async function markVisit(spotId: number, userId: number): Promise<{ visited: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT 1 FROM visits WHERE spot_id = $1 AND user_id = $2 AND created_at >= date_trunc('day', now())`,
      [spotId, userId],
    );
    if (existing.rowCount) {
      await client.query("COMMIT");
      return { visited: false };
    }
    await client.query(`INSERT INTO visits (spot_id, user_id) VALUES ($1, $2)`, [spotId, userId]);
    await client.query(
      `UPDATE spots SET visit_count = (SELECT COUNT(*)::int FROM visits WHERE spot_id = $1) WHERE id = $1`,
      [spotId],
    );
    await client.query("COMMIT");
    return { visited: true };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function toggleSaveSpot(spotId: number, userId: number): Promise<{ saved: boolean }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT 1 FROM saved_spots WHERE user_id = $1 AND spot_id = $2`,
      [userId, spotId],
    );
    let saved: boolean;
    if (existing.rowCount) {
      await client.query(`DELETE FROM saved_spots WHERE user_id = $1 AND spot_id = $2`, [
        userId,
        spotId,
      ]);
      saved = false;
    } else {
      await client.query(`INSERT INTO saved_spots (user_id, spot_id) VALUES ($1, $2)`, [
        userId,
        spotId,
      ]);
      saved = true;
    }
    await client.query(
      `UPDATE spots SET save_count = (SELECT COUNT(*)::int FROM saved_spots WHERE spot_id = $1) WHERE id = $1`,
      [spotId],
    );
    await client.query("COMMIT");
    return { saved };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export type ProfileReview = {
  id: number;
  spotId: number;
  spotSlug: string;
  spotName: string;
  rating: number;
  body: string | null;
  visitedOn: string | null;
  createdAt: string;
  helpfulCount: number;
};

export async function listReviewsByUser(userId: number, limit = 100): Promise<ProfileReview[]> {
  const { rows } = await pool.query<{
    id: number;
    spot_id: number;
    spot_slug: string;
    spot_name: string;
    rating: number;
    body: string | null;
    visited_on: string | null;
    helpful_count: number;
    created_at: Date;
  }>(
    `SELECT r.id, r.spot_id, s.slug AS spot_slug, s.name AS spot_name, r.rating, r.body,
            r.visited_on, r.helpful_count, r.created_at
     FROM reviews r JOIN spots s ON s.id = r.spot_id
     WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    spotId: r.spot_id,
    spotSlug: r.spot_slug,
    spotName: r.spot_name,
    rating: r.rating,
    body: r.body,
    visitedOn: r.visited_on,
    createdAt: r.created_at.toISOString(),
    helpfulCount: r.helpful_count,
  }));
}

export async function getSpotReviewState(
  spotId: number,
  userId: number,
): Promise<SpotReviewState> {
  const [saved, visited, review] = await Promise.all([
    pool.query(`SELECT 1 FROM saved_spots WHERE user_id = $1 AND spot_id = $2`, [userId, spotId]),
    pool.query(
      `SELECT 1 FROM visits WHERE spot_id = $1 AND user_id = $2 AND created_at >= date_trunc('day', now())`,
      [spotId, userId],
    ),
    pool.query(`SELECT id FROM reviews WHERE spot_id = $1 AND user_id = $2`, [spotId, userId]),
  ]);
  return {
    savedByMe: (saved.rowCount ?? 0) > 0,
    visitedToday: (visited.rowCount ?? 0) > 0,
    myReviewId: review.rows[0]?.id ?? null,
  };
}
