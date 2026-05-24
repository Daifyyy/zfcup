-- =============================================================
-- ZF Cup — 05_migrations.sql
-- Postupné migrace pro EXISTUJÍCÍ databázi.
-- Používat pokud DB existuje z dřívější verze a chybí sloupce.
-- Všechny příkazy jsou bezpečné: ADD COLUMN IF NOT EXISTS.
-- =============================================================

-- -------------------------------------------------------
-- TOURNAMENT — rozšíření o nové parametry
-- -------------------------------------------------------
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS format               TEXT DEFAULT 'groups',
  ADD COLUMN IF NOT EXISTS match_duration       INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS halves               SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playoff_kickoff      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS round_break          INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tips_lock_from       TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS num_teams            INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS num_groups           INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS advancing_per_group  INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS num_pitches          INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS rules_content        TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS league_has_playoff   BOOLEAN DEFAULT true;

-- -------------------------------------------------------
-- BRACKET_SLOTS — přidání scheduled_time
-- -------------------------------------------------------
ALTER TABLE bracket_slots
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

-- -------------------------------------------------------
-- BRACKET_ROUNDS — přidání časování kola
-- -------------------------------------------------------
ALTER TABLE bracket_rounds
  ADD COLUMN IF NOT EXISTS scheduled_start TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS break_after     INTEGER DEFAULT 5;

-- -------------------------------------------------------
-- TEAMS — přidání loga
-- -------------------------------------------------------
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- -------------------------------------------------------
-- ANNOUNCEMENTS — přidání typů médií
-- -------------------------------------------------------
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS type      TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- -------------------------------------------------------
-- BRACKET_GOALS — vytvoření tabulky pokud neexistuje
-- (starší verze nemusela mít tuto tabulku)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_goals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id    UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(slot_id, player_id)
);

-- RLS pro bracket_goals (pokud tabulka právě vznikla)
ALTER TABLE bracket_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_goals;
DROP POLICY IF EXISTS "admin_write" ON bracket_goals;
CREATE POLICY "public_read" ON bracket_goals FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- OPRAVA RLS special_tips — starší verze mohla chybět
-- -------------------------------------------------------
DROP POLICY IF EXISTS "admin_write" ON special_tips;
CREATE POLICY "admin_write" ON special_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- TOURNAMENT — logo turnaje
-- -------------------------------------------------------
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- -------------------------------------------------------
-- RULE_ITEMS — tabulka pro položky pravidel
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rule_items (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title    TEXT NOT NULL DEFAULT '',
  body     TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE rule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON rule_items;
DROP POLICY IF EXISTS "admin_write" ON rule_items;
CREATE POLICY "public_read" ON rule_items FOR SELECT USING (true);
CREATE POLICY "admin_write" ON rule_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- TIEBREAKER — update výchozí hodnoty na existujících skupinách
-- Spustit pokud chcete sjednotit tiebreaker na score_then_h2h.
-- POZOR: Změní tiebreaker VŠECH existujících skupin.
-- Odkomentovat ručně pokud je to žádoucí:
-- -------------------------------------------------------
-- UPDATE groups SET tiebreaker = 'score_then_h2h'
-- WHERE tiebreaker != 'score_then_h2h';
