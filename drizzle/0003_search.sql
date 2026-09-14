-- CoolSpot search — migration 0003.
--
-- Adds a unaccent-normalised shadow column + pg_trgm index for diacritic-insensitive
-- prefix/typo search (`riga` → `Rīga`, `skunis` → `sķūnis`), and a weighted tsvector
-- for ranking. Category and author-nickname terms are matched in the query itself
-- (via EXISTS) rather than baked into the column, so editing a spot's categories
-- cannot leave the column stale.

ALTER TABLE spots ADD COLUMN search_norm text;

-- Backfill must NOT bump `updated_at` (the set_updated_at trigger from 0001 would),
-- so disable it for the duration of the backfill.
ALTER TABLE spots DISABLE TRIGGER spots_set_updated_at;

UPDATE spots SET
  search_norm = lower(unaccent(name || ' ' || coalesce(description, '') || ' ' || coalesce(city, ''))),
  search_vector =
    setweight(to_tsvector('simple', unaccent(coalesce(name, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(city, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(description, ''))), 'C');

ALTER TABLE spots ENABLE TRIGGER spots_set_updated_at;

CREATE OR REPLACE FUNCTION spots_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_norm := lower(unaccent(
    NEW.name || ' ' || coalesce(NEW.description, '') || ' ' || coalesce(NEW.city, '')
  ));
  NEW.search_vector :=
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.city, ''))), 'B') ||
    setweight(to_tsvector('simple', unaccent(coalesce(NEW.description, ''))), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spots_search_trigger
  BEFORE INSERT OR UPDATE ON spots
  FOR EACH ROW EXECUTE FUNCTION spots_search_update();

CREATE INDEX spots_search_norm_trgm_idx ON spots USING gin (search_norm gin_trgm_ops);
