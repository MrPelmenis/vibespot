import "server-only";

import { eq } from "drizzle-orm";
import { db, pool } from "@/db/client";
import { users } from "@/db/schema";
import { HttpError } from "@/lib/errors";
import type { GoogleIdentity } from "@/lib/google";

/**
 * Turns a verified Google identity into a `users` row.
 *
 * The identity (the `sub` claim) is already verified before this is called — this
 * module only persists it. Email and avatar are treated as *profile data* that can be
 * refreshed; `google_sub` is the stable key and never changes.
 */

/** A user-uploaded avatar lives under `avatars/`; keep it instead of clobbering it
 *  with the Google profile picture on every sign-in. */
function preservedAvatar(current: string | null, googlePicture: string | null): string | null {
  if (current?.startsWith("avatars/")) return current;
  return googlePicture ?? current;
}

export async function upsertUserByIdentity(identity: GoogleIdentity) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.googleSub, identity.sub))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    const updated = await db
      .update(users)
      .set({
        email: identity.email ?? user.email,
        avatarPath: preservedAvatar(user.avatarPath, identity.picture),
      })
      .where(eq(users.id, user.id))
      .returning();
    return updated[0];
  }

  // Link a legacy/imported account that already carries this email to the Google
  // identity (instead of failing on the unique email constraint). The existing
  // nickname and admin flag are preserved — only the Google subject + avatar change.
  if (identity.email) {
    const byEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, identity.email))
      .limit(1);
    if (byEmail.length > 0) {
      const user = byEmail[0];
      const linked = await db
        .update(users)
        .set({
          googleSub: identity.sub,
          avatarPath: preservedAvatar(user.avatarPath, identity.picture),
        })
        .where(eq(users.id, user.id))
        .returning();
      return linked[0];
    }
  }

  const nickname = await uniqueNickname(identity);
  const created = await db
    .insert(users)
    .values({
      googleSub: identity.sub,
      email: identity.email ?? `${identity.sub}@users.coolspot.invalid`,
      nickname,
      avatarPath: identity.picture,
    })
    .returning();
  return created[0];
}

async function uniqueNickname(identity: GoogleIdentity): Promise<string> {
  const base =
    identity.name?.trim().slice(0, 40) ||
    identity.email?.split("@")[0]?.slice(0, 40) ||
    "user";

  let candidate = base;
  let suffix = 1;
  while (await nicknameTaken(candidate)) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
}

async function nicknameTaken(nickname: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nickname, nickname))
    .limit(1);
  return rows.length > 0;
}

export type PublicUser = {
  id: number;
  nickname: string;
  description: string | null;
  avatarPath: string | null;
  isAdmin: boolean;
  createdAt: Date;
};

export async function getUserByNickname(nickname: string): Promise<PublicUser | null> {
  // The URL segment can arrive still percent-encoded or in a different Unicode
  // normalisation form (NFD vs NFC) — decode and normalise before the citext lookup,
  // so `TopVietasAli%C5%86am` and `TopVietasAliņam` both resolve.
  let name = nickname;
  try {
    name = decodeURIComponent(nickname);
  } catch {
    // not percent-encoded
  }
  name = name.normalize("NFC");

  const { rows } = await pool.query<{
    id: number;
    nickname: string;
    description: string | null;
    avatar_path: string | null;
    is_admin: boolean;
    created_at: Date;
  }>(
    `SELECT id, nickname, description, avatar_path, is_admin, created_at
     FROM users WHERE nickname = $1 AND is_deleted = false`,
    [name],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    nickname: r.nickname,
    description: r.description,
    avatarPath: r.avatar_path,
    isAdmin: r.is_admin,
    createdAt: r.created_at,
  };
}

export async function updateProfile(
  userId: number,
  input: { description: string | null; nickname?: string },
): Promise<{ nickname: string }> {
  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (nickname.length < 2 || nickname.length > 40) {
      throw new HttpError(400, "Nickname must be 2–40 characters.");
    }
    if (/^deleted/i.test(nickname)) {
      throw new HttpError(400, "That nickname is reserved.");
    }
    const taken = await pool.query(
      `SELECT 1 FROM users WHERE nickname = $1 AND id <> $2`,
      [nickname, userId],
    );
    if ((taken.rowCount ?? 0) > 0) {
      throw new HttpError(409, "That nickname is already taken.");
    }
    await pool.query(`UPDATE users SET nickname = $1 WHERE id = $2`, [nickname, userId]);
  }

  await pool.query(`UPDATE users SET description = $1 WHERE id = $2`, [input.description, userId]);

  const { rows } = await pool.query<{ nickname: string }>(
    `SELECT nickname FROM users WHERE id = $1`,
    [userId],
  );
  return { nickname: rows[0].nickname };
}

export type UserSearchResult = {
  id: number;
  nickname: string;
  avatarPath: string | null;
  spotCount: number;
};

/** Fuzzy nickname search (unaccent + trigram), matching the spot search's feel. */
export async function searchUsers(query: string, limit = 5): Promise<UserSearchResult[]> {
  const q = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!q) return [];

  const { rows } = await pool.query<{
    id: number;
    nickname: string;
    avatar_path: string | null;
    spot_count: number;
  }>(
    `SELECT u.id, u.nickname, u.avatar_path,
            (SELECT COUNT(*)::int FROM spots s WHERE s.created_by = u.id) AS spot_count
     FROM users u
     WHERE u.is_deleted = false
       AND (unaccent(lower(u.nickname)) ILIKE ('%' || $1 || '%')
            OR similarity(unaccent(lower(u.nickname)), $1) > 0.2)
     ORDER BY (unaccent(lower(u.nickname)) ILIKE ($1 || '%')) DESC,
              similarity(unaccent(lower(u.nickname)), $1) DESC,
              u.nickname ASC
     LIMIT $2`,
    [q, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    nickname: r.nickname,
    avatarPath: r.avatar_path,
    spotCount: r.spot_count,
  }));
}

export async function exportUserData(userId: number): Promise<Record<string, unknown>> {
  const user = (
    await pool.query(
      `SELECT id, nickname, email, description, avatar_path, is_admin, created_at
       FROM users WHERE id = $1`,
      [userId],
    )
  ).rows[0];
  const spots = (
    await pool.query(
      `SELECT id, slug, name, description, address, city, status, opening_hours, created_at
       FROM spots WHERE created_by = $1 ORDER BY id`,
      [userId],
    )
  ).rows;
  const reviews = (
    await pool.query(
      `SELECT id, spot_id, rating, body, visited_on, created_at
       FROM reviews WHERE user_id = $1 ORDER BY id`,
      [userId],
    )
  ).rows;
  const saved = (
    await pool.query(`SELECT spot_id, created_at FROM saved_spots WHERE user_id = $1`, [userId])
  ).rows;
  const visits = (
    await pool.query(`SELECT spot_id, created_at FROM visits WHERE user_id = $1`, [userId])
  ).rows;

  return {
    exported_at: new Date().toISOString(),
    user,
    spots,
    reviews,
    saved_spots: saved,
    visits,
  };
}

/**
 * Delete account: identity-strip public contributions (reviews/replies become
 * authorless, spots become community-owned) and remove private data (follows, saves,
 * visits, votes, requests). The user row becomes a tombstone, never a cascade delete.
 */
export async function deleteAccount(userId: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE reviews SET user_id = NULL WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE review_replies SET user_id = NULL WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE spots SET created_by = NULL WHERE created_by = $1`, [userId]);
    await client.query(`DELETE FROM follows WHERE follower_id = $1 OR followee_id = $1`, [userId]);
    await client.query(`DELETE FROM saved_spots WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM visits WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM review_votes WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM spot_requests WHERE user_id = $1`, [userId]);
    await client.query(
      `UPDATE users SET
         is_deleted = true,
         google_sub = 'deleted-sub-' || $1,
         email = 'deleted-' || $1 || '@coolspot.invalid',
         nickname = 'deleted-user-' || $1,
         description = NULL,
         avatar_path = NULL
       WHERE id = $1`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
