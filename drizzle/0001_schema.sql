-- CoolSpot schema — migration 0001.
--
-- Prerequisite extensions are created ONCE by a superuser, before this migration,
-- exactly as the README's database-setup step shows:
--     CREATE EXTENSION IF NOT EXISTS postgis;
--     CREATE EXTENSION IF NOT EXISTS pg_trgm;
--     CREATE EXTENSION IF NOT EXISTS unaccent;
--     CREATE EXTENSION IF NOT EXISTS citext;
-- This migration assumes those exist (the app role cannot create them itself).

-- ── Identity ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            bigserial PRIMARY KEY,
    google_sub    text   UNIQUE NOT NULL,   -- stable Google subject, NOT email
    email         citext UNIQUE NOT NULL,
    nickname      citext UNIQUE NOT NULL,
    description   text,
    avatar_path   text,                      -- file path / URL, never base64
    is_admin      boolean NOT NULL DEFAULT false,
    is_deleted    boolean NOT NULL DEFAULT false,  -- identity-stripped tombstone
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Categories (the existing 15 tags, each with a colour) ────────────────────
CREATE TABLE categories (
    id            bigserial PRIMARY KEY,
    slug          text   UNIQUE NOT NULL,
    name          text   NOT NULL,
    color         text   NOT NULL,           -- distinct colour, used for pins + chips
    icon          text   NOT NULL,           -- Lucide icon name (see src/lib/categories.ts)
    position      integer NOT NULL DEFAULT 0
);

-- ── Spots ────────────────────────────────────────────────────────────────────
CREATE TABLE spots (
    id            bigserial PRIMARY KEY,
    slug          text   UNIQUE NOT NULL,    -- generated, stable, collision-suffixed
    name          text   NOT NULL,           -- 3..60 chars (validated in the app)
    description   text,
    location      geography(Point,4326) NOT NULL,
    address       text,                      -- reverse-geocoded, cached
    city          text,                      -- for /city/<slug> pages and "near you"
    created_by    bigint REFERENCES users(id) ON DELETE SET NULL,  -- NULL = community-owned
    status        text   NOT NULL DEFAULT 'open',  -- open | temporarily_closed | permanently_closed
    opening_hours jsonb,                     -- optional, free-form per weekday
    rating_avg    numeric(3,2),              -- NULL when review_count = 0 (never 0)
    rating_count  integer NOT NULL DEFAULT 0,
    visit_count   integer NOT NULL DEFAULT 0,
    save_count    integer NOT NULL DEFAULT 0,
    review_count  integer NOT NULL DEFAULT 0,
    search_vector tsvector,                  -- populated by a trigger in Phase 3
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spots_location_idx     ON spots USING gist (location);
CREATE INDEX spots_search_vector_idx ON spots USING gin (search_vector);
CREATE INDEX spots_city_idx         ON spots (city);

-- ── Spot ↔ category join (multi-select, up to 3) ─────────────────────────────
CREATE TABLE spot_categories (
    spot_id      bigint NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    category_id  bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    position     integer NOT NULL DEFAULT 0,   -- 0 = primary category (pin colour)
    PRIMARY KEY (spot_id, category_id)
);

CREATE INDEX spot_categories_category_id_idx ON spot_categories (category_id);

-- ── Spot media ───────────────────────────────────────────────────────────────
CREATE TABLE spot_media (
    id           bigserial PRIMARY KEY,
    spot_id      bigint  NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    path         text    NOT NULL,           -- relative master path (WebP q80, 2560 px cap)
    thumb_path   text    NOT NULL,           -- relative 400 px thumbnail
    width        integer NOT NULL,           -- master dimensions, for CLS-free layout
    height       integer NOT NULL,
    position     integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spot_media_spot_id_idx ON spot_media (spot_id, position);

-- ── updated_at maintenance ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spots_set_updated_at
    BEFORE UPDATE ON spots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
