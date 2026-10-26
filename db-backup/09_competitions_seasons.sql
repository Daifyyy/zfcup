-- =============================================================
-- ZF Cup — 09_competitions_seasons.sql
-- Soutěže s ročníky, identita klubů/hráčů napříč ročníky, sezónní rozpis.
-- Čistě aditivní, bezpečné opakované spuštění.
-- Spustit ručně v Supabase SQL Editoru PO 01–08_*.sql.
-- Frontend funguje i bez této migrace (sekce soutěží se skryjí).
-- =============================================================

-- -------------------------------------------------------
-- COMPETITIONS — soutěž (např. „Hokejová liga okres Jablonec“)
-- Jednotlivé ročníky = záznamy v tabulce tournament s competition_id.
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS competitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  sport       TEXT NOT NULL DEFAULT 'football',
  logo_url    TEXT,
  description TEXT DEFAULT '',
  owner_id    UUID,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_sport_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_sport_check
  CHECK (sport IN ('football', 'hockey'));
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_slug_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_slug_check
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- -------------------------------------------------------
-- CLUBS — identita týmu napříč ročníky soutěže
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS clubs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  color          TEXT,
  logo_url       TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- PERSONS — identita hráče napříč ročníky soutěže
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS persons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  avatar_url     TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- -------------------------------------------------------
-- TOURNAMENT — příslušnost k soutěži, číslo ročníku, sezóna, režim rozpisu
--   schedule_mode: 'day'    = jednodenní turnaj (zápasy jen s časem)
--                  'season' = sezóna (kola v různé dny, zápasy s datem)
-- -------------------------------------------------------
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL;
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS edition        INT;
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS season_label   TEXT DEFAULT '';
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS schedule_mode  TEXT;
UPDATE tournament SET schedule_mode = 'day' WHERE schedule_mode IS NULL;
ALTER TABLE tournament ALTER COLUMN schedule_mode SET DEFAULT 'day';
ALTER TABLE tournament ALTER COLUMN schedule_mode SET NOT NULL;
ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_schedule_mode_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_schedule_mode_check
  CHECK (schedule_mode IN ('day', 'season'));
ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_edition_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_edition_check
  CHECK (edition IS NULL OR edition > 0);
-- Jeden ročník = jedno číslo v rámci soutěže
CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_competition_edition
  ON tournament(competition_id, edition) WHERE competition_id IS NOT NULL AND edition IS NOT NULL;

-- Sloupec z 05_migrations.sql, který v některých DB chybí (legacy, jen pro čtení)
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS playoff_style TEXT DEFAULT 'standard';

-- -------------------------------------------------------
-- TEAMS / PLAYERS — propojení s identitou napříč ročníky
-- -------------------------------------------------------
ALTER TABLE teams   ADD COLUMN IF NOT EXISTS club_id   UUID REFERENCES clubs(id)   ON DELETE SET NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES persons(id) ON DELETE SET NULL;

-- -------------------------------------------------------
-- MATCHES / BRACKET_SLOTS — datum zápasu (sezónní režim)
-- -------------------------------------------------------
ALTER TABLE matches       ADD COLUMN IF NOT EXISTS match_date DATE;
ALTER TABLE bracket_slots ADD COLUMN IF NOT EXISTS match_date DATE;

-- -------------------------------------------------------
-- INDEXY
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tournament_competition_id ON tournament(competition_id);
CREATE INDEX IF NOT EXISTS idx_clubs_competition_id      ON clubs(competition_id);
CREATE INDEX IF NOT EXISTS idx_persons_competition_id    ON persons(competition_id);
CREATE INDEX IF NOT EXISTS idx_teams_club_id             ON teams(club_id);
CREATE INDEX IF NOT EXISTS idx_players_person_id         ON players(person_id);
CREATE INDEX IF NOT EXISTS idx_matches_match_date        ON matches(match_date);

-- -------------------------------------------------------
-- RLS — stejná šablona jako ostatní tabulky (02_rls.sql)
-- -------------------------------------------------------
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON competitions;
DROP POLICY IF EXISTS "admin_write" ON competitions;
CREATE POLICY "public_read" ON competitions FOR SELECT USING (true);
CREATE POLICY "admin_write" ON competitions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON clubs;
DROP POLICY IF EXISTS "admin_write" ON clubs;
CREATE POLICY "public_read" ON clubs FOR SELECT USING (true);
CREATE POLICY "admin_write" ON clubs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON persons;
DROP POLICY IF EXISTS "admin_write" ON persons;
CREATE POLICY "public_read" ON persons FOR SELECT USING (true);
CREATE POLICY "admin_write" ON persons FOR ALL TO authenticated USING (true) WITH CHECK (true);
