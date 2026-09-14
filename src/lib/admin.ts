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
