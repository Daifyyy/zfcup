-- =============================================================
-- ZF Cup — 07_multisport.sql
-- Architektura pro více sportů (fotbal + hokej).
-- Čistě aditivní, bezpečné opakované spuštění.
-- Spustit ručně v Supabase SQL Editoru PO 01–06_*.sql.
-- =============================================================

-- -------------------------------------------------------
-- TOURNAMENT — sport turnaje
-- Nejdřív přidat nullable, explicitně zálohovat existující
-- řádky na 'football', pak teprve NOT NULL + DEFAULT + CHECK.
-- -------------------------------------------------------
ALTER TABLE tournament ADD COLUMN IF NOT EXISTS sport TEXT;

UPDATE tournament SET sport = 'football' WHERE sport IS NULL;

ALTER TABLE tournament ALTER COLUMN sport SET DEFAULT 'football';
ALTER TABLE tournament ALTER COLUMN sport SET NOT NULL;

ALTER TABLE tournament DROP CONSTRAINT IF EXISTS tournament_sport_check;
ALTER TABLE tournament ADD CONSTRAINT tournament_sport_check
  CHECK (sport IN ('football', 'hockey'));

-- -------------------------------------------------------
-- TOURNAMENT — volitelný modul: trestné minuty (hokej)
-- Nezávislý na cards_enabled — oba moduly mohou běžet
-- vedle sebe, žádný nenahrazuje druhý.
-- -------------------------------------------------------
ALTER TABLE tournament
  ADD COLUMN IF NOT EXISTS penalty_minutes_enabled BOOLEAN DEFAULT false;

-- -------------------------------------------------------
-- MATCHES / BRACKET_SLOTS — jak byl zápas rozhodnut
-- Skeleton pro budoucí prodloužení/nájezdy. Nullable,
-- u fotbalu se nepoužívá (zůstává NULL).
-- -------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS decided_in TEXT;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_decided_in_check;
ALTER TABLE matches ADD CONSTRAINT matches_decided_in_check
  CHECK (decided_in IS NULL OR decided_in IN ('regulation', 'ot', 'so'));

ALTER TABLE bracket_slots ADD COLUMN IF NOT EXISTS decided_in TEXT;
ALTER TABLE bracket_slots DROP CONSTRAINT IF EXISTS bracket_slots_decided_in_check;
ALTER TABLE bracket_slots ADD CONSTRAINT bracket_slots_decided_in_check
  CHECK (decided_in IS NULL OR decided_in IN ('regulation', 'ot', 'so'));

-- -------------------------------------------------------
-- PENALTIES (skupinová fáze) — trestné minuty, paralelní
-- modul ke cards. tournament_id NOT NULL (multi-tenant
-- konvence, viz assists/cards v 05_migrations.sql).
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS penalties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  match_id      UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  minutes       INTEGER NOT NULL CHECK (minutes IN (2, 5, 10)),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE penalties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON penalties;
DROP POLICY IF EXISTS "admin_write" ON penalties;
CREATE POLICY "public_read" ON penalties FOR SELECT USING (true);
CREATE POLICY "admin_write" ON penalties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- BRACKET_PENALTIES (playoff)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS bracket_penalties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournament(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slot_id       UUID NOT NULL REFERENCES bracket_slots(id) ON DELETE CASCADE,
  minutes       INTEGER NOT NULL CHECK (minutes IN (2, 5, 10)),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE bracket_penalties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_penalties;
DROP POLICY IF EXISTS "admin_write" ON bracket_penalties;
CREATE POLICY "public_read" ON bracket_penalties FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_penalties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- Indexy na FK sloupcích nových tabulek
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_penalties_match_id           ON penalties(match_id);
CREATE INDEX IF NOT EXISTS idx_penalties_player_id          ON penalties(player_id);
CREATE INDEX IF NOT EXISTS idx_bracket_penalties_slot_id    ON bracket_penalties(slot_id);
CREATE INDEX IF NOT EXISTS idx_bracket_penalties_player_id  ON bracket_penalties(player_id);
