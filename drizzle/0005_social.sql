-- CoolSpot social + moderation — migration 0005.
--
-- Follows (friend == mutual follow, derived), reports, and admin spot requests
-- (delete/edit). Opening hours already live on `spots.opening_hours` (jsonb).

-- ── Follows ──────────────────────────────────────────────────────────────────
CREATE TABLE follows (
    follower_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

-- ── Reports ──────────────────────────────────────────────────────────────────
CREATE TABLE reports (
    id           bigserial PRIMARY KEY,
    target_type  text NOT NULL CHECK (target_type IN ('spot', 'review', 'user')),
    target_id    bigint NOT NULL,
    reporter_id  bigint REFERENCES users(id) ON DELETE SET NULL,
    reason       text,
    status       text NOT NULL DEFAULT 'open',   -- open | resolved | dismissed
    resolved_by  bigint REFERENCES users(id) ON DELETE SET NULL,
    resolved_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_status_idx ON reports (status, created_at);

-- ── Spot requests (delete / edit proposals for admins) ──────────────────────
CREATE TABLE spot_requests (
    id          bigserial PRIMARY KEY,
    kind        text NOT NULL CHECK (kind IN ('delete', 'edit')),
    spot_id     bigint NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload     jsonb,
    status      text NOT NULL DEFAULT 'open',    -- open | approved | denied
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX spot_requests_status_idx ON spot_requests (status, created_at);
