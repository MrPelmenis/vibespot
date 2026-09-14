-- CoolSpot reviews — migration 0004.
--
-- Star ratings replace likes entirely. One review per user per spot, editable forever.
-- `rating_avg` / `rating_count` / `review_count` on spots are recomputed in the same
-- transaction as any review write (see src/lib/reviews.ts).

-- ── Reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE reviews (
    id            bigserial PRIMARY KEY,
    spot_id       bigint NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    user_id       bigint REFERENCES users(id) ON DELETE SET NULL,  -- NULL when identity stripped
    rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body          text,
    visited_on    date,                       -- "when did you go?"
    helpful_count integer NOT NULL DEFAULT 0,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (spot_id, user_id)                 -- one review per user per spot
);

CREATE INDEX reviews_spot_id_idx ON reviews (spot_id, created_at);

CREATE TRIGGER reviews_set_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Replies (nested under a review; no rating of their own) ──────────────────
CREATE TABLE review_replies (
    id          bigserial PRIMARY KEY,
    review_id   bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id     bigint REFERENCES users(id) ON DELETE SET NULL,
    body        text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_replies_review_id_idx ON review_replies (review_id, created_at);

-- ── Review media (photos and videos) ─────────────────────────────────────────
CREATE TABLE review_media (
    id          bigserial PRIMARY KEY,
    review_id   bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    kind        text NOT NULL CHECK (kind IN ('image', 'video')),
    path        text NOT NULL,                -- image: WebP master; video: MP4
    thumb_path  text,                         -- image: WebP thumb; video: poster frame
    width       integer,
    height      integer,
    duration_s  numeric,
    status      text NOT NULL DEFAULT 'ready', -- ready | processing | failed (video transcode)
    position    integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_media_review_id_idx ON review_media (review_id, position);

-- ── "Helpful" votes ──────────────────────────────────────────────────────────
CREATE TABLE review_votes (
    review_id   bigint NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (review_id, user_id)
);

-- ── Visits (deduped per user/day in the app layer) ───────────────────────────
CREATE TABLE visits (
    id          bigserial PRIMARY KEY,
    spot_id     bigint NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visits_spot_id_idx ON visits (spot_id);
CREATE INDEX visits_user_spot_idx ON visits (user_id, spot_id, created_at);

-- ── Saved / "want to go" ─────────────────────────────────────────────────────
CREATE TABLE saved_spots (
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    spot_id     bigint NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, spot_id)
);
