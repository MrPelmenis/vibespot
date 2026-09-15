import "server-only";

import { pool } from "@/db/client";
import { HttpError } from "@/lib/errors";
import { deleteMediaFile } from "@/lib/media";

/**
 * Admin moderation: report queue, spot delete/edit requests, spot deletion and merge.
 * All of these are `is_admin`-gated at the route layer.
 */

export async function listReports(status = "open") {
  const { rows } = await pool.query(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
            u.nickname AS reporter_nickname,
            CASE
              WHEN r.target_type = 'spot' THEN (SELECT name FROM spots WHERE id = r.target_id)
              WHEN r.target_type = 'review' THEN (SELECT 'review on ' || s.name FROM reviews rv JOIN spots s ON s.id = rv.spot_id WHERE rv.id = r.target_id)
              ELSE (SELECT nickname FROM users WHERE id = r.target_id)
            END AS target_label
     FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
     WHERE r.status = $1 ORDER BY r.created_at DESC LIMIT 100`,
    [status],
  );
  return rows;
}

export async function resolveReport(
  reportId: number,
  adminId: number,
  action: "resolved" | "dismissed",
): Promise<void> {
  await pool.query(
    `UPDATE reports SET status = $1, resolved_by = $2, resolved_at = now() WHERE id = $3`,
    [action, adminId, reportId],
  );
}

export async function listSpotRequests(status = "open") {
  const { rows } = await pool.query(
    `SELECT sr.id, sr.kind, sr.spot_id, sr.payload, sr.status, sr.created_at,
            u.nickname AS requester_nickname, s.name AS spot_name, s.slug AS spot_slug
     FROM spot_requests sr
     JOIN users u ON u.id = sr.user_id
     JOIN spots s ON s.id = sr.spot_id
     WHERE sr.status = $1 ORDER BY sr.created_at DESC LIMIT 100`,
    [status],
  );
  return rows;
}

export async function actionSpotRequest(
  requestId: number,
  adminId: number,
  action: "approved" | "denied",
): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, kind, spot_id FROM spot_requests WHERE id = $1 AND status = 'open'`,
    [requestId],
  );
  if (rows.length === 0) throw new HttpError(404, "Request not found");
  await pool.query(`UPDATE spot_requests SET status = $1 WHERE id = $2`, [action, requestId]);
  if (action === "approved" && rows[0].kind === "delete") {
    await adminDeleteSpot(rows[0].spot_id);
  }
}

/** Admin-only hard delete: removes the spot row (cascade) and unlinks its media files. */
export async function adminDeleteSpot(spotId: number): Promise<void> {
  const spotMedia = await pool.query<{ path: string; thumb_path: string }>(
    `SELECT path, thumb_path FROM spot_media WHERE spot_id = $1`,
    [spotId],
  );
  const reviewMedia = await pool.query<{ path: string; thumb_path: string | null }>(
    `SELECT rm.path, rm.thumb_path
     FROM review_media rm JOIN reviews r ON r.id = rm.review_id
     WHERE r.spot_id = $1`,
    [spotId],
  );
  await pool.query(`DELETE FROM spots WHERE id = $1`, [spotId]);
  for (const m of spotMedia.rows) {
    await deleteMediaFile({ path: m.path, thumbPath: m.thumb_path });
  }
  for (const m of reviewMedia.rows) {
    await deleteMediaFile({ path: m.path, thumbPath: m.thumb_path ?? "" });
  }
}

export async function listAdminUsers() {
  const { rows } = await pool.query(
    `SELECT id, nickname, email, is_admin, is_deleted, created_at
     FROM users ORDER BY id`,
  );
  return rows;
}

export async function adminSetAdmin(userId: number, isAdmin: boolean): Promise<void> {
  await pool.query(`UPDATE users SET is_admin = $1 WHERE id = $2`, [isAdmin, userId]);
}

export async function listAdminCategories() {
  const { rows } = await pool.query(
    `SELECT id, slug, name, color, icon, position FROM categories ORDER BY position, id`,
  );
  return rows;
}

export async function adminCreateCategory(input: {
  slug: string;
  name: string;
  color: string;
  icon: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO categories (slug, name, color, icon, position)
     VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(position), -1) + 1 FROM categories))`,
    [input.slug, input.name, input.color, input.icon],
  );
}

export async function adminDeleteCategory(categoryId: number): Promise<void> {
  await pool.query(`DELETE FROM spot_categories WHERE category_id = $1`, [categoryId]);
  await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
}

export async function listRecentReviews(limit = 50) {
  const { rows } = await pool.query(
    `SELECT r.id, r.rating, r.body, r.created_at,
            s.id AS spot_id, s.name AS spot_name, s.slug AS spot_slug,
            u.nickname AS author_nickname
     FROM reviews r
     JOIN spots s ON s.id = r.spot_id
     LEFT JOIN users u ON u.id = r.user_id
     ORDER BY r.created_at DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

/** Admin edit of a review: rating + body, then recompute the spot's stats. */
export async function adminUpdateReview(
  reviewId: number,
  rating: number,
  body: string | null,
): Promise<void> {
  await pool.query(`UPDATE reviews SET rating = $1, body = $2 WHERE id = $3`, [
    rating,
    body,
    reviewId,
  ]);
  const spot = await pool.query<{ spot_id: number }>(
    `SELECT spot_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (spot.rows.length > 0) {
    await pool.query(
      `UPDATE spots SET
         rating_avg   = (SELECT AVG(rating) FROM reviews WHERE spot_id = $1),
         rating_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1),
         review_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1)
       WHERE id = $1`,
      [spot.rows[0].spot_id],
    );
  }
}

/** Admin hard-delete of a review: unlink its media files, cascade the row, recompute stats. */
export async function adminDeleteReview(reviewId: number): Promise<void> {
  const media = await pool.query<{ path: string; thumb_path: string | null }>(
    `SELECT path, thumb_path FROM review_media WHERE review_id = $1`,
    [reviewId],
  );
  const spot = await pool.query<{ spot_id: number }>(
    `SELECT spot_id FROM reviews WHERE id = $1`,
    [reviewId],
  );
  if (spot.rows.length === 0) throw new HttpError(404, "Review not found");
  const spotId = spot.rows[0].spot_id;

  await pool.query(`DELETE FROM reviews WHERE id = $1`, [reviewId]);
  for (const m of media.rows) {
    await deleteMediaFile({ path: m.path, thumbPath: m.thumb_path ?? "" });
  }
  await pool.query(
    `UPDATE spots SET
       rating_avg   = (SELECT AVG(rating) FROM reviews WHERE spot_id = $1),
       rating_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1),
       review_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1)
     WHERE id = $1`,
    [spotId],
  );
}

/** Merge `sourceId` into `targetId`: move reviews/media/visits/saves/categories, then delete source. */
export async function mergeSpots(targetId: number, sourceId: number): Promise<void> {
  if (targetId === sourceId) throw new HttpError(400, "Cannot merge a spot into itself");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE reviews SET spot_id = $1 WHERE spot_id = $2`, [targetId, sourceId]);
    await client.query(`UPDATE spot_media SET spot_id = $1 WHERE spot_id = $2`, [targetId, sourceId]);
    await client.query(`UPDATE visits SET spot_id = $1 WHERE spot_id = $2`, [targetId, sourceId]);
    await client.query(
      `INSERT INTO saved_spots (user_id, spot_id, created_at)
       SELECT user_id, $1, created_at FROM saved_spots WHERE spot_id = $2
       ON CONFLICT (user_id, spot_id) DO NOTHING`,
      [targetId, sourceId],
    );
    await client.query(`DELETE FROM saved_spots WHERE spot_id = $1`, [sourceId]);
    await client.query(
      `INSERT INTO spot_categories (spot_id, category_id, position)
       SELECT $1, category_id, position FROM spot_categories WHERE spot_id = $2
       ON CONFLICT (spot_id, category_id) DO NOTHING`,
      [targetId, sourceId],
    );
    await client.query(`DELETE FROM spots WHERE id = $1`, [sourceId]);
    await client.query(
      `UPDATE spots SET
         rating_avg   = (SELECT AVG(rating) FROM reviews WHERE spot_id = $1),
         rating_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1),
         review_count = (SELECT COUNT(*)::int FROM reviews WHERE spot_id = $1),
         visit_count  = (SELECT COUNT(*)::int FROM visits WHERE spot_id = $1),
         save_count   = (SELECT COUNT(*)::int FROM saved_spots WHERE spot_id = $1)
       WHERE id = $1`,
      [targetId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
