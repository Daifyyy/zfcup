-- =============================================================
-- ZF Cup — 02_rls.sql
-- Row Level Security: ENABLE + politiky pro všechny tabulky.
-- Spustit PO 01_tables.sql.
-- Bezpečné opakované spuštění: DROP POLICY IF EXISTS před CREATE.
-- =============================================================

-- -------------------------------------------------------
-- TOURNAMENT
-- -------------------------------------------------------
ALTER TABLE tournament ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON tournament;
DROP POLICY IF EXISTS "admin_write" ON tournament;
CREATE POLICY "public_read" ON tournament FOR SELECT USING (true);
CREATE POLICY "admin_write" ON tournament FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- TEAMS
-- -------------------------------------------------------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON teams;
DROP POLICY IF EXISTS "admin_write" ON teams;
CREATE POLICY "public_read" ON teams FOR SELECT USING (true);
CREATE POLICY "admin_write" ON teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- REFEREES
-- -------------------------------------------------------
ALTER TABLE referees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON referees;
DROP POLICY IF EXISTS "admin_write" ON referees;
CREATE POLICY "public_read" ON referees FOR SELECT USING (true);
CREATE POLICY "admin_write" ON referees FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- ANNOUNCEMENTS
-- -------------------------------------------------------
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON announcements;
DROP POLICY IF EXISTS "admin_write" ON announcements;
CREATE POLICY "public_read" ON announcements FOR SELECT USING (true);
CREATE POLICY "admin_write" ON announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- PLAYERS
-- -------------------------------------------------------
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON players;
DROP POLICY IF EXISTS "admin_write" ON players;
CREATE POLICY "public_read" ON players FOR SELECT USING (true);
CREATE POLICY "admin_write" ON players FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- GROUPS
-- -------------------------------------------------------
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON groups;
DROP POLICY IF EXISTS "admin_write" ON groups;
CREATE POLICY "public_read" ON groups FOR SELECT USING (true);
CREATE POLICY "admin_write" ON groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- MATCHES
-- -------------------------------------------------------
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON matches;
DROP POLICY IF EXISTS "admin_write" ON matches;
CREATE POLICY "public_read" ON matches FOR SELECT USING (true);
CREATE POLICY "admin_write" ON matches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- GOALS
-- -------------------------------------------------------
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON goals;
DROP POLICY IF EXISTS "admin_write" ON goals;
CREATE POLICY "public_read" ON goals FOR SELECT USING (true);
CREATE POLICY "admin_write" ON goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- BRACKET_ROUNDS
-- -------------------------------------------------------
ALTER TABLE bracket_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_rounds;
DROP POLICY IF EXISTS "admin_write" ON bracket_rounds;
CREATE POLICY "public_read" ON bracket_rounds FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_rounds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- BRACKET_SLOTS
-- -------------------------------------------------------
ALTER TABLE bracket_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_slots;
DROP POLICY IF EXISTS "admin_write" ON bracket_slots;
CREATE POLICY "public_read" ON bracket_slots FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_slots FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- BRACKET_GOALS
-- -------------------------------------------------------
ALTER TABLE bracket_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_goals;
DROP POLICY IF EXISTS "admin_write" ON bracket_goals;
CREATE POLICY "public_read" ON bracket_goals FOR SELECT USING (true);
CREATE POLICY "admin_write" ON bracket_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- TIPSTERS
-- anon uživatelé (tipéři) musí moci INSERT bez autentikace
-- -------------------------------------------------------
ALTER TABLE tipsters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON tipsters;
DROP POLICY IF EXISTS "anon_insert_tipsters" ON tipsters;
DROP POLICY IF EXISTS "admin_write" ON tipsters;
CREATE POLICY "public_read" ON tipsters FOR SELECT USING (true);
CREATE POLICY "anon_insert_tipsters" ON tipsters FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_write" ON tipsters FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- TIPS
-- anon uživatelé musí moci INSERT + UPDATE (upsert tipů)
-- -------------------------------------------------------
ALTER TABLE tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON tips;
DROP POLICY IF EXISTS "anon_insert_tips" ON tips;
DROP POLICY IF EXISTS "anon_update_tips" ON tips;
DROP POLICY IF EXISTS "admin_write" ON tips;
CREATE POLICY "public_read" ON tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_tips" ON tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_tips" ON tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- BRACKET_TIPS
-- anon uživatelé musí moci INSERT + UPDATE
-- -------------------------------------------------------
ALTER TABLE bracket_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON bracket_tips;
DROP POLICY IF EXISTS "anon_insert_bracket_tips" ON bracket_tips;
DROP POLICY IF EXISTS "anon_update_bracket_tips" ON bracket_tips;
DROP POLICY IF EXISTS "admin_write" ON bracket_tips;
CREATE POLICY "public_read" ON bracket_tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_bracket_tips" ON bracket_tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_bracket_tips" ON bracket_tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON bracket_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -------------------------------------------------------
-- SPECIAL_TIPS
-- anon uživatelé musí moci INSERT + UPDATE
-- -------------------------------------------------------
ALTER TABLE special_tips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON special_tips;
DROP POLICY IF EXISTS "anon_insert_special_tips" ON special_tips;
DROP POLICY IF EXISTS "anon_update_special_tips" ON special_tips;
DROP POLICY IF EXISTS "admin_write" ON special_tips;
CREATE POLICY "public_read" ON special_tips FOR SELECT USING (true);
CREATE POLICY "anon_insert_special_tips" ON special_tips FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update_special_tips" ON special_tips FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "admin_write" ON special_tips FOR ALL TO authenticated USING (true) WITH CHECK (true);
