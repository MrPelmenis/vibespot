import { customType } from "drizzle-orm/pg-core";
import {
  bigserial,
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * CoolSpot database schema (Drizzle).
 *
 * This file mirrors the authoritative SQL in `drizzle/0001_schema.sql` — the SQL
 * migrations are the source of truth for DDL (they carry the PostGIS types and
 * extension prerequisites); this file is the typed view the queries use. Keep the
 * two in sync: a column added here MUST be added to a new migration, and vice versa.
 *
 * Two Postgres extensions shape this file:
 *   - `citext`        → case-insensitive unique email/nickname (as the spec asks)
 *   - `postgis`       → `geography(Point,4326)` with a GiST index
 * `pg_trgm` and `unaccent` are created too but are only consumed in Phase 3 (search).
 */

// `citext` is not exported by drizzle-orm, so it is modelled as a custom type.
const citext = customType<{ data: string }>({ dataType: () => "citext" });

// `geography(Point,4326)`. JS-side value is { lng, lat }. We never read/write the
// raw column through Drizzle — geography is always inserted/selected via raw SQL
// (ST_MakePoint / ST_X / ST_Y), so the driver round-trip stubs are never hit.
const geographyPoint = customType<{ data: { lng: number; lat: number } }>({
  dataType: () => "geography(Point,4326)",
  toDriver: (v) => `SRID=4326;POINT(${v.lng} ${v.lat})`,
  fromDriver: () => ({ lng: 0, lat: 0 }),
});

// `tsvector` is created in Phase 2 but only populated by a trigger in Phase 3.
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const users = pgTable(
  "users",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    googleSub: text("google_sub").notNull(),
    email: citext("email").notNull(),
    nickname: citext("nickname").notNull(),
    description: text("description"),
    avatarPath: text("avatar_path"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_google_sub_key").on(table.googleSub),
    uniqueIndex("users_email_key").on(table.email),
    uniqueIndex("users_nickname_key").on(table.nickname),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    // Distinct, sensible colour per category — used for map pins and chips. This is
    // *data*, not a design token: the 15 colours are intentional and independent of
    // the light/dark theme, so they live in the database rather than globals.css.
    color: text("color").notNull(),
    // A Lucide icon name (see src/lib/categories.ts for the name → component map).
    icon: text("icon").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [uniqueIndex("categories_slug_key").on(table.slug)],
);

export const spots = pgTable(
  "spots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    location: geographyPoint("location").notNull(),
    address: text("address"),
    city: text("city"),
    // NULL when the creator's identity was stripped or the spot is community-owned.
    createdBy: bigint("created_by", { mode: "number" }),
    status: text("status").notNull().default("open"),
    openingHours: jsonb("opening_hours"),
    // NULL when there are zero reviews — never 0, never a fake value.
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count").notNull().default(0),
    visitCount: integer("visit_count").notNull().default(0),
    saveCount: integer("save_count").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    searchNorm: text("search_norm"),
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("spots_slug_key").on(table.slug),
    index("spots_location_idx").using("gist", table.location),
    index("spots_search_vector_idx").using("gin", table.searchVector),
    index("spots_city_idx").on(table.city),
  ],
);

export const spotCategories = pgTable(
  "spot_categories",
  {
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    categoryId: bigint("category_id", { mode: "number" }).notNull(),
    // position 0 = primary category (drives the pin colour).
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.spotId, table.categoryId] }),
    index("spot_categories_category_id_idx").on(table.categoryId),
  ],
);

export const spotMedia = pgTable(
  "spot_media",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    path: text("path").notNull(),
    thumbPath: text("thumb_path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    kind: text("kind").notNull().default("image"), // 'image' | 'video'
    durationS: numeric("duration_s"),
    status: text("status").notNull().default("ready"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("spot_media_spot_id_idx").on(table.spotId, table.position)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    // NULL when the author's identity was stripped.
    userId: bigint("user_id", { mode: "number" }),
    // 1..5 — validated in the app and by a CHECK in the SQL migration.
    rating: smallint("rating").notNull(),
    body: text("body"),
    visitedOn: date("visited_on"),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reviews_spot_id_user_id_key").on(table.spotId, table.userId),
    index("reviews_spot_id_idx").on(table.spotId, table.createdAt),
  ],
);

export const reviewReplies = pgTable(
  "review_replies",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    reviewId: bigint("review_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("review_replies_review_id_idx").on(table.reviewId, table.createdAt)],
);

export const reviewMedia = pgTable(
  "review_media",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    reviewId: bigint("review_id", { mode: "number" }).notNull(),
    kind: text("kind").notNull(), // 'image' | 'video'
    path: text("path").notNull(),
    thumbPath: text("thumb_path"),
    width: integer("width"),
    height: integer("height"),
    durationS: numeric("duration_s"),
    status: text("status").notNull().default("ready"), // ready | processing | failed
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("review_media_review_id_idx").on(table.reviewId, table.position)],
);

export const reviewVotes = pgTable(
  "review_votes",
  {
    reviewId: bigint("review_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.reviewId, table.userId] })],
);

export const visits = pgTable(
  "visits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("visits_spot_id_idx").on(table.spotId),
    index("visits_user_spot_idx").on(table.userId, table.spotId, table.createdAt),
  ],
);

export const savedSpots = pgTable(
  "saved_spots",
  {
    userId: bigint("user_id", { mode: "number" }).notNull(),
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.spotId] })],
);

export const follows = pgTable(
  "follows",
  {
    followerId: bigint("follower_id", { mode: "number" }).notNull(),
    followeeId: bigint("followee_id", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.followerId, table.followeeId] })],
);

export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: bigint("target_id", { mode: "number" }).notNull(),
    reporterId: bigint("reporter_id", { mode: "number" }),
    reason: text("reason"),
    status: text("status").notNull().default("open"),
    resolvedBy: bigint("resolved_by", { mode: "number" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("reports_status_idx").on(table.status, table.createdAt)],
);

export const spotRequests = pgTable(
  "spot_requests",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind").notNull(),
    spotId: bigint("spot_id", { mode: "number" }).notNull(),
    userId: bigint("user_id", { mode: "number" }).notNull(),
    payload: jsonb("payload"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("spot_requests_status_idx").on(table.status, table.createdAt)],
);

// Re-exported for convenience in raw-SQL helpers.
export type Spot = typeof spots.$inferSelect;
export type NewSpot = typeof spots.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type SpotMedia = typeof spotMedia.$inferSelect;
export type User = typeof users.$inferSelect;
