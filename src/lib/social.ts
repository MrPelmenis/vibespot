import "server-only";

import { pool } from "@/db/client";
import { HttpError } from "@/lib/errors";

/**
 * Follow graph. A friend is a mutual follow — derived from the two directed rows, never
 * stored separately.
 */

export type UserStats = {
  spotCount: number;
  reviewCount: number;
  followerCount: number;
  followingCount: number;
  visitedCount: number;
};

export async function toggleFollow(
  followerId: number,
  followeeId: number,
): Promise<{ following: boolean }> {
  if (followerId === followeeId) throw new HttpError(400, "You cannot follow yourself");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2`,
      [followerId, followeeId],
    );
    let following: boolean;
    if (existing.rowCount) {
      await client.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [
        followerId,
        followeeId,
      ]);
      following = false;
    } else {
      await client.query(`INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)`, [
        followerId,
        followeeId,
      ]);
      following = true;
    }
    await client.query("COMMIT");
    return { following };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function isFollowing(followerId: number, followeeId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2`,
    [followerId, followeeId],
  );
  return rows.length > 0;
}

export async function isFriend(a: number, b: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM follows
     WHERE follower_id = $1 AND followee_id = $2
       AND EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1)`,
    [a, b],
  );
  return rows.length > 0;
}

export type FollowUser = { id: number; nickname: string; avatarPath: string | null };

export async function listFollowers(userId: number): Promise<FollowUser[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname, u.avatar_path AS avatar_path
     FROM follows f JOIN users u ON u.id = f.follower_id
     WHERE f.followee_id = $1 AND u.is_deleted = false
     ORDER BY u.nickname ASC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, nickname: r.nickname, avatarPath: r.avatar_path }));
}

export async function listFollowing(userId: number): Promise<FollowUser[]> {
  const { rows } = await pool.query(
    `SELECT u.id, u.nickname, u.avatar_path AS avatar_path
     FROM follows f JOIN users u ON u.id = f.followee_id
     WHERE f.follower_id = $1 AND u.is_deleted = false
     ORDER BY u.nickname ASC`,
    [userId],
  );
  return rows.map((r) => ({ id: r.id, nickname: r.nickname, avatarPath: r.avatar_path }));
}

export async function getUserStats(userId: number): Promise<UserStats> {
  const { rows } = await pool.query<{
    spot_count: number;
    review_count: number;
    follower_count: number;
    following_count: number;
    visited_count: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM spots WHERE created_by = $1) AS spot_count,
       (SELECT COUNT(*)::int FROM reviews WHERE user_id = $1) AS review_count,
       (SELECT COUNT(*)::int FROM follows WHERE followee_id = $1) AS follower_count,
       (SELECT COUNT(*)::int FROM follows WHERE follower_id = $1) AS following_count,
       (SELECT COUNT(*)::int FROM visits WHERE user_id = $1) AS visited_count`,
    [userId],
  );
  const r = rows[0];
  return {
    spotCount: r.spot_count,
    reviewCount: r.review_count,
    followerCount: r.follower_count,
    followingCount: r.following_count,
    visitedCount: r.visited_count,
  };
}
