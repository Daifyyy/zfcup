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
-- TOURNAMENT — playoff styl (standard / cross)
-- -------------------------------------------------------
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS playoff_style TEXT DEFAULT 'standard';

-- -------------------------------------------------------
-- TIEBREAKER — update výchozí hodnoty na existujících skupinách
-- Spustit pokud chcete sjednotit tiebreaker na score_then_h2h.
-- POZOR: Změní tiebreaker VŠECH existujících skupin.
-- Odkomentovat ručně pokud je to žádoucí:
-- -------------------------------------------------------
-- UPDATE groups SET tiebreaker = 'score_then_h2h'
-- WHERE tiebreaker != 'score_then_h2h';

-- -------------------------------------------------------
-- TOURNAMENT — format_id pro nový systém formátů
-- -------------------------------------------------------
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS format_id TEXT DEFAULT '';

-- -------------------------------------------------------
-- NOVÉ MODULY (2026-05-30)
-- -------------------------------------------------------

-- TOURNAMENT — volitelné moduly: asistence a kartičky
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS assists_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cards_enabled   BOOLEAN DEFAULT false;

-- PLAYERS — foto hráče
ALTER TABLE players
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- SPECIAL_TIPS — top_scorer tip (predicted_player_id)
ALTER TABLE special_tips
  ADD COLUMN IF NOT EXISTS predicted_player_id UUID REFERENCES players(id) ON DELETE SET NULL;

-- ASSISTS (skupinová fáze)
CREATE TABLE IF NOT EXISTS assists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(player_id, match_id)
);
ALTER TABLE assists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON assists;
DROP POLICY IF EXISTS "admin_write" ON assists;
CREATE POLICY "public_read" ON assists FOR SELECT USING (true);
CREATE POLICY "admin_write" ON assists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BRACKET_ASSISTS (playoff)
CREATE TABLE IF NOT EXISTS bracket_assists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot_id    UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(player_id, slot_id)
);
ALTER TABLE bracket_assists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_assists;
DROP POLICY IF EXISTS "admin_write" ON bracket_assists;
CREATE POLICY "public_read" ON bracket_assists FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_assists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CARDS (skupinová fáze)
CREATE TABLE IF NOT EXISTS cards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('yellow', 'red', 'yellow_red'))
);
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON cards;
DROP POLICY IF EXISTS "admin_write" ON cards;
CREATE POLICY "public_read" ON cards FOR SELECT USING (true);
CREATE POLICY "admin_write" ON cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BRACKET_CARDS (playoff)
CREATE TABLE IF NOT EXISTS bracket_cards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot_id    UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('yellow', 'red', 'yellow_red'))
);
ALTER TABLE bracket_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_cards;
DROP POLICY IF EXISTS "admin_write" ON bracket_cards;
CREATE POLICY "public_read" ON bracket_cards FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
