-- CoolSpot spot video — migration 0006.
-- Spots gain video alongside photos, so spot_media mirrors review_media.

ALTER TABLE spot_media
  ADD COLUMN kind       text NOT NULL DEFAULT 'image',
  ADD COLUMN duration_s numeric,
  ADD COLUMN status     text NOT NULL DEFAULT 'ready';
